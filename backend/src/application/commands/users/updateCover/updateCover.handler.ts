import { inject, injectable } from "tsyringe";
import * as fs from "fs";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { UpdateCoverCommand } from "./updateCover.command";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IImageStorageService } from "@/types";
import { UnitOfWork } from "@/database/UnitOfWork";
import { EventBus } from "@/application/common/buses/event.bus";
import { RedisService } from "@/services/redis.service";
import { DTOService, PublicUserDTO } from "@/services/dto.service";
import { RetryPresets, RetryService } from "@/services/retry.service";
import { createError } from "@/utils/errors";
import { UserCoverChangedEvent } from "@/application/events/user/user-interaction.event";

@injectable()
export class UpdateCoverCommandHandler implements ICommandHandler<UpdateCoverCommand, PublicUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("RetryService") private readonly retryService: RetryService,
		@inject("DTOService") private readonly dtoService: DTOService,
	) {}

	async execute(command: UpdateCoverCommand): Promise<PublicUserDTO> {
		if (!command.filePath) {
			throw createError("ValidationError", "Cover file is required");
		}

		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		let newCoverUrl: string | null = null;
		let newCoverPublicId: string | null = null;
		const oldCoverUrl = user.cover ?? null;
		const userPublicId = user.publicId;

		try {
			const uploadResult = await this.imageStorageService.uploadImage(command.filePath, userPublicId);
			newCoverUrl = uploadResult.url;
			newCoverPublicId = uploadResult.publicId;
		} catch (error) {
			console.error("Cover upload failed:", error);
			// Clean up temp file if upload fails
			if (fs.existsSync(command.filePath)) {
				fs.unlink(command.filePath, (err) => {
					if (err) console.error("Failed to delete temp file:", err);
				});
			}
			throw createError("UploadError", "Failed to upload cover");
		}

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const userId = user.id;

				await this.userWriteRepository.updateCover(userId, newCoverUrl!, session);
			});

			await this.deleteOldCoverAfterCommit(userPublicId, oldCoverUrl);

			await this.redisService.invalidateByTags([`user_data:${userPublicId}`]);

			const coverChangedEvent = new UserCoverChangedEvent(
				userPublicId,
				oldCoverUrl || undefined,
				newCoverUrl || undefined,
			);
			await this.eventBus.publish(coverChangedEvent);

			const updatedUser = await this.userReadRepository.findByPublicId(command.userPublicId);
			if (!updatedUser) {
				throw createError("NotFoundError", "User not found after cover update");
			}

			const postCount = await this.postReadRepository.countDocuments({ user: updatedUser.id });
			(updatedUser as any).postCount = postCount;

			return this.dtoService.toPublicDTO(updatedUser);
		} catch (error) {
			if (newCoverPublicId) {
				try {
					await this.imageStorageService.deleteImage(newCoverPublicId);
				} catch (deleteError) {
					console.error("failed to clean up new cover", deleteError);
				}
			}

			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message,
				);
			}
			throw createError("InternalServerError", "An unknown error occurred");
		} finally {
			if (command.filePath && fs.existsSync(command.filePath)) {
				fs.unlink(command.filePath, (err) => {
					if (err) console.error("Failed to delete temp file:", err);
				});
			}
		}
	}

	private async deleteOldCoverAfterCommit(userPublicId: string, oldCoverUrl: string | null): Promise<void> {
		if (!oldCoverUrl) {
			return;
		}

		try {
			await this.retryService.execute(
				() => this.imageStorageService.deleteAssetByUrl(userPublicId, userPublicId, oldCoverUrl),
				RetryPresets.externalApi(),
			);
		} catch (deleteError) {
			console.warn(`failed to delete old cover: ${oldCoverUrl}`, deleteError);
		}
	}
}

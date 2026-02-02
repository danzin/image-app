import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { UpdateProfileCommand } from "./updateProfile.command";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { UnitOfWork } from "@/database/UnitOfWork";
import { UserActionRepository } from "@/repositories/userAction.repository";
import { DTOService, PublicUserDTO } from "@/services/dto.service";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserUsernameChangedEvent } from "@/application/events/user/user-interaction.event";
import { createError } from "@/utils/errors";

@injectable()
export class UpdateProfileCommandHandler implements ICommandHandler<UpdateProfileCommand, PublicUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EventBus") private readonly eventBus: EventBus
	) {}

	async execute(command: UpdateProfileCommand): Promise<PublicUserDTO> {
		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const allowedUpdates: Record<string, unknown> = {};
		const oldUsername = user.username;
		let usernameChanged = false;

		if (typeof command.updates.username === "string") {
			const trimmed = command.updates.username.trim();
			if (trimmed && trimmed !== user.username) {
				// check if username is already taken
				const existingUser = await this.userReadRepository.findByUsername(trimmed);
				if (existingUser && existingUser.publicId !== command.userPublicId) {
					throw createError("ValidationError", "Username is already taken");
				}
				allowedUpdates.username = trimmed;
				usernameChanged = true;
			}
		}

		if (typeof command.updates.bio === "string") {
			allowedUpdates.bio = command.updates.bio.trim();
		}

		if (typeof command.updates.handle === "string") {
			throw createError("ValidationError", "Handle cannot be changed");
		}

		if (Object.keys(allowedUpdates).length === 0) {
			throw createError("ValidationError", "No valid fields provided for update");
		}

		await this.unitOfWork.executeInTransaction(async (session) => {
			await this.userWriteRepository.update(user.id, { $set: allowedUpdates }, session);
			await this.userActionRepository.logAction(user.id, "profile_update", user.id, session);
		});

		// emit username change event after successful transaction
		if (usernameChanged && allowedUpdates.username) {
			const usernameChangedEvent = new UserUsernameChangedEvent(
				command.userPublicId,
				oldUsername,
				allowedUpdates.username as string
			);
			await this.eventBus.publish(usernameChangedEvent);
		}

		// fetch updated user
		const updatedUser = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!updatedUser) {
			throw createError("NotFoundError", "User not found after update");
		}

		return this.dtoService.toPublicDTO(updatedUser);
	}
}

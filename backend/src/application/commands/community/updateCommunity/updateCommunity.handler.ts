import { inject, injectable } from "tsyringe";
import { Types } from "mongoose";
import * as fs from "fs";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { UpdateCommunityCommand } from "./updateCommunity.command";
import { CommunityRepository } from "@/repositories/community.repository";
import { CommunityMemberRepository } from "@/repositories/communityMember.repository";
import { UserRepository } from "@/repositories/user.repository";
import { ICommunity, IImageStorageService } from "@/types";
import { createError } from "@/utils/errors";
import { generateSlug } from "@/utils/helpers";
import { logger } from "@/utils/winston";
import { TOKENS } from "@/types/tokens";

@injectable()
export class UpdateCommunityCommandHandler implements ICommandHandler<UpdateCommunityCommand, ICommunity> {
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(TOKENS.Services.ImageStorage) private readonly imageStorageService: IImageStorageService,
	) {}

	async execute(command: UpdateCommunityCommand): Promise<ICommunity> {
		const { communityId: communityPublicId, userId: userPublicId, updates } = command;

		const community = await this.communityRepository.findByPublicId(communityPublicId);
		if (!community) {
			throw createError("NotFoundError", "Community not found");
		}
		const communityId = community._id as Types.ObjectId;

		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		const userId = user._id as Types.ObjectId;

		// Check permissions (must be admin of the community)
		const member = await this.communityMemberRepository.findByCommunityAndUser(communityId, userId);
		if (!member || member.role !== "admin") {
			throw createError("ForbiddenError", "Only community admins can update settings");
		}

		// Prepare updates
		const updateData: Partial<ICommunity> = {};
		if (updates.description !== undefined) updateData.description = updates.description;

		if (updates.name) {
			updateData.name = updates.name;
			const newSlug = generateSlug(updates.name);

			// check slug uniqueness if changed
			const existing = await this.communityRepository.findBySlug(newSlug);
			if (existing && existing._id.toString() !== communityId.toString()) {
				throw createError("ValidationError", "Community name is already taken");
			}
			updateData.slug = newSlug;
		}

		// Handle avatar upload
		if (updates.avatarPath) {
			try {
				const uploadResult = await this.imageStorageService.uploadImage(
					updates.avatarPath,
					`community-${community.slug}-avatar`,
				);
				updateData.avatar = uploadResult.url;
			} catch (error) {
				logger.error("Failed to upload community avatar", { error });
			} finally {
				if (fs.existsSync(updates.avatarPath)) {
					fs.unlink(updates.avatarPath, (err) => {
						if (err) logger.error("Failed to delete temp avatar file", { err });
					});
				}
			}
		}

		// Handle cover photo upload
		if (updates.coverPhotoPath) {
			try {
				const uploadResult = await this.imageStorageService.uploadImage(
					updates.coverPhotoPath,
					`community-${community.slug}-cover`,
				);
				updateData.coverPhoto = uploadResult.url;
			} catch (error) {
				logger.error("Failed to upload community cover photo", { error });
			} finally {
				if (fs.existsSync(updates.coverPhotoPath)) {
					fs.unlink(updates.coverPhotoPath, (err) => {
						if (err) logger.error("Failed to delete temp cover photo file", { err });
					});
				}
			}
		}

		// Update
		const updatedCommunity = await this.communityRepository.update(communityId.toString(), updateData);
		if (!updatedCommunity) {
			throw createError("NotFoundError", "Community not found");
		}

		return updatedCommunity;
	}
}

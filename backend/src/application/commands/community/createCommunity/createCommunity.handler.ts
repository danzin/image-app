import { inject, injectable } from "tsyringe";
import { Types } from "mongoose";
import * as fs from "fs";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { CreateCommunityCommand } from "./createCommunity.command";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { createError } from "../../../../utils/errors";
import { ICommunity, IImageStorageService } from "../../../../types";

@injectable()
export class CreateCommunityCommandHandler implements ICommandHandler<CreateCommunityCommand, ICommunity> {
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(UnitOfWork) private uow: UnitOfWork,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService
	) {}

	async execute(command: CreateCommunityCommand): Promise<ICommunity> {
		const { name, description, creatorId, avatarPath } = command;

		const user = await this.userRepository.findByPublicId(creatorId);
		if (!user) {
			throw createError("NotFound", "User not found");
		}
		const userId = user._id as Types.ObjectId;

		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)+/g, "");

		// Check if slug exists
		const existing = await this.communityRepository.findBySlug(slug);
		if (existing) {
			throw createError("BadRequest", "Community with this name already exists");
		}

		let avatarUrl = "";
		if (avatarPath) {
			try {
				// Use slug as the folder/publicId prefix
				const uploadResult = await this.imageStorageService.uploadImage(avatarPath, slug);
				avatarUrl = uploadResult.url;
			} catch (error) {
				console.error("Failed to upload community avatar:", error);
				// Continue without avatar or throw? User said "avatar is not mandatory"
				// But if they provided one and it failed, maybe we should warn.
				// For now, let's log and proceed with empty avatar, or maybe throw to let them retry.
				// Given "avatar is not mandatory", proceeding seems safer, but if upload fails, user might want to know.
				// However, to keep it simple and robust, I'll log and proceed.
			} finally {
				// Clean up temp file
				if (fs.existsSync(avatarPath)) {
					fs.unlink(avatarPath, (err) => {
						if (err) console.error("Failed to delete temp file:", err);
					});
				}
			}
		}

		return this.uow.executeInTransaction(async (session) => {
			// 1. Create Community
			const community = await this.communityRepository.create(
				{
					name,
					slug,
					description,
					avatar: avatarUrl,
					creatorId: userId,
					stats: { memberCount: 1, postCount: 0 },
				},
				session
			);

			// 2. Add Creator as Admin
			await this.communityMemberRepository.create(
				{
					communityId: community._id,
					userId: userId,
					role: "admin",
				},
				session
			);

			// 3. Update User Cache
			await this.userRepository.update(
				userId.toString(),
				{
					$push: {
						joinedCommunities: {
							$each: [
								{
									_id: community._id,
									name: community.name,
									slug: community.slug,
								},
							],
							$position: 0,
							$slice: 10,
						},
					},
				} as any,
				session
			);

			return community;
		});
	}
}

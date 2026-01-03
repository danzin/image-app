import { inject, injectable } from "tsyringe";
import { Types } from "mongoose";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { UpdateCommunityCommand } from "./updateCommunity.command";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { ICommunity } from "../../../../types";
import { createError } from "../../../../utils/errors";

@injectable()
export class UpdateCommunityCommandHandler implements ICommandHandler<UpdateCommunityCommand, ICommunity> {
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject(UserRepository) private userRepository: UserRepository
	) {}

	async execute(command: UpdateCommunityCommand): Promise<ICommunity> {
		const { communityId: communityPublicId, userId: userPublicId, updates } = command;

		const community = await this.communityRepository.findByPublicId(communityPublicId);
		if (!community) {
			throw createError("NotFound", "Community not found");
		}
		const communityId = community._id as Types.ObjectId;

		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFound", "User not found");
		}
		const userId = user._id as Types.ObjectId;

		// 1. Check permissions (must be admin of the community)
		const member = await this.communityMemberRepository.findByCommunityAndUser(communityId, userId);
		if (!member || member.role !== "admin") {
			throw createError("Forbidden", "Only community admins can update settings");
		}

		// 2. Prepare updates
		const updateData: Partial<ICommunity> = {};
		if (updates.description !== undefined) updateData.description = updates.description;

		if (updates.name) {
			updateData.name = updates.name;
			const newSlug = updates.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)+/g, "");

			// Check slug uniqueness if changed
			const existing = await this.communityRepository.findBySlug(newSlug);
			if (existing && existing._id.toString() !== communityId.toString()) {
				throw createError("BadRequest", "Community name is already taken");
			}
			updateData.slug = newSlug;
		}

		// 3. Update
		const updatedCommunity = await this.communityRepository.update(communityId.toString(), updateData);
		if (!updatedCommunity) {
			throw createError("NotFound", "Community not found");
		}

		return updatedCommunity;
	}
}

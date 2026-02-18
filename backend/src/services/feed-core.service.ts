import { inject, injectable } from "tsyringe";
import { IPostReadRepository, IUserReadRepository } from "@/repositories/interfaces";
import { UserPreferenceRepository } from "@/repositories/userPreference.repository";
import { FollowRepository } from "@/repositories/follow.repository";
import { EventBus } from "@/application/common/buses/event.bus";
import { ColdStartFeedGeneratedEvent } from "@/application/events/ColdStartFeedGenerated.event";
import { CoreFeed } from "@/types";
import { createError } from "@/utils/errors";
import { logger } from "@/utils/winston";

@injectable()
export class FeedCoreService {
	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
	) {}

	async generatePersonalizedCoreFeed(userPublicId: string, page: number, limit: number): Promise<CoreFeed> {
		const user = await this.userReadRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [topTags, followingIds] = await Promise.all([
			this.userPreferenceRepository.getTopUserTags(user.id),
			this.followRepository.getFollowingObjectIds(user.id),
		]);

		const favoriteTags = topTags.map((pref) => pref.tag);
		const skip = (page - 1) * limit;

		if (followingIds.length === 0 && favoriteTags.length === 0) {
			if (page === 1) {
				try {
					await this.eventBus.publish(new ColdStartFeedGeneratedEvent(userPublicId));
				} catch (error) {
					logger.warn("[FeedCoreService] Failed to publish cold-start event", {
						userPublicId,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			return this.postReadRepository.getRankedFeed(favoriteTags, limit, skip) as Promise<CoreFeed>;
		}

		return this.postReadRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip) as Promise<CoreFeed>;
	}
}

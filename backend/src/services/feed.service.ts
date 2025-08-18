import { inject, injectable } from "tsyringe";
import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { RedisService } from "./redis.service";
import { IUser } from "../types";

@injectable()
export class FeedService {
	constructor(
		@inject("ImageRepository") private imageRepository: ImageRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("UserActionRepository") private userActionRepository: UserActionRepository,
		@inject("RedisService") private redisService: RedisService
	) {}

	// TODO: Cache invalidation only invalidates the specific user's feed. When another user interacts
	// with an image, the cache for all other users remains the same and they don't immediately see the update.
	// Must deal with this shit.
	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<any> {
		console.log(`Running getPersonalizedFeed for userId: ${userId} `);

		try {
			const cacheKey = `feed:${userId}:${page}:${limit}`;

			// Check cache first
			const cachedFeed = await this.redisService.get(cacheKey);
			if (cachedFeed) {
				console.log("Returning cached feed");
				return cachedFeed;
			}

			//Using Promise.all to execute the operations concurrently and
			// get the result once they've resolved or rejected
			const [user, topTags] = await Promise.all([
				this.userRepository.findByPublicId(userId),
				this.userRepository
					.findByPublicId(userId)
					.then((user: IUser | null) => (user ? this.userPreferenceRepository.getTopUserTags(String(user._id)) : [])),
			]);

			if (!user) {
				throw createError("NotFoundError", "User not found");
			}

			const followingIds = user.following || [];
			const favoriteTags = topTags.map((pref) => pref.tag);

			const skip = (page - 1) * limit;
			console.log(
				`==================followingIds: ${followingIds}, favoriteTags: ${favoriteTags} \r\n =======================`
			);
			const feed = await this.imageRepository.getFeedForUser(followingIds, favoriteTags, limit, skip);

			await this.redisService.set(cacheKey, feed, 120); // Cache feed for 2 minutes
			return feed;
		} catch (error) {
			console.error(error);
			const errorMessage =
				typeof error === "object" && error !== null && "message" in error
					? (error as { message?: string }).message || "Unknown error"
					: String(error);
			throw createError("FeedError", errorMessage);
		}
	}

	public async recordInteraction(
		userPublicId: string,
		actionType: string,
		targetIdentifier: string,
		tags: string[]
	): Promise<void> {
		console.log(
			`Running recordInteraction... for ${userPublicId}, actionType: ${actionType}, targetId: ${targetIdentifier}, tags: ${tags}`
		);
		// Resolve user internal id
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		// If action targets an image provided by publicId (may include extension), normalize
		let internalTargetId = targetIdentifier;
		if (actionType === "like" || actionType === "unlike") {
			const sanitized = targetIdentifier.replace(/\.[a-z0-9]{2,5}$/i, "");
			const image = await this.imageRepository.findByPublicId(sanitized);
			if (image) internalTargetId = (image as any)._id.toString();
		}
		await this.userActionRepository.logAction(String(user._id), actionType, internalTargetId);

		// Update tag preferences based on action type
		let scoreIncrement = 0;
		if (actionType === "like" || actionType === "unlike") {
			scoreIncrement = this.getScoreIncrementForAction(actionType);
		}

		if (scoreIncrement !== 0) {
			await Promise.all(
				tags.map((tag) => this.userPreferenceRepository.incrementTagScore(String(user._id), tag, scoreIncrement))
			);
		}
		console.log("Removing cache");
		await this.redisService.del(`feed:${userPublicId}:*`);
	}

	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}

	// 	public async invalidateRelevantFeeds(imagePublicId: string, actionType: string): Promise<void> {
	//   try {
	//     // Get the image and its details
	//     const image = await this.imageRepository.findByPublicId(imagePublicId);
	//     if (!image) return;

	//     // Find users who might have this image in their feed
	//     const usersToInvalidate = new Set<string>();

	//     // 1. Add followers of the image owner
	//     const imageOwner = await this.userRepository.findById(image.user._id);
	//     if (imageOwner) {
	//       const followers = await this.userRepository.getFollowers(imageOwner.publicId);
	//       followers.forEach(follower => usersToInvalidate.add(follower.publicId));
	//     }

	//     // 2. Add users who have preferences for these tags
	//     if (image.tags && image.tags.length > 0) {
	//       const tagNames = image.tags.map(tag => tag.tag);
	//       const usersWithTagPreferences = await this.userPreferenceRepository.getUsersByTags(tagNames);
	//       usersWithTagPreferences.forEach(user => usersToInvalidate.add(user.publicId));
	//     }

	//     // 3. Invalidate all relevant user feeds
	//     const invalidationPromises = Array.from(usersToInvalidate).map(userPublicId =>
	//       this.redisService.del(`feed:${userPublicId}:*`)
	//     );

	//     await Promise.all(invalidationPromises);
	//     console.log(`Invalidated feeds for ${usersToInvalidate.size} users`);
	//   } catch (error) {
	//     console.error('Failed to invalidate relevant feeds:', error);
	//   }
	// }
}

// okay another one important issue at hand.

// I have a personalized user feed i show to logged in users. It's inside the image.repository.ts:
//   async getFeedForUser(
//     followingIds: string[],
//     favoriteTags: string[],
//     limit: number,
//     skip: number
//   ): Promise<PaginationResult<IImage>> {
//     try {
//       console.log(`getFeedForUser - followingIds: ${followingIds}, favoriteTags: ${favoriteTags}`);
//       // Convert user IDs to MongoDB ObjectId format for querying
//       const followingIdsObj = followingIds.map((id) => new mongoose.Types.ObjectId(id));

//       // Determine if the user has any preferences (following users or favorite tags)
//       const hasPreferences = followingIds.length > 0 || favoriteTags.length > 0;

//       // Aggregation pipeline for generating the user feed
//       // Personalized content is prioritized; when unavailable, it falls back to recent images
//       const [results, total] = await Promise.all([
//         this.model
//           .aggregate([
//             // Stage 1: Lookup tags associated with each image
//             {
//               $lookup: {
//                 from: "tags", // Join with the 'tags' collection
//                 localField: "tags", // Image document's 'tags' field
//                 foreignField: "_id", // Match with '_id' field in 'tags' collection
//                 as: "tagObjects", // Output array of matching tag documents
//               },
//             },

//             // Stage 2: Extract tag names into a separate field for easier filtering
//             {
//               $addFields: {
//                 tagNames: {
//                   $map: {
//                     input: "$tagObjects",
//                     as: "tag",
//                     in: "$$tag.tag", // Extract the 'tag' field from each tag document
//                   },
//                 },
//               },
//             },

//             // Stage 3: Determine whether an image matches the user's preferences
//             {
//               $addFields: {
//                 isPersonalized: hasPreferences
//                   ? {
//                       $or: [
//                         { $in: ["$user", followingIdsObj] }, // Image posted by a followed user
//                         { $gt: [{ $size: { $setIntersection: ["$tagNames", favoriteTags] } }, 0] }, // Image contains a favorite tag
//                       ],
//                     }
//                   : false,
//               },
//             },

//             // Stage 4: Sort images, prioritizing personalized content and then recency
//             {
//               $sort: {
//                 isPersonalized: -1, // Show personalized content first
//                 createdAt: -1, // Sort by newest images when personalization is equal
//               },
//             },

//             // Stage 5: Pagination (skip and limit)
//             { $skip: skip },
//             { $limit: limit },

//             // Stage 6: Lookup user information for the image uploader
//             {
//               $lookup: {
//                 from: "users", // Join with the 'users' collection
//                 localField: "user", // Match the 'user' field from images
//                 foreignField: "_id", // Match with '_id' field in 'users' collection
//                 as: "userInfo", // Output array of matching user documents
//               },
//             },

//             // Stage 7: Unwind the user info array (since lookup returns an array)
//             { $unwind: "$userInfo" },

//             // Stage 8: Project the final structure of the returned images
//             {
//               $project: {
//                 _id: 0, // Exclude the default '_id' field
//                 publicId: 1, // Public identifier for the image
//                 url: 1, // Image URL
//                 createdAt: 1, // Image creation timestamp
//                 likes: 1, // Number of likes
//                 commentsCount: 1, // Number of comments
//                 tags: {
//                   // Transform tags to match the format returned by other endpoints
//                   $map: {
//                     input: "$tagObjects",
//                     as: "tagObj",
//                     in: {
//                       tag: "$$tagObj.tag", // Extract tag name
//                       publicId: "$$tagObj.publicId", // Use tag's public ID instead of MongoDB _id
//                     },
//                   },
//                 },
//                 user: {
//                   // Extract relevant user information using public IDs
//                   publicId: "$userInfo.publicId", // Use user's public ID instead of MongoDB _id
//                   username: "$userInfo.username",
//                   avatar: "$userInfo.avatar",
//                 },
//                 isPersonalized: 1, // Keep for debugging (optional)
//               },
//             },
//           ])
//           .exec(),

//         // Count total number of available images in the database
//         this.model.countDocuments({}),
//       ]);

//       // Calculate pagination details
//       const totalPages = Math.ceil(total / limit);
//       const currentPage = Math.floor(skip / limit) + 1;

//       // Return the paginated feed data
//       return {
//         data: results,
//         total,
//         page: currentPage,
//         limit,
//         totalPages,
//       };
//     } catch (error: any) {
//       console.error(error);
//       throw createError("DatabaseError", error.message);
//     }
//   }

//   /**
//    * Increment or decrement comment count for an image
//    */
//   async updateCommentCount(imageId: string, increment: number, session?: ClientSession): Promise<void> {
//     try {
//       const query = this.model.findByIdAndUpdate(imageId, { $inc: { commentsCount: increment } }, { session });
//       await query.exec();
//     } catch (error) {
//       throw createError("DatabaseError", (error as Error).message);
//     }
//   }

// I have feed service
// import { inject, injectable } from "tsyringe";
// import { ImageRepository } from "../repositories/image.repository";
// import { UserRepository } from "../repositories/user.repository";
// import { UserPreferenceRepository } from "../repositories/userPreference.repository";
// import { UserActionRepository } from "../repositories/userAction.repository";
// import { createError } from "../utils/errors";
// import { RedisService } from "./redis.service";
// import { IUser } from "../types";

// @injectable()
// export class FeedService {
//   constructor(
//     @inject("ImageRepository") private imageRepository: ImageRepository,
//     @inject("UserRepository") private userRepository: UserRepository,
//     @inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
//     @inject("UserActionRepository") private userActionRepository: UserActionRepository,
//     @inject("RedisService") private redisService: RedisService
//   ) {}

//   // TODO: Cache invalidation only invalidates the specific user's feed. When another user interacts
//   // with an image, the cache for all other users remains the same and they don't immediately see the update.
//   // Must deal with this shit.
//   public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<any> {
//     console.log(`Running getPersonalizedFeed for userId: ${userId} `);

//     try {
//       const cacheKey = `feed:${userId}:${page}:${limit}`;

//       // Check cache first
//       const cachedFeed = await this.redisService.get(cacheKey);
//       if (cachedFeed) {
//         console.log("Returning cached feed");
//         return cachedFeed;
//       }

//       //Using Promise.all to execute the operations concurrently and
//       // get the result once they've resolved or rejected
//       const [user, topTags] = await Promise.all([
//         this.userRepository.findByPublicId(userId),
//         this.userRepository
//           .findByPublicId(userId)
//           .then((user: IUser | null) => (user ? this.userPreferenceRepository.getTopUserTags(String(user._id)) : [])),
//       ]);

//       if (!user) {
//         throw createError("NotFoundError", "User not found");
//       }

//       const followingIds = user.following || [];
//       const favoriteTags = topTags.map((pref) => pref.tag);

//       const skip = (page - 1) * limit;
//       console.log(
//         `==================followingIds: ${followingIds}, favoriteTags: ${favoriteTags} \r\n =======================`
//       );
//       const feed = await this.imageRepository.getFeedForUser(followingIds, favoriteTags, limit, skip);

//       await this.redisService.set(cacheKey, feed, 120); // Cache feed for 2 minutes
//       return feed;
//     } catch (error) {
//       console.error(error);
//       const errorMessage =
//         typeof error === "object" && error !== null && "message" in error
//           ? (error as { message?: string }).message || "Unknown error"
//           : String(error);
//       throw createError("FeedError", errorMessage);
//     }
//   }

//   public async recordInteraction(
//     userPublicId: string,
//     actionType: string,
//     targetIdentifier: string,
//     tags: string[]
//   ): Promise<void> {
//     console.log(
//       `Running recordInteraction... for ${userPublicId}, actionType: ${actionType}, targetId: ${targetIdentifier}, tags: ${tags}`
//     );
//     // Resolve user internal id
//     const user = await this.userRepository.findByPublicId(userPublicId);
//     if (!user) throw createError("NotFoundError", "User not found");
//     // If action targets an image provided by publicId (may include extension), normalize
//     let internalTargetId = targetIdentifier;
//     if (actionType === "like" || actionType === "unlike") {
//       const sanitized = targetIdentifier.replace(/\.[a-z0-9]{2,5}$/i, "");
//       const image = await this.imageRepository.findByPublicId(sanitized);
//       if (image) internalTargetId = (image as any)._id.toString();
//     }
//     await this.userActionRepository.logAction(String(user._id), actionType, internalTargetId);

//     // Update tag preferences based on action type
//     let scoreIncrement = 0;
//     if (actionType === "like" || actionType === "unlike") {
//       scoreIncrement = this.getScoreIncrementForAction(actionType);
//     }

//     if (scoreIncrement !== 0) {
//       await Promise.all(
//         tags.map((tag) => this.userPreferenceRepository.incrementTagScore(String(user._id), tag, scoreIncrement))
//       );
//     }
//     console.log("Removing cache");
//     await this.redisService.del(`feed:${userPublicId}:*`);
//   }

//   private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
//     const scoreMap: Record<"like" | "unlike", number> = {
//       like: 2,
//       unlike: -2,
//     };
//     return scoreMap[actionType] ?? 0;
//   }
// }

// The problem is that when another user interacts with an image - comments, deletes it, uploads a new one, whatever - only their own feed's cache gets invalidated. Other users' feeds remain the same and return the same cache and they don't see the changes immediately. They need to wait for a while. Why is this? Am I pinnpointing the issue properly or is it something else?

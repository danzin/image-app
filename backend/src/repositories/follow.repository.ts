import mongoose, { Model, ClientSession } from "mongoose";
import { createError } from "@/utils/errors";
import { IFollow } from "@/types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class FollowRepository extends BaseRepository<IFollow> {
	constructor(@inject("FollowModel") model: Model<IFollow>) {
		super(model);
	}

	/**
	 * Checks if a user is following another user.
	 *
	 * @param {string} followerId - The internal MongoDB ID of the user who follows.
	 * @param {string} followeeId - The internal MongoDB ID of the user being followed.
	 * @returns {Promise<boolean>} - Returns `true` if the user is following, otherwise `false`.
	 */
	async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
		const existingFollow = await this.model.findOne({ followerId, followeeId });
		return !!existingFollow;
	}

	/**
	 * Checks if a user is following another user using public IDs.
	 *
	 * @param {string} followerPublicId - The public ID of the user who follows.
	 * @param {string} followeePublicId - The public ID of the user being followed.
	 * @returns {Promise<boolean>} - Returns `true` if the user is following, otherwise `false`.
	 */
	async isFollowingByPublicId(followerPublicId: string, followeePublicId: string): Promise<boolean> {
		try {
			// First, get the internal IDs from public IDs
			const [followerUser, followeeUser] = await Promise.all([
				this.model.db.collection("users").findOne({ publicId: followerPublicId }, { projection: { _id: 1 } }),
				this.model.db.collection("users").findOne({ publicId: followeePublicId }, { projection: { _id: 1 } }),
			]);

			if (!followerUser || !followeeUser) {
				return false; // One or both users don't exist
			}

			// Now check the follow relationship using internal IDs
			const existingFollow = await this.model.findOne({
				followerId: followerUser._id,
				followeeId: followeeUser._id,
			});

			return !!existingFollow;
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Creates a follow relationship between two users.
	 *
	 * @param {string} followerId - The internal MongoDB ID of the user who is following.
	 * @param {string} followeeId - The internal MongoDB ID of the user being followed.
	 * @param {mongoose.ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<IFollow>} - The newly created follow record.
	 * @throws {Error} - Throws a "DuplicateError" if the follow relationship already exists.
	 */
	async addFollow(followerId: string, followeeId: string, session?: mongoose.ClientSession): Promise<IFollow> {
		// Prevent duplicate follow relationships
		if (await this.isFollowing(followerId, followeeId)) {
			throw createError("DuplicateError", "Already following this user");
		}

		const follow = await this.model.create([{ followerId, followeeId }], { session });
		return follow[0];
	}

	/**
	 * Creates a follow relationship between two users using public IDs.
	 *
	 * @param {string} followerPublicId - The public ID of the user who is following.
	 * @param {string} followeePublicId - The public ID of the user being followed.
	 * @param {mongoose.ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<IFollow>} - The newly created follow record.
	 * @throws {Error} - Throws a "DuplicateError" if the follow relationship already exists.
	 */
	async addFollowByPublicId(
		followerPublicId: string,
		followeePublicId: string,
		session?: mongoose.ClientSession
	): Promise<IFollow> {
		try {
			// First, get the internal IDs from public IDs
			const [followerUser, followeeUser] = await Promise.all([
				// projection _id : 1  tells mongo to only return the _id field, everything else is exculded by default
				this.model.db.collection("users").findOne({ publicId: followerPublicId }, { projection: { _id: 1 } }),
				this.model.db.collection("users").findOne({ publicId: followeePublicId }, { projection: { _id: 1 } }),
			]);

			if (!followerUser || !followeeUser) {
				throw createError("NotFoundError", "One or both users not found");
			}

			const followerId = followerUser._id.toString();
			const followeeId = followeeUser._id.toString();

			// Prevent duplicate follow relationships
			if (await this.isFollowing(followerId, followeeId)) {
				throw createError("DuplicateError", "Already following this user");
			}

			const follow = await this.model.create([{ followerId, followeeId }], { session });
			return follow[0];
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Removes a follow relationship between two users.
	 *
	 * @param {string} followerId - The internal MongoDB ID of the user who is following.
	 * @param {string} followeeId - The internal MongoDB ID of the user being followed.
	 * @param {mongoose.ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<void>} - Resolves when the follow relationship is removed.
	 * @throws {Error} - Throws a "NotFoundError" if the follow relationship does not exist.
	 */
	async removeFollow(followerId: string, followeeId: string, session?: mongoose.ClientSession): Promise<void> {
		// Ensure that the follow relationship exists before attempting to remove it
		if (!(await this.isFollowing(followerId, followeeId))) {
			throw createError("NotFoundError", "Not following this user");
		}

		// Remove the follow relationship, optionally within a transaction
		await this.model.deleteOne({ followerId, followeeId }, { session });
	}

	/**
	 * Removes a follow relationship between two users using public IDs.
	 *
	 * @param {string} followerPublicId - The public ID of the user who is following.
	 * @param {string} followeePublicId - The public ID of the user being followed.
	 * @param {mongoose.ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<void>} - Resolves when the follow relationship is removed.
	 * @throws {Error} - Throws a "NotFoundError" if the follow relationship does not exist.
	 */
	async removeFollowByPublicId(
		followerPublicId: string,
		followeePublicId: string,
		session?: mongoose.ClientSession
	): Promise<void> {
		try {
			// First, get the internal IDs from public IDs
			const [followerUser, followeeUser] = await Promise.all([
				this.model.db.collection("users").findOne({ publicId: followerPublicId }, { projection: { _id: 1 } }),
				this.model.db.collection("users").findOne({ publicId: followeePublicId }, { projection: { _id: 1 } }),
			]);

			if (!followerUser || !followeeUser) {
				throw createError("NotFoundError", "One or both users not found");
			}

			const followerId = followerUser._id.toString();
			const followeeId = followeeUser._id.toString();

			// Ensure that the follow relationship exists before attempting to remove it
			if (!(await this.isFollowing(followerId, followeeId))) {
				throw createError("NotFoundError", "Not following this user");
			}

			// Remove the follow relationship, optionally within a transaction
			await this.model.deleteOne({ followerId, followeeId }, { session });
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	private normalizeId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
		if (id instanceof mongoose.Types.ObjectId) {
			return id;
		}
		return new mongoose.Types.ObjectId(id);
	}

	async countFollowersByUserId(
		userId: string | mongoose.Types.ObjectId,
		session?: mongoose.ClientSession
	): Promise<number> {
		const normalized = this.normalizeId(userId);
		const query = this.model.countDocuments({ followeeId: normalized });
		if (session) query.session(session);
		return await query.exec();
	}

	async countFollowingByUserId(
		userId: string | mongoose.Types.ObjectId,
		session?: mongoose.ClientSession
	): Promise<number> {
		const normalized = this.normalizeId(userId);
		const query = this.model.countDocuments({ followerId: normalized });
		if (session) query.session(session);
		return await query.exec();
	}

	async getFollowerObjectIds(userId: string | mongoose.Types.ObjectId): Promise<string[]> {
		const normalized = this.normalizeId(userId);
		const followers = await this.model.find({ followeeId: normalized }).select("followerId").lean().exec();
		return followers
			.map((doc: any) => doc?.followerId)
			.filter(Boolean)
			.map((id: mongoose.Types.ObjectId) => id.toString());
	}

	async getFollowerObjectIdsPaginated(
		userId: string | mongoose.Types.ObjectId,
		page: number,
		limit: number,
	): Promise<{ ids: string[]; total: number }> {
		const normalized = this.normalizeId(userId);
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.max(1, Math.floor(limit || 20));
		const skip = (safePage - 1) * safeLimit;

		const [followers, total] = await Promise.all([
			this.model.find({ followeeId: normalized }).select("followerId").skip(skip).limit(safeLimit).lean().exec(),
			this.model.countDocuments({ followeeId: normalized }).exec(),
		]);

		const ids = followers
			.map((doc: any) => doc?.followerId)
			.filter(Boolean)
			.map((id: mongoose.Types.ObjectId) => id.toString());

		return { ids, total };
	}

	async getFollowingObjectIds(userId: string | mongoose.Types.ObjectId): Promise<string[]> {
		const normalized = this.normalizeId(userId);
		const following = await this.model.find({ followerId: normalized }).select("followeeId").lean().exec();
		return following
			.map((doc: any) => doc?.followeeId)
			.filter(Boolean)
			.map((id: mongoose.Types.ObjectId) => id.toString());
	}

	async getFollowingObjectIdsPaginated(
		userId: string | mongoose.Types.ObjectId,
		page: number,
		limit: number,
	): Promise<{ ids: string[]; total: number }> {
		const normalized = this.normalizeId(userId);
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.max(1, Math.floor(limit || 20));
		const skip = (safePage - 1) * safeLimit;

		const [following, total] = await Promise.all([
			this.model.find({ followerId: normalized }).select("followeeId").skip(skip).limit(safeLimit).lean().exec(),
			this.model.countDocuments({ followerId: normalized }).exec(),
		]);

		const ids = following
			.map((doc: any) => doc?.followeeId)
			.filter(Boolean)
			.map((id: mongoose.Types.ObjectId) => id.toString());

		return { ids, total };
	}

	async getFollowerPublicIdsByPublicId(userPublicId: string): Promise<string[]> {
		const user = await this.model.db
			.collection("users")
			.findOne({ publicId: userPublicId }, { projection: { _id: 1 } });
		if (!user?._id) return [];

		const followers = await this.model
			.aggregate([
				{ $match: { followeeId: user._id } },
				{
					$lookup: {
						from: "users",
						localField: "followerId",
						foreignField: "_id",
						as: "follower",
					},
				},
				{ $unwind: "$follower" },
				{ $project: { publicId: "$follower.publicId" } },
			])
			.exec();

		return followers
			.map((doc: any) => doc?.publicId)
			.filter((value: unknown): value is string => typeof value === "string" && value.length > 0);
	}

	async deleteAllFollowsByUserId(userId: string, session?: ClientSession): Promise<number> {
		const userObjectId = this.normalizeId(userId);
		const result = await this.model
			.deleteMany({
				$or: [{ followerId: userObjectId }, { followeeId: userObjectId }],
			})
			.session(session || null)
			.exec();
		return result.deletedCount || 0;
	}
}

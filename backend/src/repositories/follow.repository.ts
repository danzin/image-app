import mongoose, { Model } from "mongoose";
import { createError } from "../utils/errors";
import { IFollow } from "../types";
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
}

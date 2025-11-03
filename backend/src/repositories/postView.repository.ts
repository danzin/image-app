import { injectable } from "tsyringe";
import { ClientSession, Types } from "mongoose";
import PostView from "../models/postView.model";
import { BaseRepository } from "./base.repository";
import { IPostView } from "../types";
import { createError } from "../utils/errors";

@injectable()
export class PostViewRepository extends BaseRepository<IPostView> {
	constructor() {
		super(PostView);
	}

	/**
	 * Record a view for a post by an authenticated user
	 * Returns true if a new view was recorded or false if user already viewed
	 */
	async recordView(postId: Types.ObjectId, userId: Types.ObjectId, session?: ClientSession): Promise<boolean> {
		try {
			const viewData: Partial<IPostView> = {
				post: postId,
				user: userId,
				viewedAt: new Date(),
			};

			await this.model.create([viewData], { session });
			return true; // new view recorded
		} catch (error: any) {
			// duplicate key error means user already viewed this post
			if (error.code === 11000) {
				return false; // already viewed
			}
			throw createError("DatabaseError", "Failed to record post view", { cause: error });
		}
	}

	/**
	 * Check if a user has viewed a post
	 */
	async hasViewed(postId: Types.ObjectId, userId: Types.ObjectId, session?: ClientSession): Promise<boolean> {
		try {
			const view = await this.model.findOne({ post: postId, user: userId }).session(session || null);
			return !!view;
		} catch (error: any) {
			throw createError("DatabaseError", "Failed to check post view", { cause: error });
		}
	}

	/**
	 * Get unique viewer count for a post
	 */
	async getUniqueViewerCount(postId: Types.ObjectId, session?: ClientSession): Promise<number> {
		try {
			return await this.model.countDocuments({ post: postId }).session(session || null);
		} catch (error: any) {
			throw createError("DatabaseError", "Failed to count post views", { cause: error });
		}
	}

	/**
	 * Delete all views for a post when post is deleted
	 */
	async deleteByPost(postId: Types.ObjectId, session?: ClientSession): Promise<void> {
		try {
			await this.model.deleteMany({ post: postId }).session(session || null);
		} catch (error: any) {
			throw createError("DatabaseError", "Failed to delete post views", { cause: error });
		}
	}
}

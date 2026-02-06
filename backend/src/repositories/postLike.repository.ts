import { ClientSession, Model, Types } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IPostLike } from "@/types";
import { createError } from "@/utils/errors";

@injectable()
export class PostLikeRepository extends BaseRepository<IPostLike> {
	constructor(@inject("PostLikeModel") model: Model<IPostLike>) {
		super(model);
	}

	async addLike(postId: string, userId: string, session?: ClientSession): Promise<boolean> {
		const payload = {
			postId: this.normalizeId(postId, "postId"),
			userId: this.normalizeId(userId, "userId"),
		};

		try {
			await this.model.create([payload], { session });
			return true;
		} catch (error: any) {
			if (error?.code === 11000) {
				return false;
			}
			throw createError("DatabaseError", error?.message ?? "failed to persist post like");
		}
	}

	async removeLike(postId: string, userId: string, session?: ClientSession): Promise<boolean> {
		const normalizedPostId = this.normalizeId(postId, "postId");
		const normalizedUserId = this.normalizeId(userId, "userId");
		const query = this.model.deleteOne({ postId: normalizedPostId, userId: normalizedUserId });
		if (session) query.session(session);
		const result = await query.exec();
		return (result.deletedCount ?? 0) > 0;
	}

	async hasUserLiked(postId: string, userId: string, session?: ClientSession): Promise<boolean> {
		const normalizedPostId = this.normalizeId(postId, "postId");
		const normalizedUserId = this.normalizeId(userId, "userId");
		const query = this.model.exists({ postId: normalizedPostId, userId: normalizedUserId });
		if (session) query.session(session);
		const exists = await query.exec();
		return Boolean(exists);
	}

	async removeLikesByUser(userId: string, session?: ClientSession): Promise<number> {
		const normalizedUserId = this.normalizeId(userId, "userId");
		const query = this.model.deleteMany({ userId: normalizedUserId });
		if (session) query.session(session);
		const result = await query.exec();
		return result.deletedCount ?? 0;
	}

	async removeLikesByPost(postId: string, session?: ClientSession): Promise<number> {
		const normalizedPostId = this.normalizeId(postId, "postId");
		const query = this.model.deleteMany({ postId: normalizedPostId });
		if (session) query.session(session);
		const result = await query.exec();
		return result.deletedCount ?? 0;
	}

	async countLikesByUser(userId: string, session?: ClientSession): Promise<number> {
		const normalizedUserId = this.normalizeId(userId, "userId");
		const query = this.model.countDocuments({ userId: normalizedUserId });
		if (session) query.session(session);
		return await query.exec();
	}

	async countLikesForPost(postId: string, session?: ClientSession): Promise<number> {
		const normalizedPostId = this.normalizeId(postId, "postId");
		const query = this.model.countDocuments({ postId: normalizedPostId });
		if (session) query.session(session);
		return await query.exec();
	}

	async findLikedPostIdsByUser(
		userId: string,
		page: number,
		limit: number,
		sortBy: string = "createdAt",
		sortOrder: "asc" | "desc" = "desc"
	): Promise<{ postIds: Types.ObjectId[]; total: number }> {
		const normalizedUserId = this.normalizeId(userId, "userId");
		const skip = (page - 1) * limit;

		const [likes, total] = await Promise.all([
			this.model
				.find({ userId: normalizedUserId })
				.sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
				.skip(skip)
				.limit(limit)
				.select("postId")
				.lean()
				.exec(),
			this.model.countDocuments({ userId: normalizedUserId }),
		]);

		return {
			postIds: likes.map((like) => like.postId as Types.ObjectId),
			total,
		};
	}

	private normalizeId(id: string | Types.ObjectId, field: string): Types.ObjectId {
		if (id instanceof Types.ObjectId) {
			return id;
		}
		try {
			return new Types.ObjectId(String(id));
		} catch {
			throw createError("ValidationError", `${field} is not a valid ObjectId`);
		}
	}
}

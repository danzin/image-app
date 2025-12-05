import { ClientSession, Model, Types } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { ICommentLike } from "../types";
import { createError } from "../utils/errors";

@injectable()
export class CommentLikeRepository extends BaseRepository<ICommentLike> {
	constructor(@inject("CommentLikeModel") model: Model<ICommentLike>) {
		super(model);
	}

	async addLike(commentId: string, userId: string, session?: ClientSession): Promise<boolean> {
		const payload = {
			commentId: this.normalizeId(commentId, "commentId"),
			userId: this.normalizeId(userId, "userId"),
		};

		try {
			await this.model.create([payload], { session });
			return true;
		} catch (error: any) {
			if (error?.code === 11000) {
				return false;
			}
			throw createError("DatabaseError", error?.message ?? "failed to persist comment like");
		}
	}

	async removeLike(commentId: string, userId: string, session?: ClientSession): Promise<boolean> {
		const normalizedCommentId = this.normalizeId(commentId, "commentId");
		const normalizedUserId = this.normalizeId(userId, "userId");
		const query = this.model.deleteOne({ commentId: normalizedCommentId, userId: normalizedUserId });
		if (session) query.session(session);
		const result = await query.exec();
		return (result.deletedCount ?? 0) > 0;
	}

	async hasUserLiked(commentId: string, userId: string, session?: ClientSession): Promise<boolean> {
		const normalizedCommentId = this.normalizeId(commentId, "commentId");
		const normalizedUserId = this.normalizeId(userId, "userId");
		const query = this.model.exists({ commentId: normalizedCommentId, userId: normalizedUserId });
		if (session) query.session(session);
		const exists = await query.exec();
		return Boolean(exists);
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

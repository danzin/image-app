import mongoose, { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { IPost } from "@/types";
import { IPostWriteRepository } from "../interfaces/IPostWriteRepository";
import { PostRepository } from "../post.repository";

/**
 * Write-only repository for post mutations
 * delegates to the existing PostRepository for now
 * command handlers use this for all write operations
 */
@injectable()
export class PostWriteRepository implements IPostWriteRepository {
	constructor(@inject("PostRepository") private readonly postRepository: PostRepository) {}

	async create(item: Partial<IPost>, session?: ClientSession): Promise<IPost> {
		return this.postRepository.create(item, session);
	}

	async update(id: string, item: Partial<IPost>, session?: ClientSession): Promise<IPost | null> {
		return this.postRepository.update(id, item, session);
	}

	async delete(id: string, session?: ClientSession): Promise<boolean> {
		return this.postRepository.delete(id, session);
	}

	async incrementViewCount(postId: mongoose.Types.ObjectId, session?: ClientSession): Promise<void> {
		return this.postRepository.incrementViewCount(postId, session);
	}

	async updateCommentCount(postId: string, increment: number, session?: ClientSession): Promise<void> {
		return this.postRepository.updateCommentCount(postId, increment, session);
	}

	async updateLikeCount(postId: string, increment: number, session?: ClientSession): Promise<void> {
		return this.postRepository.updateLikeCount(postId, increment, session);
	}

	async updateRepostCount(postId: string, increment: number, session?: ClientSession): Promise<void> {
		return this.postRepository.updateRepostCount(postId, increment, session);
	}

	async deleteManyByUserId(userId: string, session?: ClientSession): Promise<number> {
		return this.postRepository.deleteManyByUserId(userId, session);
	}

	async updateAuthorSnapshot(
		userObjectId: mongoose.Types.ObjectId,
		updates: {
			username?: string;
			avatarUrl?: string;
			displayName?: string;
			publicId?: string;
			handle?: string;
		}
	): Promise<number> {
		return this.postRepository.updateAuthorSnapshot(userObjectId, updates);
	}
}

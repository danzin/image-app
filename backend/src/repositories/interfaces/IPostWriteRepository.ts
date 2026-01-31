import mongoose, { ClientSession } from "mongoose";
import { IPost } from "@/types";

/**
 * Write-only repository interface for post mutations
 * used by command handlers in CQRS pattern
 */
export interface IPostWriteRepository {
	// CRUD operations
	create(item: Partial<IPost>, session?: ClientSession): Promise<IPost>;
	update(id: string, item: Partial<IPost>, session?: ClientSession): Promise<IPost | null>;
	delete(id: string, session?: ClientSession): Promise<boolean>;

	// counter updates
	incrementViewCount(postId: mongoose.Types.ObjectId, session?: ClientSession): Promise<void>;
	updateCommentCount(postId: string, increment: number, session?: ClientSession): Promise<void>;
	updateLikeCount(postId: string, increment: number, session?: ClientSession): Promise<void>;
	updateRepostCount(postId: string, increment: number, session?: ClientSession): Promise<void>;

	// bulk operations
	deleteManyByUserId(userId: string, session?: ClientSession): Promise<number>;

	// author snapshot sync
	updateAuthorSnapshot(
		userObjectId: mongoose.Types.ObjectId,
		updates: {
			username?: string;
			avatarUrl?: string;
			displayName?: string;
			publicId?: string;
		}
	): Promise<number>;
}

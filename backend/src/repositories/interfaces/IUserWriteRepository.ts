import { ClientSession } from "mongoose";
import { IUser } from "@/types";

/**
 * Write-only repository interface for user mutations
 * used by command handlers in CQRS pattern
 */
export interface IUserWriteRepository {
	// CRUD operations
	create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser>;
	update(id: string, updateData: any, session?: ClientSession): Promise<IUser | null>;
	delete(id: string, session?: ClientSession): Promise<boolean>;

	// profile updates
	updateAvatar(userId: string, avatarUrl: string, session?: ClientSession): Promise<void>;
	updateCover(userId: string, coverUrl: string, session?: ClientSession): Promise<void>;

	// counter updates
	updateFollowerCount(userId: string, increment: number, session?: ClientSession): Promise<void>;
	updateFollowingCount(userId: string, increment: number, session?: ClientSession): Promise<void>;
}

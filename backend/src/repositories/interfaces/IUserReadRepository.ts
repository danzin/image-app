import { ClientSession } from "mongoose";
import { IUser, PaginationOptions, PaginationResult } from "@/types";

/**
 * Read-only repository interface for user queries
 * used by query handlers in CQRS pattern
 */
export interface IUserReadRepository {
	// single user lookups
	findById(id: string, session?: ClientSession): Promise<IUser | null>;
	findByPublicId(publicId: string, session?: ClientSession): Promise<IUser | null>;
	findInternalIdByPublicId(publicId: string): Promise<string | null>;
	findByUsername(username: string, session?: ClientSession): Promise<IUser | null>;
	findByEmail(email: string, session?: ClientSession): Promise<IUser | null>;
	findByResetToken(token: string, session?: ClientSession): Promise<IUser | null>;
	findByEmailVerificationToken(email: string, token: string, session?: ClientSession): Promise<IUser | null>;

	// batch lookups
	findUsersByPublicIds(userPublicIds: string[]): Promise<IUser[]>;
	findUsersByUsernames(usernames: string[]): Promise<IUser[]>;
	findUsersFollowing(userPublicId: string): Promise<IUser[]>;

	// paginated queries
	getAll(options: { search?: string[]; page?: number; limit?: number }): Promise<IUser[] | null>;
	findWithPagination(options: PaginationOptions): Promise<PaginationResult<IUser>>;

	// counts
	countDocuments(filter: Record<string, unknown>): Promise<number>;

	// suggestions and recommendations
	getSuggestedUsersToFollow(currentUserId: string, limit?: number): Promise<any[]>;
	getSuggestedUsersLowTraffic(
		currentUserId: string,
		limit?: number,
		recentlyActiveUserPublicIds?: string[],
	): Promise<any[]>;
	getSuggestedUsersHighTraffic(currentUserId: string, limit?: number): Promise<any[]>;
}

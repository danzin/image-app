import { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { IUser, PaginationOptions, PaginationResult } from "../../types";
import { IUserReadRepository } from "../interfaces/IUserReadRepository";
import { UserRepository } from "../user.repository";

/**
 * Read-only repository for user queries
 * delegates to the existing UserRepository for now
 * can be pointed to a read replica connection in the future
 */
@injectable()
export class UserReadRepository implements IUserReadRepository {
	constructor(@inject("UserRepository") private readonly userRepository: UserRepository) {}

	async findById(id: string, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.findById(id, session);
	}

	async findByPublicId(publicId: string, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.findByPublicId(publicId, session);
	}

	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		return this.userRepository.findInternalIdByPublicId(publicId);
	}

	async findByUsername(username: string, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.findByUsername(username, session);
	}

	async findByEmail(email: string, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.findByEmail(email, session);
	}

	async findByResetToken(token: string, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.findByResetToken(token, session);
	}

	async findByEmailVerificationToken(email: string, token: string, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.findByEmailVerificationToken(email, token, session);
	}

	async findUsersByPublicIds(userPublicIds: string[]): Promise<IUser[]> {
		return this.userRepository.findUsersByPublicIds(userPublicIds);
	}

	async findUsersByUsernames(usernames: string[]): Promise<IUser[]> {
		return this.userRepository.findUsersByUsernames(usernames);
	}

	async findUsersFollowing(userPublicId: string): Promise<IUser[]> {
		return this.userRepository.findUsersFollowing(userPublicId);
	}

	async getAll(options: { search?: string[]; page?: number; limit?: number }): Promise<IUser[] | null> {
		return this.userRepository.getAll(options);
	}

	async findWithPagination(options: PaginationOptions): Promise<PaginationResult<IUser>> {
		return this.userRepository.findWithPagination(options);
	}

	async countDocuments(filter: Record<string, unknown>): Promise<number> {
		return this.userRepository.countDocuments(filter);
	}

	async getSuggestedUsersToFollow(currentUserId: string, limit?: number): Promise<any[]> {
		return this.userRepository.getSuggestedUsersToFollow(currentUserId, limit);
	}

	async getSuggestedUsersLowTraffic(
		currentUserId: string,
		limit?: number,
		recentlyActiveUserPublicIds?: string[],
	): Promise<any[]> {
		return this.userRepository.getSuggestedUsersLowTraffic(currentUserId, limit, recentlyActiveUserPublicIds);
	}

	async getSuggestedUsersHighTraffic(currentUserId: string, limit?: number): Promise<any[]> {
		return this.userRepository.getSuggestedUsersHighTraffic(currentUserId, limit);
	}
}

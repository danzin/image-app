import { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { IUser } from "../../types";
import { IUserWriteRepository } from "../interfaces/IUserWriteRepository";
import { UserRepository } from "../user.repository";

/**
 * Write-only repository for user mutations
 * delegates to the existing UserRepository for now
 * command handlers use this for all write operations
 */
@injectable()
export class UserWriteRepository implements IUserWriteRepository {
	constructor(@inject("UserRepository") private readonly userRepository: UserRepository) {}

	async create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser> {
		return this.userRepository.create(userData, session);
	}

	async update(id: string, updateData: any, session?: ClientSession): Promise<IUser | null> {
		return this.userRepository.update(id, updateData, session);
	}

	async delete(id: string, session?: ClientSession): Promise<boolean> {
		return this.userRepository.delete(id, session);
	}

	async updateAvatar(userId: string, avatarUrl: string, session?: ClientSession): Promise<void> {
		return this.userRepository.updateAvatar(userId, avatarUrl, session);
	}

	async updateCover(userId: string, coverUrl: string, session?: ClientSession): Promise<void> {
		return this.userRepository.updateCover(userId, coverUrl, session);
	}

	async updateFollowerCount(userId: string, increment: number, session?: ClientSession): Promise<void> {
		return this.userRepository.updateFollowerCount(userId, increment, session);
	}

	async updateFollowingCount(userId: string, increment: number, session?: ClientSession): Promise<void> {
		return this.userRepository.updateFollowingCount(userId, increment, session);
	}
}

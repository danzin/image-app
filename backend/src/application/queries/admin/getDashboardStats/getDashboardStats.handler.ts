import { inject, injectable } from "tsyringe";
import { GetDashboardStatsQuery } from "./getDashboardStats.query";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { UserRepository } from "../../../../repositories/user.repository";
import { ImageRepository } from "../../../../repositories/image.repository";

export interface DashboardStatsResult {
	totalUsers: number;
	totalImages: number;
	bannedUsers: number;
	adminUsers: number;
	recentUsers: number;
	recentImages: number;
	growthRate: {
		users: number;
		images: number;
	};
}

@injectable()
export class GetDashboardStatsQueryHandler implements IQueryHandler<GetDashboardStatsQuery, DashboardStatsResult> {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository
	) {}

	async execute(_query: GetDashboardStatsQuery): Promise<DashboardStatsResult> {
		const [totalUsers, totalImages, bannedUsers, adminUsers, recentUsers, recentImages] = await Promise.all([
			this.userRepository.countDocuments({}),
			this.imageRepository.countDocuments({}),
			this.userRepository.countDocuments({ isBanned: true }),
			this.userRepository.countDocuments({ isAdmin: true }),
			this.userRepository.countDocuments({
				createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
			}),
			this.imageRepository.countDocuments({
				createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
			}),
		]);

		return {
			totalUsers,
			totalImages,
			bannedUsers,
			adminUsers,
			recentUsers,
			recentImages,
			growthRate: {
				users: recentUsers,
				images: recentImages,
			},
		};
	}
}

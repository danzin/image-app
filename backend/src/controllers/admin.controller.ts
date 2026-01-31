import { Request, Response, NextFunction } from "express";
import { injectable, inject } from "tsyringe";
import { createError } from "@/utils/errors";
import { CommandBus } from "@/application/common/buses/command.bus";
import { QueryBus } from "@/application/common/buses/query.bus";
import { DeletePostCommand } from "@/application/commands/post/deletePost/deletePost.command";
import { DeleteUserCommand } from "@/application/commands/users/deleteUser/deleteUser.command";
import { GetAllPostsAdminQuery } from "@/application/queries/post/getAllPostsAdmin/getAllPostsAdmin.query";
import { GetDashboardStatsQuery } from "@/application/queries/admin/getDashboardStats/getDashboardStats.query";
import { DashboardStatsResult } from "@/application/queries/admin/getDashboardStats/getDashboardStats.handler";
import { PaginationResult, PostDTO } from "@/types";
import { GetAllUsersAdminQuery } from "@/application/queries/admin/getAllUsersAdmin/getAllUsersAdmin.query";
import { GetAdminUserProfileQuery } from "@/application/queries/admin/getAdminUserProfile/getAdminUserProfile.query";
import { GetUserStatsQuery } from "@/application/queries/admin/getUserStats/getUserStats.query";
import { GetRecentActivityQuery } from "@/application/queries/admin/getRecentActivity/getRecentActivity.query";
import { GetRequestLogsQuery } from "@/application/queries/admin/getRequestLogs/getRequestLogs.query";
import { BanUserCommand } from "@/application/commands/admin/banUser/banUser.command";
import { UnbanUserCommand } from "@/application/commands/admin/unbanUser/unbanUser.command";
import { PromoteToAdminCommand } from "@/application/commands/admin/promoteToAdmin/promoteToAdmin.command";
import { DemoteFromAdminCommand } from "@/application/commands/admin/demoteFromAdmin/demoteFromAdmin.command";
import { AdminUserDTO } from "@/services/dto.service";
import { RedisService } from "@/services/redis.service";

@injectable()
export class AdminUserController {
	constructor(
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus,
		@inject("RedisService") private readonly redisService: RedisService
	) {}

	getAllUsersAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit, sortBy, sortOrder } = req.query;
			const options = {
				page: page ? parseInt(page as string, 10) : 1,
				limit: limit ? parseInt(limit as string, 10) : 20,
				sortBy: sortBy as string | undefined,
				sortOrder: sortOrder as "asc" | "desc" | undefined,
			};
			const query = new GetAllUsersAdminQuery(options);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const query = new GetAdminUserProfileQuery(publicId);
			const adminDTO = await this.queryBus.execute<AdminUserDTO>(query);
			res.status(200).json(adminDTO);
		} catch (error) {
			next(error);
		}
	};

	getUserStats = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const query = new GetUserStatsQuery(publicId);
			const stats = await this.queryBus.execute(query);
			res.status(200).json(stats);
		} catch (error) {
			next(error);
		}
	};

	deleteUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const command = new DeleteUserCommand(publicId);
			await this.commandBus.dispatch(command);
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	banUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { publicId } = req.params;
			const { reason } = req.body;

			if (!reason || reason.trim() === "") {
				throw createError("ValidationError", "Ban reason is required");
			}
			if (!decodedUser) {
				throw createError("ValidationError", "Admin user is required");
			}

			if (!(decodedUser as any).publicId) {
				throw createError("ValidationError", "Admin publicId missing in token");
			}
			const command = new BanUserCommand(publicId, (decodedUser as any).publicId, reason);
			const result = await this.commandBus.dispatch<AdminUserDTO>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	unbanUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const command = new UnbanUserCommand(publicId);
			const result = await this.commandBus.dispatch<AdminUserDTO>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	// === IMAGE MANAGEMENT ===
	getAllImages = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit, sortBy, sortOrder } = req.query;
			const options = {
				page: page ? parseInt(page as string, 10) : 1,
				limit: limit ? parseInt(limit as string, 10) : 10,
				sortBy: sortBy as string | undefined,
				sortOrder: sortOrder as "asc" | "desc" | undefined,
			};
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(
				new GetAllPostsAdminQuery(options.page, options.limit, options.sortBy, options.sortOrder)
			);
			res.status(200).json(posts);
		} catch (error) {
			next(error);
		}
	};

	deleteImage = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const { decodedUser } = req;

			if (!decodedUser || !(decodedUser as any).publicId) {
				throw createError("AuthenticationError", "Admin user not found");
			}

			await this.commandBus.dispatch(new DeletePostCommand(publicId, (decodedUser as any).publicId));
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	// === DASHBOARD STATS ===
	getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const stats = await this.queryBus.execute<DashboardStatsResult>(new GetDashboardStatsQuery());
			res.status(200).json(stats);
		} catch (error) {
			next(error);
		}
	};

	// === RECENT ACTIVITY ===
	getRecentActivity = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit } = req.query;
			const options = {
				page: page ? parseInt(page as string, 10) : 1,
				limit: limit ? parseInt(limit as string, 10) : 10,
			};
			const query = new GetRecentActivityQuery(options);
			const activity = await this.queryBus.execute(query);
			res.status(200).json(activity);
		} catch (error) {
			next(error);
		}
	};

	// === PROMOTE/DEMOTE ADMIN ===
	promoteToAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const command = new PromoteToAdminCommand(publicId);
			const result = await this.commandBus.dispatch<AdminUserDTO>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	demoteFromAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const command = new DemoteFromAdminCommand(publicId);
			const result = await this.commandBus.dispatch<AdminUserDTO>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	// === CACHE MANAGEMENT ===
	clearCache = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { pattern } = req.query;
			const patternToDelete = (pattern as string) || "all_feeds";

			let deletedCount = 0;

			if (patternToDelete === "all_feeds") {
				// clear all feed-related cache patterns
				const patterns = ["core_feed:*", "for_you_feed:*", "trending_feed:*", "new_feed:*", "tag:*", "key_tags:*"];

				for (const p of patterns) {
					deletedCount += await this.redisService.del(p);
				}
			} else {
				deletedCount = await this.redisService.del(patternToDelete);
			}

			res.status(200).json({
				message: "Cache cleared successfully",
				pattern: patternToDelete,
				deletedKeys: deletedCount,
			});
		} catch (error) {
			next(error);
		}
	};

	// === REQUEST LOGS ===
	getRequestLogs = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit, userId, statusCode, startDate, endDate } = req.query;
			const options = {
				page: page ? parseInt(page as string, 10) : 1,
				limit: limit ? parseInt(limit as string, 10) : 50,
				userId: userId as string | undefined,
				statusCode: statusCode ? parseInt(statusCode as string, 10) : undefined,
				startDate: startDate ? new Date(startDate as string) : undefined,
				endDate: endDate ? new Date(endDate as string) : undefined,
			};
			const query = new GetRequestLogsQuery(options);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};
}

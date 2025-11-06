import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { injectable, inject } from "tsyringe";
import { createError } from "../utils/errors";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { DeletePostCommand } from "../application/commands/post/deletePost/deletePost.command";
import { DeleteUserCommand } from "../application/commands/users/deleteUser/deleteUser.command";
import { GetPostsQuery } from "../application/queries/post/getPosts/getPosts.query";
import { PaginationResult, PostDTO } from "../types";

@injectable()
export class AdminUserController {
	constructor(
		@inject("UserService") private readonly userService: UserService,
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus
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
			const result = await this.userService.getAllUsersAdmin(options);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const adminDTO = await this.userService.getAdminUserProfile(publicId);
			res.status(200).json(adminDTO);
		} catch (error) {
			next(error);
		}
	};

	getUserStats = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const stats = await this.userService.getUserStatsByPublicId(publicId);
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
			const result = await this.userService.banUserByPublicId(publicId, (decodedUser as any).publicId, reason);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	unbanUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const result = await this.userService.unbanUserByPublicId(publicId);
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
				limit: limit ? parseInt(limit as string, 10) : 20,
				sortBy: sortBy as string | undefined,
				sortOrder: sortOrder as "asc" | "desc" | undefined,
			};
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(
				new GetPostsQuery(options.page, options.limit)
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
			const stats = await this.userService.getDashboardStats();
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
			const activity = await this.userService.getRecentActivity(options);
			res.status(200).json(activity);
		} catch (error) {
			next(error);
		}
	};

	// === PROMOTE/DEMOTE ADMIN ===
	promoteToAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const result = await this.userService.promoteToAdminByPublicId(publicId);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	demoteFromAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params;
			const result = await this.userService.demoteFromAdminByPublicId(publicId);
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

			// use Redis service to clear cache
			const RedisService = (await import("../services/redis.service")).RedisService;
			const redis = new RedisService();

			let deletedCount = 0;

			if (patternToDelete === "all_feeds") {
				// clear all feed-related cache patterns
				const patterns = ["core_feed:*", "for_you_feed:*", "trending_feed:*", "new_feed:*", "tag:*", "key_tags:*"];

				for (const p of patterns) {
					deletedCount += await redis.del(p);
				}
			} else {
				deletedCount = await redis.del(patternToDelete);
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
}

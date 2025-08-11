import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { injectable, inject } from "tsyringe";
import { ImageService } from "../services/image.service";
import { IUser } from "../types";
import { createError } from "../utils/errors";

@injectable()
export class AdminUserController {
	constructor(
		@inject("UserService") private readonly userService: UserService,
		@inject("ImageService") private readonly imageService: ImageService
	) {}

	// === USER MANAGEMENT ===
	getAllUsersAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const options = { ...req.query } as any;
			const result = await this.userService.getAllUsersAdmin(options);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { id } = req.params;
			const result = await this.userService.getUserById(id, decodedUser as IUser);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getUserStats = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id } = req.params;
			const stats = await this.userService.getUserStats(id);
			res.status(200).json(stats);
		} catch (error) {
			next(error);
		}
	};

	deleteUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			await this.userService.deleteUser(req.params.id);
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	// === USER BANNING ===
	banUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { id } = req.params;
			const { reason } = req.body;

			if (!reason || reason.trim() === "") {
				throw createError("ValidationError", "Ban reason is required");
			}

			if (!decodedUser || !decodedUser.id) {
				throw createError("ValidationError", "User ID is required");
			}

			const result = await this.userService.banUser(id, decodedUser.id, reason);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	unbanUser = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id } = req.params;
			const result = await this.userService.unbanUser(id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	// === IMAGE MANAGEMENT ===
	getAllImages = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const options = { ...req.query } as any;
			const result = await this.imageService.getAllImagesAdmin(options);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	deleteImage = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id } = req.params;
			await this.imageService.deleteImage(id);
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
			const options = { ...req.query } as any;
			const activity = await this.userService.getRecentActivity(options);
			res.status(200).json(activity);
		} catch (error) {
			next(error);
		}
	};

	// === PROMOTE/DEMOTE ADMIN ===
	promoteToAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id } = req.params;
			const result = await this.userService.promoteToAdmin(id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	demoteFromAdmin = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id } = req.params;
			const result = await this.userService.demoteFromAdmin(id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};
}

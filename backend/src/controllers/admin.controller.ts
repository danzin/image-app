import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { injectable, inject } from "tsyringe";
import { ImageService } from "../services/image.service";
import { createError } from "../utils/errors";
import { DTOService } from "../services/dto.service";

@injectable()
export class AdminUserController {
	constructor(
		@inject("UserService") private readonly userService: UserService,
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

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
			const { publicId } = req.params;
			const user = await this.userService.getUserByPublicId(publicId);

			const adminDTO = this.dtoService.toAdminDTO(user);
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
			await this.userService.deleteUserByPublicId(publicId);
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
			const options = { ...req.query } as any;
			const result = await this.imageService.getAllImagesAdmin(options);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	deleteImage = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId } = req.params; // ✅ Use publicId
			await this.imageService.deleteImage(publicId);
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
}

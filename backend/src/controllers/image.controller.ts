import { Request, Response, NextFunction } from "express";
import { ImageService } from "../services/image.service";
import { UserService } from "../services/user.service";
import { DTOService } from "../services/dto.service";
import { createError } from "../utils/errors";
import { errorLogger } from "../utils/winston";
import { inject, injectable } from "tsyringe";

/**
 * When using Dependency Injection in Express, there's a common
 * issue with route handles and `this` binding. When Express calls the route handlers,
 * it changes the context of `this`. So when I initialize the dependncy inside the constructor
 * like this.userService = userService, `this` context is lost and this.userService is undefined.
 *
 * 2 possible fixes:
 *  1 - manually bind all methods that will be used as route handlers:
 *     - this.register = this.register.bind(this);
 *     - etc etc, for every single method
 *  2 - user arrow functions, which automatically bind `this` and it doesn't get lost.
 */

@injectable()
export class ImageController {
	constructor(
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("UserService") private readonly userService: UserService,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser, file } = req;

			console.log(req.body.tags);
			const tags = JSON.parse(req.body.tags);

			if (!file) {
				throw createError("ValidationError", "No file uploaded");
			}

			if (!decodedUser || !decodedUser.id) {
				throw createError("AuthenticationError", "User information missing");
			}

			const result = await this.imageService.uploadImage(decodedUser.id, file.buffer, tags);
			res.status(201).json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 9;
		try {
			const images = await this.imageService.getImages(page, limit);
			res.header("Access-Control-Allow-Origin", "http://localhost:5173"); //specific origin
			res.header("Access-Control-Allow-Credentials", "true"); //allow credentials
			res.json(images);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getUserImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const { id } = req.params;

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		console.log("ID of getUserImages: ", id);
		try {
			const images = await this.imageService.getUserImages(id, page, limit);
			console.log(`images of user ${id}: ${images}`);
			res.json(images);
		} catch (error) {
			if (error instanceof Error) {
				errorLogger.error(error.stack);
			} else {
				errorLogger.error("Unknown error occurred");
			}
			next(createError("UnknownError", "Failed to fetch images"));
		}
	};

	getImageById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { id } = req.params;
			const result = await this.imageService.getImageById(id);
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	async getImageBySlug(req: Request, res: Response): Promise<void> {
		try {
			const { slug } = req.params;
			const image = await this.imageService.getImageBySlug(slug);

			// Convert to DTO before sending
			const imageDTO = this.dtoService.toPublicImageDTO(image, req.decodedUser?.id);

			res.status(200).json(imageDTO);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: errorMessage });
		}
	}

	async getUserImagesByUsername(req: Request, res: Response): Promise<void> {
		try {
			const { username } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			// First get user by username to get their publicId
			const user = await this.userService.getUserByUsername(username);
			const images = await this.imageService.getUserImagesByPublicId(user.publicId, page, limit);

			// Convert to DTOs
			const imagesDTOs = {
				...images,
				data: images.data.map((img) => this.dtoService.toPublicImageDTO(img, req.decodedUser?.id)),
			};

			res.status(200).json(imagesDTOs);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: errorMessage });
		}
	}

	searchByTags = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { tags } = req.query;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;
			console.log("tags in the controller:", tags);
			// Will leave empty tags allowed for now
			const tagArray = tags ? (tags as string).split(",").filter((tag) => tag.trim() !== "") : [];
			console.log(tagArray);
			// Call the service method
			const result = await this.imageService.searchByTags(tagArray, page, limit);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { id } = req.params;
			const result = await this.imageService.deleteImage(id);
			res.status(200).json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getTags = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const result = await this.imageService.getTags();
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	deleteImageByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.id) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const result = await this.imageService.deleteImageByPublicId(publicId, decodedUser.id);
			res.status(200).json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};
}

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

			console.log("=== IMAGE UPLOAD DEBUG ===");
			console.log("File object:", file);
			console.log("File originalname:", file?.originalname);
			console.log("Request body:", req.body);
			console.log("Tags:", req.body.tags);

			const tags = JSON.parse(req.body.tags);

			if (!file) {
				throw createError("ValidationError", "No file uploaded");
			}

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			// Extract original filename or use a default name
			const originalName = file.originalname || `image-${Date.now()}`;
			console.log("Using originalName:", originalName);

			const result = await this.imageService.uploadImage(decodedUser.publicId, file.buffer, tags, originalName);
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
			res.json(images);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getUserImagesByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const { publicId } = req.params;

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		console.log("ID of getUserImages: ", publicId);
		try {
			const images = await this.imageService.getUserImages(publicId, page, limit);
			console.log(`images of user ${publicId}: ${images}`);
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

	getImageBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { slug } = req.params;
			const viewerPublicId = req.decodedUser?.publicId;
			console.log(`[IMAGE CONTROLLER] getImageBySlug called with slug: ${slug}, viewerPublicId: ${viewerPublicId}`);

			// Sanitize slug: remove optional file extension if present (e.g., ".png", ".jpg")
			const sanitizedSlug = slug.replace(/\.[a-z0-9]{2,5}$/i, "");
			// If the slug looks like a UUID (publicId), fetch by publicId instead
			const looksLikeUUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedSlug);
			console.log(`[IMAGE CONTROLLER] Sanitized slug: ${sanitizedSlug}, looks like UUID: ${looksLikeUUIDv4}`);

			const image = looksLikeUUIDv4
				? await this.imageService.getImageByPublicId(sanitizedSlug, viewerPublicId)
				: await this.imageService.getImageBySlug(sanitizedSlug, viewerPublicId);
			const imageDTO = this.dtoService.toPublicImageDTO(image, viewerPublicId);
			console.log(`[IMAGE CONTROLLER] Returning imageDTO with isLikedByViewer: ${imageDTO.isLikedByViewer}`);

			res.status(200).json(imageDTO);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", String(error)));
			}
		}
	};

	getUserImagesByUsername = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { username } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const user = await this.userService.getUserByUsername(username);
			const images = await this.imageService.getUserImagesByPublicId(user.publicId, page, limit);

			const imagesDTOs = {
				...images,
				data: images.data.map((img) => this.dtoService.toPublicImageDTO(img, req.decodedUser?.publicId)),
			};

			res.status(200).json(imagesDTOs);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", String(error)));
			}
		}
	};

	getImageByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const image = await this.imageService.getImageByPublicId(publicId);
			const imageDTO = this.dtoService.toPublicImageDTO(image, req.decodedUser?.publicId);
			res.status(200).json(imageDTO);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", String(error)));
			}
		}
	};

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

			if (!decodedUser || !decodedUser.publicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}
			const result = await this.imageService.deleteImageByPublicId(publicId, decodedUser.publicId);
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

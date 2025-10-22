import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { PostService } from "../services/post.service";
import { UserService } from "../services/user.service";
import { DTOService } from "../services/dto.service";
import { createError } from "../utils/errors";
import { errorLogger } from "../utils/winston";

@injectable()
export class PostController {
	constructor(
		@inject("PostService") private readonly postService: PostService,
		@inject("UserService") private readonly userService: UserService,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser, file } = req;

			let tags: string[] = [];
			try {
				tags = req.body.tags ? JSON.parse(req.body.tags) : [];
			} catch {
				throw createError("ValidationError", "Tags payload must be valid JSON");
			}

			const bodyText = typeof req.body.body === "string" ? req.body.body : req.body.caption;
			if (!file && (!bodyText || bodyText.trim().length === 0)) {
				throw createError("ValidationError", "Provide either an image or body text");
			}

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const originalName = file?.originalname || `post-${Date.now()}`;
			const post = await this.postService.createPost({
				userPublicId: decodedUser.publicId,
				body: bodyText,
				tags,
				image: file
					? {
							buffer: file.buffer,
							originalName,
						}
					: undefined,
			});
			const dto = this.dtoService.toPublicPostDTO(post);
			res.status(201).json(dto);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	listPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 9;
		try {
			const posts = await this.postService.getPosts(page, limit);
			res.json({
				...posts,
				data: posts.data.map((post) => this.dtoService.toPublicPostDTO(post)),
			});
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getPostsByUserPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const { publicId } = req.params;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		try {
			const posts = await this.postService.getPostsByUserPublicId(publicId, page, limit);
			res.json({
				...posts,
				data: posts.data.map((post) => this.dtoService.toPublicPostDTO(post)),
			});
		} catch (error) {
			if (error instanceof Error) {
				errorLogger.error(error.stack);
			} else {
				errorLogger.error("Unknown error occurred");
			}
			next(createError("UnknownError", "Failed to fetch posts"));
		}
	};

	getPostsByUsername = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { username } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const user = await this.userService.getUserByUsername(username);
			const posts = await this.postService.getPostsByUserPublicId(user.publicId, page, limit);

			res.status(200).json({
				...posts,
				data: posts.data.map((post) => this.dtoService.toPublicPostDTO(post)),
			});
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", String(error)));
			}
		}
	};

	getPostBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { slug } = req.params;
			const sanitizedSlug = slug.replace(/\.[a-z0-9]{2,5}$/i, "");
			const looksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedSlug);
			const post = looksLikeUUID
				? await this.postService.getPostByPublicId(sanitizedSlug)
				: await this.postService.getPostBySlug(sanitizedSlug);
			const dto = this.dtoService.toPublicPostDTO(post);
			res.status(200).json(dto);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", String(error)));
			}
		}
	};

	getPostByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const viewerPublicId = req.decodedUser?.publicId; // Get viewer's publicId if logged in
			// Strip file extension if present (e.g., "abc-123.png" -> "abc-123")
			const sanitizedPublicId = publicId.replace(/\.[a-z0-9]{2,5}$/i, "");
			const post = await this.postService.getPostByPublicId(sanitizedPublicId, viewerPublicId);
			const dto = this.dtoService.toPublicPostDTO(post);
			res.status(200).json(dto);
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
			const tagArray = tags ? (tags as string).split(",").filter((tag) => tag.trim() !== "") : [];
			const result = await this.postService.searchByTags(tagArray, page, limit);
			res.status(200).json({
				...result,
				data: result.data.map((post) => this.dtoService.toPublicPostDTO(post)),
			});
		} catch (error) {
			next(error);
		}
	};

	listTags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const result = await this.postService.getTags();
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	deletePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.publicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const sanitizedPublicId = publicId.replace(/\.[a-z0-9]{2,5}$/i, "");
			const result = await this.postService.deletePostByPublicId(sanitizedPublicId, decodedUser.publicId);
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

import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { UserService } from "../services/user.service";
import { DTOService } from "../services/dto.service";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { CreatePostCommand } from "../application/commands/post/createPost/createPost.command";
import { DeletePostCommand } from "../application/commands/post/deletePost/deletePost.command";
import { RecordPostViewCommand } from "../application/commands/post/recordPostView/recordPostView.command";
import { GetPostByPublicIdQuery } from "../application/queries/post/getPostByPublicId/getPostByPublicId.query";
import { GetPostBySlugQuery } from "../application/queries/post/getPostBySlug/getPostBySlug.query";
import { GetPostsQuery } from "../application/queries/post/getPosts/getPosts.query";
import { GetPostsByUserQuery } from "../application/queries/post/getPostsByUser/getPostsByUser.query";
import { SearchPostsByTagsQuery } from "../application/queries/post/searchPostsByTags/searchPostsByTags.query";
import { GetAllTagsQuery } from "../application/queries/tags/getAllTags/getAllTags.query";
import { createError } from "../utils/errors";
import { errorLogger } from "../utils/winston";
import { PostDTO, PaginationResult, ITag } from "../types";
import { safeFireAndForget } from "../utils/helpers";

@injectable()
export class PostController {
	constructor(
		@inject("UserService") private readonly userService: UserService,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus
	) {}

	createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser, file } = req;

			// Zod validation middleware has already processed and validated req.body
			const bodyText = req.body.body;

			if (!file && (!bodyText || bodyText.trim().length === 0)) {
				throw createError("ValidationError", "Provide either an image or body text");
			}

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const originalName = file?.originalname || `post-${Date.now()}`;
			const post = (await this.commandBus.dispatch(
				new CreatePostCommand(decodedUser.publicId, bodyText, undefined, file?.buffer, originalName)
			)) as PostDTO;
			const dto = this.dtoService.toPostDTO(post);
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

		// Get authenticated user's publicId if available
		const userId = (req as any).decodedUser?.publicId;
		console.log("listPosts called with page:", page, "limit:", limit, "userId:", userId);
		try {
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(new GetPostsQuery(page, limit, userId));
			res.json({
				...posts,
				data: posts.data.map((post) => this.dtoService.toPostDTO(post)),
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
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(
				new GetPostsByUserQuery(publicId, page, limit)
			);
			res.json({
				...posts,
				data: posts.data.map((post) => this.dtoService.toPostDTO(post)),
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
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(
				new GetPostsByUserQuery(user.publicId, page, limit)
			);

			res.status(200).json({
				...posts,
				data: posts.data.map((post) => this.dtoService.toPostDTO(post)),
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
			const viewerPublicId = req.decodedUser?.publicId;
			const sanitizedSlug = slug.replace(/\.[a-z0-9]{2,5}$/i, "");
			const looksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedSlug);
			const post = looksLikeUUID
				? await this.queryBus.execute<PostDTO>(new GetPostByPublicIdQuery(sanitizedSlug))
				: await this.queryBus.execute<PostDTO>(new GetPostBySlugQuery(sanitizedSlug));

			if (viewerPublicId && post.publicId) {
				safeFireAndForget(this.commandBus.dispatch(new RecordPostViewCommand(post.publicId, viewerPublicId)));
			}

			const dto = this.dtoService.toPostDTO(post);
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
			const post = await this.queryBus.execute<PostDTO>(new GetPostByPublicIdQuery(sanitizedPublicId, viewerPublicId));

			if (viewerPublicId) {
				safeFireAndForget(this.commandBus.dispatch(new RecordPostViewCommand(sanitizedPublicId, viewerPublicId)));
			}

			const dto = this.dtoService.toPostDTO(post);
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
			const result = await this.queryBus.execute<PaginationResult<PostDTO>>(
				new SearchPostsByTagsQuery(tagArray, page, limit)
			);
			res.status(200).json({
				...result,
				data: result.data.map((post) => this.dtoService.toPostDTO(post)),
			});
		} catch (error) {
			next(error);
		}
	};

	listTags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const result = await this.queryBus.execute<ITag[]>(new GetAllTagsQuery());
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
			const result = await this.commandBus.dispatch(new DeletePostCommand(sanitizedPublicId, decodedUser.publicId));
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

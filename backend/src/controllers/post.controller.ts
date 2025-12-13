import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { CreatePostCommand } from "../application/commands/post/createPost/createPost.command";
import { DeletePostCommand } from "../application/commands/post/deletePost/deletePost.command";
import { RecordPostViewCommand } from "../application/commands/post/recordPostView/recordPostView.command";
import { RepostPostCommand } from "../application/commands/post/repostPost/repostPost.command";
import { GetPostByPublicIdQuery } from "../application/queries/post/getPostByPublicId/getPostByPublicId.query";
import { GetPostBySlugQuery } from "../application/queries/post/getPostBySlug/getPostBySlug.query";
import { GetPostsQuery } from "../application/queries/post/getPosts/getPosts.query";
import { GetPostsByUserQuery } from "../application/queries/post/getPostsByUser/getPostsByUser.query";
import { GetLikedPostsByUserQuery } from "../application/queries/post/getLikedPostsByUser/getLikedPostsByUser.query";
import { SearchPostsByTagsQuery } from "../application/queries/post/searchPostsByTags/searchPostsByTags.query";
import { GetAllTagsQuery } from "../application/queries/tags/getAllTags/getAllTags.query";
import { GetUserByUsernameQuery } from "../application/queries/users/getUserByUsername/getUserByUsername.query";
import { createError } from "../utils/errors";
import { errorLogger } from "../utils/winston";
import { PostDTO, PaginationResult, ITag, UserPostsResult } from "../types";
import { safeFireAndForget } from "../utils/helpers";
import { PublicUserDTO } from "../services/dto.service";
import { logger } from "../utils/winston";

@injectable()
export class PostController {
	constructor(
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
			const command = new CreatePostCommand(decodedUser.publicId, bodyText, undefined, file?.path, originalName);
			const postDTO = (await this.commandBus.dispatch(command)) as PostDTO;
			res.status(201).json(postDTO);
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
		logger.info("listPosts called with page:", page, "limit:", limit, "userId:", userId);
		try {
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(new GetPostsQuery(page, limit, userId));
			res.json(posts);
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
			const query = new GetPostsByUserQuery(publicId, page, limit);
			const posts = await this.queryBus.execute<UserPostsResult>(query);
			res.json(posts);
		} catch (error) {
			if (error instanceof Error) {
				errorLogger.error(error.stack);
			} else {
				errorLogger.error("Unknown error occurred");
			}
			next(createError("UnknownError", "Failed to fetch posts"));
		}
	};

	getLikedPostsByUserPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const { publicId } = req.params;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const viewerPublicId = req.decodedUser?.publicId;

		try {
			const query = new GetLikedPostsByUserQuery(publicId, page, limit, viewerPublicId);
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(query);
			res.json(posts);
		} catch (error) {
			if (error instanceof Error) {
				errorLogger.error(error.stack);
			} else {
				errorLogger.error("Unknown error occurred");
			}
			next(createError("UnknownError", "Failed to fetch liked posts"));
		}
	};

	getPostsByUsername = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { username } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const userQuery = new GetUserByUsernameQuery(username);
			const user = await this.queryBus.execute<PublicUserDTO>(userQuery);

			const query = new GetPostsByUserQuery(user.publicId, page, limit);
			const posts = await this.queryBus.execute<PaginationResult<PostDTO>>(query);

			res.status(200).json(posts);
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
				const command = new RecordPostViewCommand(post.publicId, viewerPublicId);
				safeFireAndForget(this.commandBus.dispatch(command));
			}

			res.status(200).json(post);
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
			logger.info("getPostByPublicId called");
			const { publicId } = req.params;
			const viewerPublicId = req.decodedUser?.publicId; // Get viewer's publicId if logged in
			// Strip file extension if present (e.g., "abc-123.png" -> "abc-123")
			const sanitizedPublicId = publicId.replace(/\.[a-z0-9]{2,5}$/i, "");
			const command = new GetPostByPublicIdQuery(sanitizedPublicId, viewerPublicId);
			const postDTO = await this.queryBus.execute<PostDTO>(command);

			if (viewerPublicId) {
				safeFireAndForget(this.commandBus.dispatch(new RecordPostViewCommand(sanitizedPublicId, viewerPublicId)));
			}

			res.status(200).json(postDTO);
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

			const query = new SearchPostsByTagsQuery(tagArray, page, limit);
			const postDTO = await this.queryBus.execute<PaginationResult<PostDTO>>(query);
			res.status(200).json(postDTO);
		} catch (error) {
			next(error);
		}
	};

	listTags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const query = new GetAllTagsQuery();
			const result = await this.queryBus.execute<ITag[]>(query);
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
			const command = new DeletePostCommand(sanitizedPublicId, decodedUser.publicId);
			const result = await this.commandBus.dispatch(command);
			res.status(200).json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	repostPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
			}

			const sanitizedPublicId = publicId.replace(/\.[a-z0-9]{2,5}$/i, "");
			const body = req.body?.body as string | undefined;
			const command = new RepostPostCommand(decodedUser.publicId, sanitizedPublicId, body);
			const postDTO = (await this.commandBus.dispatch(command)) as PostDTO;
			res.status(201).json(postDTO);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};
}

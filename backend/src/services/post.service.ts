import { inject, injectable } from "tsyringe";
import { PostRepository } from "../repositories/post.repository";
import { PostLikeRepository } from "../repositories/postLike.repository";
import { UserRepository } from "../repositories/user.repository";
import { TagRepository } from "../repositories/tag.repository";
import { DTOService } from "./dto.service";
import { createError } from "../utils/errors";
import { IPost, IPostWithId, ITag, PaginationResult, PostDTO } from "../types";
import { TagService } from "./tag.service";

@injectable()
export class PostService {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagRepository") private readonly tagRepository: TagRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: any,
		@inject("TagService") private readonly tagService: TagService,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async getPostByPublicId(publicId: string, viewerPublicId?: string): Promise<PostDTO> {
		const post = await this.postRepository.findByPublicId(publicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}
		const dto = this.dtoService.toPostDTO(post);

		console.log("[PostService.getPostByPublicId] viewerPublicId:", viewerPublicId);

		// Add viewer-specific fields if viewer is logged in
		if (viewerPublicId) {
			const postInternalId = (post as IPostWithId)._id?.toString();
			const viewerInternalId = await this.userRepository.findInternalIdByPublicId(viewerPublicId);

			console.log(
				"[PostService.getPostByPublicId] postInternalId:",
				postInternalId,
				"viewerInternalId:",
				viewerInternalId
			);

			if (postInternalId && viewerInternalId) {
				dto.isLikedByViewer = await this.postLikeRepository.hasUserLiked(postInternalId, viewerInternalId);
				console.log("[PostService.getPostByPublicId] like match:", dto.isLikedByViewer);

				const favoriteRecord = await this.favoriteRepository.findByUserAndPost(viewerInternalId, postInternalId);
				dto.isFavoritedByViewer = !!favoriteRecord;
				console.log("[PostService.getPostByPublicId] favoriteRecord:", !!favoriteRecord);
			}
		}

		console.log("[PostService.getPostByPublicId] Returning DTO:", {
			publicId: dto.publicId,
			isLikedByViewer: dto.isLikedByViewer,
			isFavoritedByViewer: dto.isFavoritedByViewer,
		});

		return dto;
	}

	async getPostBySlug(slug: string): Promise<PostDTO> {
		const post = await this.postRepository.findBySlug(slug);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}
		return this.dtoService.toPostDTO(post);
	}

	async getPosts(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const result = await this.postRepository.findWithPagination({ page, limit });
		return {
			...result,
			data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry as unknown as IPost)),
		};
	}

	async getPostsByUserPublicId(userPublicId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const result = await this.postRepository.findByUserPublicId(userPublicId, { page, limit });
		return {
			...result,
			data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry as unknown as IPost)),
		};
	}

	async searchByTags(tags: string[], page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		if (tags.length === 0) {
			return this.getPosts(page, limit);
		}

		const tagIds = await this.tagService.resolveTagIds(tags);
		const result = await this.postRepository.findByTags(tagIds, { page, limit });

		return {
			...result,
			data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry as unknown as IPost)),
		};
	}

	async getTags(): Promise<ITag[]> {
		return (await this.tagRepository.getAll()) ?? [];
	}

	private handleError(error: unknown, functionName: string): never {
		if (error instanceof Error) {
			throw createError(error.name, error.message, {
				function: functionName,
				file: "post.service.ts",
			});
		}
		throw createError("UnknownError", String(error), {
			function: functionName,
			file: "post.service.ts",
		});
	}
}

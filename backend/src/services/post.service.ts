import mongoose, { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { PostRepository } from "../repositories/post.repository";
import { UserRepository } from "../repositories/user.repository";
import { TagRepository } from "../repositories/tag.repository";
import { UnitOfWork } from "../database/UnitOfWork";
import { createError } from "../utils/errors";
import { IPost, ITag, PaginationResult, PostDTO } from "../types";
import { RedisService } from "./redis.service";
import { v4 as uuidv4 } from "uuid";
import { EventBus } from "../application/common/buses/event.bus";
import { PostDeletedEvent, PostUploadedEvent } from "../application/events/post/post.event";
import { CommentRepository } from "../repositories/comment.repository";
import { ImageService, AttachmentSummary } from "./image.service";

const MAX_BODY_LENGTH = 250;

export interface CreatePostInput {
	userPublicId: string;
	body?: string;
	tags?: string[];
	image?: {
		buffer: Buffer;
		originalName?: string;
	};
}

@injectable()
export class PostService {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagRepository") private readonly tagRepository: TagRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: any,
		@inject("LikeRepository") private readonly likeRepository: any,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("EventBus") private readonly eventBus: EventBus
	) {}

	async createPost(input: CreatePostInput): Promise<PostDTO> {
		let uploadedImagePublicId: string | null = null;

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userRepository.findByPublicId(input.userPublicId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				const internalUserId = (user as any)._id.toString();
				const normalizedBody = this.normalizeBody(input.body);
				const tagNames = this.collectTagNames(normalizedBody, input.tags);

				const tagDocs = await this.ensureTags(tagNames, session);
				const tagIds = tagDocs.map((tag) => new mongoose.Types.ObjectId((tag as any)._id));

				let imageSummary: AttachmentSummary = { docId: null };

				if (input.image?.buffer) {
					const { storagePublicId, summary } = await this.imageService.createPostAttachment({
						buffer: input.image.buffer,
						originalName: input.image.originalName || `post-${Date.now()}`,
						userInternalId: internalUserId,
						userPublicId: user.publicId,
						tagIds,
						session,
					});

					uploadedImagePublicId = storagePublicId;
					imageSummary = summary;

					if (!summary.docId) {
						throw createError("UnknownError", "Image document was not created");
					}
				} else if (tagIds.length > 0) {
					await this.incrementTagUsage(tagIds, session);
				}

				const postSlug = imageSummary.slug ?? this.generatePostSlug(normalizedBody);
				const postPublicId = uuidv4();

				const post = await this.postRepository.create(
					{
						publicId: postPublicId,
						user: internalUserId,
						body: normalizedBody,
						slug: postSlug,
						image: imageSummary.docId,
						tags: tagIds,
						likesCount: 0,
						commentsCount: 0,
					} as unknown as IPost,
					session
				);

				return {
					post,
					user,
					tagNames,
					imageSummary,
				};
			});

			const hydratedPost = await this.postRepository.findByPublicId(result.post.publicId);
			if (!hydratedPost) {
				throw createError("NotFoundError", "Post not found after creation");
			}

			await this.redisService.invalidateByTags([`user_feed:${result.user.publicId}`]);

			const distinctTags = Array.from(new Set(result.tagNames));
			await this.eventBus.publish(new PostUploadedEvent(result.post.publicId, result.user.publicId, distinctTags));

			return this.toPostDTO(hydratedPost);
		} catch (error) {
			if (uploadedImagePublicId) {
				await this.imageService.rollbackUpload(uploadedImagePublicId);
			}
			throw this.handleError(error, "createPost");
		}
	}

	async getPostByPublicId(publicId: string, viewerPublicId?: string): Promise<PostDTO> {
		const post = await this.postRepository.findByPublicId(publicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}
		const dto = this.toPostDTO(post);

		console.log("[PostService.getPostByPublicId] viewerPublicId:", viewerPublicId);

		// Add viewer-specific fields if viewer is logged in
		if (viewerPublicId) {
			const postInternalId = (post as any)._id?.toString();
			const viewerInternalId = await this.userRepository.findInternalIdByPublicId(viewerPublicId);

			console.log(
				"[PostService.getPostByPublicId] postInternalId:",
				postInternalId,
				"viewerInternalId:",
				viewerInternalId
			);

			if (postInternalId && viewerInternalId) {
				// Check if viewer liked this post (using LikeRepository)
				const likeRecord = await this.likeRepository.findByUserAndPost(viewerInternalId, postInternalId);
				dto.isLikedByViewer = !!likeRecord;
				console.log("[PostService.getPostByPublicId] likeRecord:", !!likeRecord);

				// Check if viewer favorited this post (using FavoriteRepository)
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
		return this.toPostDTO(post);
	}

	async getPosts(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const result = await this.postRepository.findWithPagination({ page, limit });
		return {
			...result,
			data: result.data.map((entry: any) => this.toPostDTO(entry as unknown as IPost)),
		};
	}

	async getPostsByUserPublicId(userPublicId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const result = await this.postRepository.findByUserPublicId(userPublicId, { page, limit });
		return {
			...result,
			data: result.data.map((entry: any) => this.toPostDTO(entry as unknown as IPost)),
		};
	}

	async searchByTags(tags: string[], page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		if (tags.length === 0) {
			return this.getPosts(page, limit);
		}

		const tagIds = await this.resolveTagIds(tags);
		const result = await this.postRepository.findByTags(tagIds, { page, limit });

		return {
			...result,
			data: result.data.map((entry: any) => this.toPostDTO(entry as unknown as IPost)),
		};
	}

	async getTags(): Promise<ITag[]> {
		return (await this.tagRepository.getAll()) ?? [];
	}

	async deletePostByPublicId(publicId: string, requesterPublicId: string): Promise<{ message: string }> {
		let postAuthorPublicId: string | undefined;

		await this.unitOfWork.executeInTransaction(async (session) => {
			const post = await this.postRepository.findByPublicId(publicId, session);
			if (!post) {
				throw createError("NotFoundError", "Post not found");
			}

			const user = await this.userRepository.findByPublicId(requesterPublicId, session);
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}

			const postOwnerInternalId =
				typeof post.user === "object" && post.user !== null && "_id" in post.user
					? (post.user as any)._id.toString()
					: ((post.user as any)?.toString?.() ?? "");
			const postOwnerPublicId =
				typeof post.user === "object" && post.user !== null && "publicId" in post.user
					? (post.user as any).publicId
					: undefined;
			const requesterId = (user as any)._id.toString();
			const postOwnerDoc = postOwnerInternalId
				? await this.userRepository.findById(postOwnerInternalId, session)
				: null;
			postAuthorPublicId = postOwnerDoc?.publicId ?? postOwnerPublicId ?? requesterPublicId;

			if (postOwnerInternalId !== requesterId && !user.isAdmin) {
				throw createError("ForbiddenError", "You do not have permission to delete this post");
			}

			let shouldDecrementTags = true;

			if (post.image) {
				const rawImage = post.image as any;
				const imageId = rawImage?._id ? rawImage._id.toString() : rawImage?.toString?.();
				if (!imageId) {
					throw createError("NotFoundError", "Associated image not found");
				}

				const ownerPublicId = postOwnerDoc?.publicId ?? postOwnerPublicId ?? requesterPublicId;
				const removal = await this.imageService.removePostAttachment({
					imageId,
					requesterPublicId,
					ownerInternalId: postOwnerInternalId || undefined,
					ownerPublicId,
					session,
				});

				if (removal.removed) {
					shouldDecrementTags = false;
				}
			}

			const postInternalId = (post as any)._id.toString();
			await this.postRepository.delete(postInternalId, session);
			await this.commentRepository.deleteCommentsByPostId(postInternalId, session);

			if (shouldDecrementTags && post.tags && post.tags.length > 0) {
				const tagIds = (post.tags as any[]).map((tag) => {
					if (typeof tag === "object" && tag !== null && "_id" in tag) {
						return new mongoose.Types.ObjectId((tag as any)._id);
					}
					return new mongoose.Types.ObjectId(tag);
				});
				await this.decrementTagUsage(tagIds, session);
			}
		});

		await this.redisService.invalidateByTags([`user_feed:${requesterPublicId}`]);

		const eventAuthorId = postAuthorPublicId ?? requesterPublicId;
		await this.eventBus.publish(new PostDeletedEvent(publicId, eventAuthorId));

		return { message: "Post deleted successfully" };
	}

	private async ensureTags(tagNames: string[], session?: ClientSession): Promise<ITag[]> {
		if (!tagNames.length) {
			return [];
		}

		const unique = Array.from(new Set(tagNames.map((tag) => this.normalizeTag(tag))).values());

		const tagDocs: ITag[] = [];
		for (const tag of unique) {
			if (!tag) continue;

			const existing = await this.tagRepository.findByTag(tag, session);
			if (existing) {
				tagDocs.push(existing);
				continue;
			}

			const created = await this.tagRepository.create(
				{
					tag,
					count: 0,
					modifiedAt: new Date(),
				} as Partial<ITag>,
				session
			);
			tagDocs.push(created);
		}

		return tagDocs;
	}

	private async resolveTagIds(tagNames: string[]): Promise<string[]> {
		const unique = Array.from(new Set(tagNames.map((tag) => this.normalizeTag(tag))).values());
		const ids: string[] = [];

		for (const tag of unique) {
			if (!tag) continue;
			const existing = await this.tagRepository.findByTag(tag);
			if (existing) {
				ids.push((existing as any)._id.toString());
			}
		}

		return ids;
	}

	private async incrementTagUsage(tagIds: mongoose.Types.ObjectId[], session?: ClientSession): Promise<void> {
		if (!tagIds.length) return;
		const now = new Date();
		await Promise.all(
			tagIds.map((tagId) =>
				this.tagRepository.findOneAndUpdate({ _id: tagId }, { $inc: { count: 1 }, $set: { modifiedAt: now } }, session)
			)
		);
	}

	private async decrementTagUsage(tagIds: mongoose.Types.ObjectId[], session?: ClientSession): Promise<void> {
		if (!tagIds.length) return;
		const now = new Date();
		await Promise.all(
			tagIds.map((tagId) =>
				this.tagRepository.findOneAndUpdate({ _id: tagId }, { $inc: { count: -1 }, $set: { modifiedAt: now } }, session)
			)
		);
	}

	private collectTagNames(body: string | undefined, explicit?: string[]): string[] {
		const hashtags = this.extractHashtags(body);
		const provided = Array.isArray(explicit) ? explicit : [];
		return [...hashtags, ...provided];
	}

	private extractHashtags(text?: string): string[] {
		if (!text) return [];
		const matches = text.match(/#([\p{L}\p{N}_-]+)/gu) || [];
		return matches.map((tag) => tag.substring(1));
	}

	private normalizeBody(body?: string): string {
		if (!body) return "";
		return body.trim().slice(0, MAX_BODY_LENGTH);
	}

	private normalizeTag(tag?: string): string {
		if (!tag) return "";
		return tag.replace(/^#+/, "").trim().toLowerCase();
	}

	private generatePostSlug(body: string): string {
		const base = body
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "")
			.slice(0, 60);
		const safeBase = base || "post";
		return `${safeBase}-${Date.now()}`;
	}

	private toPostDTO(post: any): PostDTO {
		const tags = Array.isArray(post.tags)
			? post.tags.map((tag: any) => {
					if (typeof tag === "string") return tag;
					if (tag?.tag) return tag.tag;
					return "";
				})
			: [];

		// Extract only specific fields from image object (if populated)
		const imageData = post.image ? (post.image as any) : null;
		const url = imageData?.url || undefined;
		const imagePublicId = imageData?.publicId || undefined;

		return {
			publicId: post.publicId,
			body: post.body,
			slug: post.slug,
			url,
			imagePublicId,
			tags: tags.filter(Boolean),
			likes: post.likes ?? post.likesCount ?? 0,
			commentsCount: post.commentsCount ?? 0,
			createdAt: post.createdAt,
			user: {
				publicId: post.user?.publicId ?? post.user?.id ?? "",
				username: post.user?.username ?? "",
				avatar: post.user?.avatar ?? "",
			},
		};
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

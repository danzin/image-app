import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { LikeRepository } from "../repositories/like.repository";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { createError } from "../utils/errors";
import type { IImage, IImageStorageService, ITag, PaginationResult } from "../types";
import { TagRepository } from "../repositories/tag.repository";
import { UnitOfWork } from "../database/UnitOfWork";
import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";
import { EventBus } from "../application/common/buses/event.bus";
import { ImageDeletedEvent, ImageUploadedEvent } from "../application/events/image/image.event";
import { ClientSession } from "mongoose";

@injectable()
export class ImageService {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageRepository")
		private readonly imageRepository: ImageRepository,
		@inject("ImageStorageService")
		private readonly imageStorageService: IImageStorageService,
		@inject("TagRepository") private readonly tagRepository: TagRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("LikeRepository") private readonly likeRepository: LikeRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("RedisService") private redisService: RedisService,
		@inject("EventBus") private eventBus: EventBus
	) {}

	// TODO: REFACTOR AND REMOVE OLD METHODS

	// ============================================
	// PRIVATE CORE METHODS (Internal IDs only)
	// ============================================

	/**
	 * Core upload logic using internal user ID
	 * @internal - Use uploadImage() instead
	 */
	private async executeUpload(
		userInternalId: string,
		file: Buffer,
		tags: string[],
		originalName: string,
		session?: ClientSession
	): Promise<IImage> {
		// Your existing upload logic, but simplified
		// All the tag processing, cloudinary upload, DB creation
		// Returns the created image document

		const user = await this.userRepository.findById(userInternalId, session);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		// Process tags (this logic stays the same)
		const tagIds = await Promise.all(
			tags.map(async (tag) => {
				const existingTag = await this.tagRepository.findByTag(tag, session);
				if (existingTag) return existingTag._id;

				const newTag = await this.tagRepository.create({ tag } as Partial<ITag>, session);
				return newTag._id;
			})
		);

		// Upload to storage
		const cloudImage = await this.imageStorageService.uploadImage(file, user.publicId);

		// Generate slug
		const slug = this.generateSlug(originalName);

		// Create image document
		const image = await this.imageRepository.create(
			{
				url: cloudImage.url,
				publicId: cloudImage.publicId,
				originalName,
				slug,
				user: userInternalId,
				tags: tagIds,
				likes: 0,
				createdAt: new Date(),
			} as unknown as IImage,
			session
		);

		// Update user's images array
		await this.userRepository.update(userInternalId, { images: [...user.images, image.url] }, session);

		return image;
	}

	/**
	 * Core deletion logic using internal IDs
	 * @internal - Use deleteImage() instead
	 */
	private async executeDelete(
		imageInternalId: string,
		requesterInternalId: string,
		isAdmin: boolean,
		session?: ClientSession
	): Promise<void> {
		const image = await this.imageRepository.findById(imageInternalId, session);
		if (!image) {
			throw createError("NotFoundError", "Image not found");
		}

		// Extract user ID - handle both populated and non-populated cases
		const userIdValue =
			typeof image.user === "object" && image.user !== null && "_id" in image.user
				? (image.user as any)._id.toString()
				: image.user.toString();

		// Authorization check
		if (!isAdmin && userIdValue !== requesterInternalId) {
			throw createError("ForbiddenError", "You don't have permission to delete this image");
		}

		// Delete from storage
		const ownerUser = await this.userRepository.findById(userIdValue, session);
		if (!ownerUser) {
			throw createError("NotFoundError", "Image owner not found");
		}

		const deletionResult = await this.imageStorageService.deleteAssetByUrl(
			ownerUser.publicId,
			ownerUser.publicId,
			image.url
		);

		if (deletionResult.result !== "ok") {
			throw createError("StorageError", "Failed to delete from storage");
		}

		// Delete database records
		await this.imageRepository.delete(imageInternalId, session);
		await this.commentRepository.deleteCommentsByImageId(imageInternalId, session);

		// Update user's images array
		const updatedImages = ownerUser.images.filter((img) => img !== image.url);
		await this.userRepository.update(ownerUser.id, { images: updatedImages }, session);
	}

	// ============================================
	// PUBLIC API (Public IDs only)
	// ============================================

	/**
	 * Uploads an image for a user
	 * @param userPublicId - User's public identifier
	 * @param file - Image file buffer
	 * @param tags - Array of tag names
	 * @param originalName - Original filename
	 */
	async uploadImage(
		userPublicId: string,
		file: Buffer,
		tags: string[],
		originalName: string
	): Promise<{
		id: string; // Image's public ID
		url: string;
		slug: string;
		user: {
			id: string; // User's public ID
			username: string;
		};
		tags: string[];
		createdAt: Date;
	}> {
		let cloudImagePublicId: string | null = null;

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				// Convert public ID to internal ID
				const user = await this.userRepository.findByPublicId(userPublicId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				// Execute core upload logic
				const image = await this.executeUpload(user.id, file, tags, originalName, session);

				cloudImagePublicId = image.publicId;

				// Return public-facing data (no internal IDs!)
				return {
					id: image.publicId,
					url: image.url,
					slug: image.slug,
					user: {
						id: user.publicId,
						username: user.username,
					},
					tags,
					createdAt: image.createdAt,
				};
			});

			// Publish event
			await this.eventBus.publish(new ImageUploadedEvent(result.id, userPublicId, tags));

			return result;
		} catch (error) {
			// Cleanup on failure
			if (cloudImagePublicId) {
				await this.imageStorageService.deleteImage(cloudImagePublicId).catch(console.error);
			}
			throw this.handleError(error, "uploadImage");
		}
	}

	/**
	 * Gets an image by its public ID
	 * @param imagePublicId - The image's public identifier
	 * @param viewerPublicId - Optional viewer's public ID for personalized data
	 */
	async getImage(imagePublicId: string, viewerPublicId?: string): Promise<IImage> {
		try {
			const image = await this.imageRepository.findByPublicId(imagePublicId);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}

			// Use the helper method to enrich with viewer data
			if (viewerPublicId) {
				await this.enrichImageWithViewerData(image, viewerPublicId);
			}

			return image;
		} catch (error) {
			throw this.handleError(error, "getImage");
		}
	}

	/**
	 * Gets an image by its SEO-friendly slug
	 * @param slug - Image's URL slug
	 * @param viewerPublicId - (Optional) Viewer's public ID
	 */
	async getImageBySlug(slug: string, viewerPublicId?: string): Promise<IImage> {
		try {
			const image = await this.imageRepository.findBySlug(slug);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}

			if (viewerPublicId) {
				await this.enrichImageWithViewerData(image, viewerPublicId);
			}

			return image;
		} catch (error) {
			throw this.handleError(error, "getImageBySlug");
		}
	}

	/**
	 * Gets paginated images for a user
	 * @param userPublicId - User's public identifier
	 */
	async getUserImages(userPublicId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findByUserPublicId(userPublicId, { page, limit });
		} catch (error) {
			throw this.handleError(error, "getUserImages");
		}
	}

	/**
	 * Gets all images with pagination (public feed)
	 */
	async getImages(page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findWithPagination({ page, limit });
		} catch (error) {
			throw this.handleError(error, "getImages");
		}
	}

	/**
	 * Searches images by tags
	 */
	async searchByTags(tags: string[], page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			const tagIds = await Promise.all(
				tags.map(async (tag) => {
					const existingTag = await this.tagRepository.findByTag(tag);
					if (!existingTag) {
						throw createError("NotFoundError", `Tag '${tag}' not found`);
					}
					return existingTag._id;
				})
			);

			return await this.imageRepository.findByTags(tagIds as string[], { page, limit });
		} catch (error) {
			throw this.handleError(error, "searchByTags");
		}
	}

	async getTags(): Promise<ITag[]> {
		try {
			return (await this.tagRepository.getAll()) ?? [];
		} catch (error) {
			throw this.handleError(error, "getTags");
		}
	}

	/**
	 * Deletes an image by public ID
	 */
	async deleteImageByPublicId(
		publicId: string,
		userPublicId: string,
		isAdmin: boolean = false
	): Promise<{ message: string }> {
		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				// Convert public IDs to internal IDs
				const image = await this.imageRepository.findByPublicId(publicId, session);
				if (!image) {
					throw createError("NotFoundError", "Image not found");
				}
				const imageInternalId = (image as any)._id.toString();

				const requester = await this.userRepository.findByPublicId(userPublicId, session);
				if (!requester) {
					throw createError("NotFoundError", "Requester not found");
				}
				const requesterInternalId = requester.id;

				// Execute core deletion logic
				await this.executeDelete(imageInternalId, requesterInternalId, isAdmin, session);

				return { message: "Image deleted successfully" };
			});

			// Publish event
			await this.eventBus.publish(new ImageDeletedEvent(publicId, userPublicId));

			return result;
		} catch (error) {
			throw this.handleError(error, "deleteImageByPublicId");
		}
	}

	// ============================================
	// ADMIN METHODS
	// ============================================

	/**
	 * Gets all images for admin dashboard with pagination
	 */
	async getAllImagesAdmin(options: {
		page?: number | string;
		limit?: number | string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<PaginationResult<IImage>> {
		try {
			const paginationOptions = {
				page: parseInt(String(options.page || 1), 10),
				limit: parseInt(String(options.limit || 20), 10),
				sortBy: options.sortBy || "createdAt",
				sortOrder: (options.sortOrder || "desc") as "asc" | "desc",
			};

			return await this.imageRepository.findWithPagination(paginationOptions);
		} catch (error) {
			throw this.handleError(error, "getAllImagesAdmin");
		}
	}

	// ============================================
	// HELPER METHODS
	// ============================================

	/**
	 * Private helper method to check if a user has liked a specific image
	 */
	private async checkIfUserLikedImage(userPublicId: string, imageId: string): Promise<boolean> {
		try {
			console.log(`Checking if user ${userPublicId} liked image ${imageId}`);

			// Convert user public ID to internal ID
			const userInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
			console.log(`User internal ID: ${userInternalId}`);

			if (!userInternalId) {
				console.log("User internal ID not found");
				return false;
			}

			// Check if like record exists
			const like = await this.likeRepository.findByUserAndImage(userInternalId, imageId);
			console.log(`Like record found:`, like);
			const result = like !== null;
			console.log(`checkIfUserLikedImage result: ${result}`);
			return result;
		} catch (error) {
			console.error("Error in checkIfUserLikedImage:", error);
			// If there's an error checking likes, default to false
			return false;
		}
	}

	private async checkIfUserFavoritedImage(userPublicId: string, imageId: string): Promise<boolean> {
		try {
			const userInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
			if (!userInternalId) {
				return false;
			}

			const favorite = await this.favoriteRepository.findByUserAndImage(userInternalId, imageId);
			return favorite !== null;
		} catch (error) {
			console.error("Error in checkIfUserFavoritedImage:", error);
			return false;
		}
	}

	/**
	 * Enriches an image with viewer-specific data (likes, favorites)
	 * @private
	 */
	private async enrichImageWithViewerData(image: IImage, viewerPublicId: string): Promise<void> {
		const imageId = (image as any)._id.toString();

		const [isLiked, isFavorited] = await Promise.all([
			this.checkIfUserLikedImage(viewerPublicId, imageId),
			this.checkIfUserFavoritedImage(viewerPublicId, imageId),
		]);

		(image as any).isLikedByViewer = isLiked;
		(image as any).isFavoritedByViewer = isFavorited;
	}

	/**
	 * Generates a URL-friendly slug from a filename
	 * @private
	 */
	private generateSlug(originalName: string): string {
		return (
			originalName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "") +
			"-" +
			Date.now()
		);
	}

	/**
	 * Centralized error handling for consistent error formatting
	 * @private
	 */
	private handleError(error: unknown, functionName: string): never {
		if (error instanceof Error) {
			throw createError(error.name, error.message, {
				function: functionName,
				file: "image.service.ts",
			});
		}
		throw createError("UnknownError", String(error), {
			function: functionName,
			file: "image.service.ts",
		});
	}
}

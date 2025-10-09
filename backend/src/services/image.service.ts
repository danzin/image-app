import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { LikeRepository } from "../repositories/like.repository";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { createError } from "../utils/errors";
import type { IImage, IImageStorageService, ITag, PaginationResult } from "../types";
import { errorLogger } from "../utils/winston";
import { TagRepository } from "../repositories/tag.repository";
import { UnitOfWork } from "../database/UnitOfWork";
import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";
import { EventBus } from "../application/common/buses/event.bus";
import { ImageDeletedEvent, ImageUploadedEvent } from "../application/events/image/image.event";

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

	async uploadImage(userPublicId: string, file: Buffer, tags: string[], originalName: string): Promise<Object> {
		let cloudImagePublicId: string | null = null;
		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				// Find user by publicId (no internal id from client)
				const user = await this.userRepository.findByPublicId(userPublicId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				// Process tags
				const tagIds = await Promise.all(
					tags.map(async (tag) => {
						const existingTag = await this.tagRepository.findByTag(tag, session);
						if (existingTag) {
							return existingTag._id;
						}
						const tagObject = { tag: tag } as Partial<ITag>;
						const newTag = await this.tagRepository.create(tagObject, session);
						return newTag._id;
					})
				);

				// Store publicId for cleanup if transaction fails
				const cloudImage = await this.imageStorageService.uploadImage(file, user.publicId);
				cloudImagePublicId = cloudImage.publicId;

				// Generate slug from originalName
				const slug =
					originalName
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/(^-|-$)/g, "") +
					"-" +
					Date.now();

				// Create image document
				console.log("=== CREATING IMAGE DOCUMENT ===");
				console.log("originalName being set:", originalName);
				console.log("generated slug:", slug);
				console.log("cloudImage:", cloudImage);

				const image = {
					url: cloudImage.url,
					publicId: cloudImage.publicId,
					originalName: originalName,
					slug: slug,
					user: user.id,
					createdAt: new Date(),
					tags: tagIds,
					likes: 0,
				} as unknown as IImage;

				console.log("Image object before save:", image);

				const img = await this.imageRepository.create(image as IImage, session);
				if (!img) {
					throw createError("InternalServerError", "Failed to create image");
				}
				// Update user images array
				await this.userRepository.update(user.id, { images: [...user.images, img.url] }, session);

				return {
					id: img.id,
					url: img.url,
					publicId: img.publicId,
					user: {
						id: user.publicId,
						username: user.username,
					},
					tags: tags.map((tag) => tag),
					createdAt: img.createdAt,
				};
			});

			console.log("Publishing ImageUploadedEvent");
			await this.eventBus.publish(
				new ImageUploadedEvent(
					result.publicId,
					userPublicId, // Uploader's public ID
					tags // Image tags
				)
			);

			return result;
		} catch (error) {
			// Cleanup Cloudinary asset if transaction failed after upload
			if (cloudImagePublicId) {
				try {
					await this.imageStorageService.deleteImage(cloudImagePublicId);
				} catch (error) {
					console.error("Failed to cleanup Cloudinary image:", error);
					const errorMessage = error instanceof Error ? error.message : String(error);
					throw createError("StorageError", errorMessage, {
						function: "uploadImage",
					});
				}
			}

			if (error instanceof Error) {
				throw createError(error.name, error.message, {
					function: "uploadImage",
					additionalInfo: "Transaction failed after Cloudinary upload",
				});
			} else {
				throw createError("UnknownError", String(error), {
					function: "uploadImage",
					additionalInfo: "Transaction failed after Cloudinary upload",
				});
			}
		}
	}

	async getImages(page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findWithPagination({ page, limit });
		} catch (error) {
			if (error instanceof Error) {
				if (error instanceof Error) {
					throw createError(error.name, error.message, {
						function: "getImages",
						file: "image.service.ts",
					});
				} else {
					throw createError("UnknownError", String(error), {
						function: "getImages",
						file: "image.service.ts",
					});
				}
			} else {
				throw createError("UnknownError", String(error), {
					function: "getImages",
					file: "image.service.ts",
				});
			}
		}
	}

	async getUserImages(userPublicId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findByUserPublicId(userPublicId, { page, limit });
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message, {
					function: "getUserImages",
					file: "image.service.ts",
				});
			} else {
				throw createError("UnknownError", String(error), {
					function: "getUserImages",
					file: "image.service.ts",
				});
			}
		}
	}

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

			return await this.imageRepository.findByTags(tagIds as string[], {
				page,
				limit,
			});
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	async getImageById(id: string): Promise<IImage> {
		try {
			const image = await this.imageRepository.findById(id);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}
			return image;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	async getTags(): Promise<ITag[]> {
		try {
			return (await this.tagRepository.getAll()) ?? [];
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

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
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Gets an image by its public ID
	 */
	async getImageByPublicId(publicId: string, viewerPublicId?: string): Promise<IImage> {
		try {
			console.log(`getImageByPublicId called with publicId: ${publicId}, viewerPublicId: ${viewerPublicId}`);
			const image = await this.imageRepository.findByPublicId(publicId);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}

			// Add like status if viewer is provided
			if (viewerPublicId) {
				console.log(`Adding like status for viewer: ${viewerPublicId} on image publicId: ${publicId}`);
				const isLikedByViewer = await this.checkIfUserLikedImage(viewerPublicId, (image as any)._id.toString());
				console.log(`Setting isLikedByViewer to: ${isLikedByViewer}`);
				(image as any).isLikedByViewer = isLikedByViewer;
				const isFavoritedByViewer = await this.checkIfUserFavoritedImage(viewerPublicId, (image as any)._id.toString());
				console.log(`Setting isFavoritedByViewer to: ${isFavoritedByViewer}`);
				(image as any).isFavoritedByViewer = isFavoritedByViewer;
			} else {
				console.log(`No viewerPublicId provided for image ${publicId}, skipping like status check`);
			}

			console.log(`Returning image with isLikedByViewer: ${(image as any).isLikedByViewer}`);
			return image;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Gets an image by its slug (for SEO-friendly URLs)
	 */
	async getImageBySlug(slug: string, viewerPublicId?: string): Promise<IImage> {
		try {
			const image = await this.imageRepository.findBySlug(slug);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}

			// Add like/favorite status if viewer is provided
			if (viewerPublicId) {
				console.log(`Adding like status for viewer: ${viewerPublicId} on image slug: ${slug}`);
				const isLikedByViewer = await this.checkIfUserLikedImage(viewerPublicId, (image as any)._id.toString());
				console.log(`Setting isLikedByViewer to: ${isLikedByViewer}`);
				(image as any).isLikedByViewer = isLikedByViewer;
				const isFavoritedByViewer = await this.checkIfUserFavoritedImage(viewerPublicId, (image as any)._id.toString());
				console.log(`Setting isFavoritedByViewer to: ${isFavoritedByViewer}`);
				(image as any).isFavoritedByViewer = isFavoritedByViewer;
			}

			return image;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

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
	 * Gets user images by user's public ID
	 */
	async getUserImagesByPublicId(userPublicId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findByUserPublicId(userPublicId, { page, limit });
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message, {
					function: "getUserImagesByPublicId",
					file: "image.service.ts",
				});
			} else {
				throw createError("UnknownError", String(error), {
					function: "getUserImagesByPublicId",
					file: "image.service.ts",
				});
			}
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
				// Find image by public ID
				const image = await this.imageRepository.findByPublicId(publicId, session);
				if (!image) {
					throw createError("PathError", "Image not found");
				}

				let ownerPublicId: string | undefined;
				// Only check ownership if not admin
				if (!isAdmin) {
					if (typeof image.user === "object" && (image.user as any).publicId) {
						ownerPublicId = (image.user as any).publicId.toString();
					} else {
						// image.user is likely an internal id string
						const imageUserId =
							typeof image.user === "object" && (image.user as any)._id
								? (image.user as any)._id.toString()
								: image.user.toString();

						const ownerUser = await this.userRepository.findById(imageUserId, session);
						if (!ownerUser) {
							throw createError("PathError", "Owner user not found");
						}
						ownerPublicId = ownerUser.publicId;
					}
				}
				// Delete the image from database using internal _id
				await this.imageRepository.delete((image as any)._id.toString(), session);

				const deletionResult = await this.imageStorageService.deleteAssetByUrl(
					image.user.publicId.toString(),
					ownerPublicId!,
					image.url
				);
				console.log(`result of await this.imageStorageService.deleteAssetByUrl: ${deletionResult}`);

				if (deletionResult.result !== "ok") {
					throw createError("StorageError", "Failed to delete from Cloudinary");
				}

				// Delete comments associated with this image
				await this.commentRepository.deleteCommentsByImageId((image as any)._id.toString(), session);

				// Remove image URL from user's images array
				const imageUserId =
					typeof image.user === "object" && (image.user as any)._id
						? (image.user as any)._id.toString()
						: image.user.toString();

				const user = await this.userRepository.findById(imageUserId, session);
				if (user) {
					const updatedImages = user.images.filter((img) => img !== image.url);
					await this.userRepository.update(imageUserId, { images: updatedImages }, session);
				}

				return { message: "Image deleted successfully" };
			});

			console.log("Publishing ImageDeletedEvent");
			await this.eventBus.publish(new ImageDeletedEvent(publicId, userPublicId));
			console.log(`result of transaction: ${result}`);
			return result;
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				throw createError(error.name, error.message, {
					function: "deleteImage",
					file: "image.service.ts",
				});
			} else {
				throw createError("UnknownError", String(error), {
					function: "deleteImage",
					file: "image.service.ts",
				});
			}
		}
	}
}

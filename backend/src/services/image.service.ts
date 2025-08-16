import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { createError } from "../utils/errors";
import { IImage, IImageStorageService, ITag, PaginationResult } from "../types";
import { errorLogger } from "../utils/winston";
import { TagRepository } from "../repositories/tag.repository";
import { UnitOfWork } from "../database/UnitOfWork";
import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";

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
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("RedisService") private redisService: RedisService
	) {}

	// TODO: REFACTOR AND REMOVE OLD METHODS

	async uploadImage(userPublicId: string, file: Buffer, tags: string[], originalName: string): Promise<Object> {
		let cloudImagePublicId: string | null = null;

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				// Find user by publicId (no internal id from client)
				const user = await this.userRepository.findByPublicId(userPublicId);
				if (!user) {
					throw createError("ValidationError", "User not found");
				}

				// Process tags
				const tagIds = await Promise.all(
					tags.map(async (tag) => {
						const existingTag = await this.tagRepository.findByTag(tag, session);
						if (existingTag) {
							return existingTag._id;
						}

						//the create method in BaseRepository expects an object
						//so I'm creating one and passing it instead of passing directly
						// the tag as Partial<ITag>
						const tagObject = { tag: tag } as Partial<ITag>;
						const newTag = await this.tagRepository.create(tagObject, session);
						return newTag._id;
					})
				);

				// Store publicId for cleanup if transaction fails
				const cloudImage = await this.imageStorageService.uploadImage(file, user.id);
				cloudImagePublicId = cloudImage.publicId;

				// Generate slug from originalName (same logic as pre-save middleware)
				const slug =
					originalName
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/(^-|-$)/g, "") +
					"-" +
					Date.now();

				// Create image document with Cloudinary details and required fields
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

				// Update user images array
				await this.userRepository.update(user.id, { images: [...user.images, img.url] }, session);
				return {
					id: img.id,
					url: img.url,
					publicId: img.publicId,
					user: {
						id: user.id,
						username: user.username,
					},
					tags: tags.map((tag) => tag),
					createdAt: img.createdAt,
				};
			});
			console.log("Removing cache");
			await this.redisService.del(`feed:${userPublicId}:*`); //invalidate user cache on new image uploads
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

	async deleteImage(imageId: string): Promise<{ message: string }> {
		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				const image = await this.imageRepository.findById(imageId, session);
				console.log(`Image to delete: ${image}`);
				if (!image) {
					throw createError("NotFoundError", "Image not found");
				}

				// Delete all comments associated with this image first
				console.log("Deleting comments for image:", imageId);
				await this.commentRepository.deleteCommentsByImageId(imageId, session);

				// Delete from database
				console.log("deleting from repository:");
				await this.imageRepository.delete(imageId, session);

				// Delete from storage
				const deletionResult = await this.imageStorageService.deleteAssetByUrl(
					image.user.publicId.toString(),
					image.url
				);

				console.log(`result of await this.imageStorageService.deleteAssetByUrl: ${deletionResult}`);

				if (deletionResult.result !== "ok") {
					throw createError("StorageError", "Failed to delete from Cloudinary");
				}
				console.log("Removing cache");
				await this.redisService.del(`feed:${image.user.publicId}:*`); //invalidate cache

				return { message: "Image deleted successfully" };
			});
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

	async getUserImages(userId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findByUserId(userId, { page, limit });
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
		page?: number;
		limit?: number;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}): Promise<PaginationResult<IImage>> {
		try {
			const paginationOptions = {
				page: options.page || 1,
				limit: options.limit || 20,
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
	async getImageByPublicId(publicId: string): Promise<IImage> {
		try {
			const image = await this.imageRepository.findByPublicId(publicId);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}
			return image;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Gets an image by its slug (for SEO-friendly URLs)
	 */
	async getImageBySlug(slug: string): Promise<IImage> {
		try {
			const image = await this.imageRepository.findBySlug(slug);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}
			return image;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
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
	async deleteImageByPublicId(publicId: string, userPublicId: string): Promise<{ message: string }> {
		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				// Find image by public ID
				const image = await this.imageRepository.findByPublicId(publicId, session);
				if (!image) {
					throw createError("NotFoundError", "Image not found");
				}

				// Check if user owns the image - compare with user._id if it's populated, otherwise use user directly
				const imageUserId =
					typeof image.user === "object" && (image.user as any)._id
						? (image.user as any)._id.toString()
						: image.user.toString();
				// Resolve user internal id by publicId
				const ownerInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
				if (!ownerInternalId) throw createError("AuthenticationError", "User not found");
				if (imageUserId !== ownerInternalId) {
					throw createError("ForbiddenError", "You can only delete your own images");
				}

				// Delete from cloud storage using the cloudinary public ID
				if (image.publicId) {
					await this.imageStorageService.deleteImage(image.publicId);
				}

				// Delete comments associated with this image
				await this.commentRepository.deleteCommentsByImageId((image as any)._id.toString(), session);

				// Delete the image from database using internal _id
				await this.imageRepository.delete((image as any)._id.toString(), session);

				// Remove image URL from user's images array
				const user = await this.userRepository.findById(imageUserId, session);
				if (user) {
					const updatedImages = user.images.filter((img) => img !== image.url);
					await this.userRepository.update(imageUserId, { images: updatedImages }, session);
				}

				return { message: "Image deleted successfully" };
			});

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}
}

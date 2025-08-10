import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
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
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("RedisService") private redisService: RedisService
	) {}

	async uploadImage(userId: string, file: Buffer, tags: string[]): Promise<Object> {
		let cloudImagePublicId: string | null = null;

		try {
			const result = await this.unitOfWork.executeInTransaction(async (session) => {
				// Find user
				const user = await this.userRepository.findById(userId, session);
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

				// Create image document with Cloudinary details
				const image = {
					url: cloudImage.url,
					publicId: cloudImage.publicId,
					user: user.id,
					createdAt: new Date(),
					tags: tagIds,
					likes: 0,
				} as unknown as IImage;

				const img = await this.imageRepository.create(image as IImage, session);

				// Update user images array
				await this.userRepository.update(userId, { images: [...user.images, img.url] }, session);
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
			await this.redisService.del(`feed:${userId}:*`); //invalidate user cache on new image uploads
			return result;
		} catch (error) {
			// Cleanup Cloudinary asset if transaction failed after upload
			if (cloudImagePublicId) {
				try {
					await this.imageStorageService.deleteImage(cloudImagePublicId);
				} catch (error) {
					console.error("Failed to cleanup Cloudinary image:", error);
					throw createError("StorageError", error.message, {
						function: "uploadImage",
					});
				}
			}
			throw createError(error.name, error.message, {
				function: "uploadImage",
				additionalInfo: "Transaction failed after Cloudinary upload",
			});
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

				// Delete from database
				console.log("deleting from repository:");
				await this.imageRepository.delete(imageId, session);

				// Delete from storage
				const deletionResult = await this.imageStorageService.deleteAssetByUrl(image.user.id.toString(), image.url);

				console.log(`result of await this.imageStorageService.deleteAssetByUrl: ${deletionResult}`);

				if (deletionResult.result !== "ok") {
					throw createError("StorageError", "Failed to delete from Cloudinary");
				}
				console.log("Removing cache");
				await this.redisService.del(`feed:${image.user.id}:*`); //invalidate cache

				return { message: "Image deleted successfully" };
			});
			console.log(`result of transaction: ${result}`);
			return result;
		} catch (error) {
			console.error(error);
			throw createError(error.name, error.message, {
				function: "deleteImage",
				file: "image.service.ts",
			});
		}
	}

	async getImages(page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findWithPagination({ page, limit });
		} catch (error) {
			throw createError("InternalServerError", error.message);
		}
	}

	async getUserImages(userId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
		try {
			return await this.imageRepository.findByUserId(userId, { page, limit });
		} catch (error) {
			throw createError("InternalServerError", error.message);
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
			throw createError(error.name, error.message);
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
			throw createError("InternalServerError", error.message);
		}
	}

	async getTags(): Promise<ITag[]> {
		try {
			return await this.tagRepository.getAll();
		} catch (error) {
			throw createError("InternalServerError", error.message);
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
			throw createError("InternalServerError", error.message);
		}
	}
}

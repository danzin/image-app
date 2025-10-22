import mongoose, { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { IImage, IImageStorageService } from "../types";
import { createError } from "../utils/errors";

export interface CreatePostAttachmentInput {
	buffer: Buffer;
	originalName: string;
	userInternalId: string;
	userPublicId: string;
	tagIds: mongoose.Types.ObjectId[];
	session: ClientSession;
}

export interface AttachmentSummary {
	docId: mongoose.Types.ObjectId | null;
	publicId?: string;
	url?: string;
	slug?: string;
}

export interface AttachmentCreationResult {
	imageDoc: IImage | null;
	storagePublicId: string | null;
	summary: AttachmentSummary;
}

export interface RemoveAttachmentInput {
	imageId: string;
	requesterPublicId: string;
	ownerInternalId?: string;
	ownerPublicId?: string;
	session: ClientSession;
}

export interface RemoveAttachmentResult {
	removed: boolean;
	removedPublicId?: string;
	removedUrl?: string;
}

@injectable()
export class ImageService {
	constructor(
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService
	) {}

	async createPostAttachment(input: CreatePostAttachmentInput): Promise<AttachmentCreationResult> {
		try {
			const uploaded = await this.imageStorageService.uploadImage(input.buffer, input.userPublicId);
			const slug = this.generateSlug(input.originalName);
			const createdAt = new Date();

			const imageDoc = await this.imageRepository.create(
				{
					url: uploaded.url,
					publicId: uploaded.publicId,
					originalName: input.originalName,
					slug,
					user: input.userInternalId,
					tags: input.tagIds,
					likes: 0,
					commentsCount: 0,
					createdAt,
				} as unknown as IImage,
				input.session
			);

			await this.userRepository.update(input.userInternalId, { $addToSet: { images: uploaded.url } }, input.session);

			return {
				imageDoc,
				storagePublicId: uploaded.publicId,
				summary: {
					docId: new mongoose.Types.ObjectId((imageDoc as any)._id),
					publicId: imageDoc.publicId,
					url: imageDoc.url,
					slug: (imageDoc as any).slug,
				},
			};
		} catch (error) {
			throw this.wrapError(error, "createPostAttachment");
		}
	}

	async rollbackUpload(publicId: string | null | undefined): Promise<void> {
		if (!publicId) return;
		try {
			await this.imageStorageService.deleteImage(publicId);
		} catch (error) {
			console.error("Failed to rollback image upload", error);
		}
	}

	async removePostAttachment(input: RemoveAttachmentInput): Promise<RemoveAttachmentResult> {
		try {
			const imageDoc = await this.imageRepository.findById(input.imageId, input.session);
			if (!imageDoc) {
				return { removed: false };
			}

			const owningUserId = this.resolveOwnerInternalId(imageDoc, input.ownerInternalId);
			const owningPublicId = this.resolveOwnerPublicId(imageDoc, input.ownerPublicId) ?? input.requesterPublicId;

			await this.imageStorageService
				.deleteAssetByUrl(input.requesterPublicId, owningPublicId, imageDoc.url)
				.catch((error) => console.error("Failed to delete attachment asset", error));

			await this.imageRepository.delete((imageDoc as any)._id.toString(), input.session);

			if (owningUserId) {
				const update = { $pull: { images: imageDoc.url } };
				await this.userRepository.update(owningUserId, update, input.session);
			}

			return {
				removed: true,
				removedPublicId: imageDoc.publicId,
				removedUrl: imageDoc.url,
			};
		} catch (error) {
			throw this.wrapError(error, "removePostAttachment");
		}
	}

	private resolveOwnerInternalId(imageDoc: IImage, fallback?: string): string | undefined {
		if (fallback) {
			return fallback;
		}

		const userField = (imageDoc as any).user;
		if (!userField) {
			return undefined;
		}

		if (typeof userField === "string") {
			return userField;
		}

		if (typeof userField === "object" && "_id" in userField) {
			return (userField as any)._id.toString();
		}

		return undefined;
	}

	private resolveOwnerPublicId(imageDoc: IImage, fallback?: string): string | undefined {
		if (fallback) {
			return fallback;
		}

		const userField = (imageDoc as any).user;
		if (userField && typeof userField === "object" && "publicId" in userField) {
			return (userField as any).publicId;
		}

		return undefined;
	}

	private generateSlug(originalName: string): string {
		const base = originalName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		return `${base || "image"}-${Date.now()}`;
	}

	private wrapError(error: unknown, context: string): Error {
		if (error instanceof Error) {
			return createError(error.name, error.message, {
				context,
				file: "image.service.ts",
			});
		}

		return createError("UnknownError", String(error), {
			context,
			file: "image.service.ts",
		});
	}
}

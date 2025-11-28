import mongoose from "mongoose";
import { inject, injectable } from "tsyringe";
import { ImageRepository } from "../repositories/image.repository";
import {
	AttachmentCreationResult,
	CreatePostAttachmentInput,
	IImage,
	IImageStorageService,
	ImageDocWithId,
	PopulatedUserField,
	RemoveAttachmentInput,
	RemoveAttachmentResult,
} from "../types";
import { createError } from "../utils/errors";

@injectable()
export class ImageService {
	constructor(
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService
	) {}

	async createPostAttachment(input: CreatePostAttachmentInput): Promise<AttachmentCreationResult> {
		try {
			const uploaded = await this.imageStorageService.uploadImage(input.filePath, input.userPublicId);
			const slug = this.generateSlug(input.originalName);
			const createdAt = new Date();

			const imageDoc = (await this.imageRepository.create(
				{
					url: uploaded.url,
					publicId: uploaded.publicId,
					originalName: input.originalName,
					slug,
					user: new mongoose.Types.ObjectId(input.userInternalId),
					createdAt,
				} as unknown as IImage,
				input.session
			)) as ImageDocWithId;

			return {
				imageDoc,
				storagePublicId: uploaded.publicId,
				summary: {
					docId: new mongoose.Types.ObjectId(imageDoc._id),
					publicId: imageDoc.publicId,
					url: imageDoc.url,
					slug: imageDoc.slug,
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
			const imageDoc = (await this.imageRepository.findById(input.imageId, input.session)) as ImageDocWithId | null;
			if (!imageDoc) {
				return { removed: false };
			}

			const owningPublicId = this.resolveOwnerPublicId(imageDoc, input.ownerPublicId) ?? input.requesterPublicId;

			await this.imageStorageService
				.deleteAssetByUrl(input.requesterPublicId, owningPublicId, imageDoc.url)
				.catch((error) => console.error("Failed to delete attachment asset", error));

			await this.imageRepository.delete(imageDoc._id.toString(), input.session);

			return {
				removed: true,
				removedPublicId: imageDoc.publicId,
				removedUrl: imageDoc.url,
			};
		} catch (error) {
			throw this.wrapError(error, "removePostAttachment");
		}
	}

	private resolveOwnerPublicId(imageDoc: IImage, fallback?: string): string | undefined {
		if (fallback) {
			return fallback;
		}

		const userField = imageDoc.user;
		if (userField && typeof userField === "object" && "publicId" in userField) {
			return (userField as PopulatedUserField).publicId;
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

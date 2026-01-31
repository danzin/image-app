import mongoose from "mongoose";
import { inject, injectable } from "tsyringe";
import { ImageRepository } from "@/repositories/image.repository";
import {
	AttachmentCreationResult,
	CreatePostAttachmentInput,
	DeleteAttachmentAssetInput,
	IImage,
	IImageStorageService,
	ImageDocWithId,
	PopulatedUserField,
	RemoveAttachmentRecordInput,
	RemoveAttachmentRecordResult,
	RemoveAttachmentInput,
	RemoveAttachmentResult,
} from "@/types";
import { createError } from "@/utils/errors";
import { logger } from "@/utils/winston";

@injectable()
export class ImageService {
	constructor(
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService,
	) {}

	async createPostAttachment(input: CreatePostAttachmentInput): Promise<AttachmentCreationResult> {
		let uploaded: { url: string; publicId: string } | undefined;
		try {
			uploaded = await this.imageStorageService.uploadImage(input.filePath, input.userPublicId);
			return await this.createImageRecord({
				url: uploaded.url,
				storagePublicId: uploaded.publicId,
				originalName: input.originalName,
				userInternalId: input.userInternalId,
				session: input.session,
			});
		} catch (error) {
			if (uploaded) {
				await this.rollbackUpload(uploaded.publicId);
			}
			throw this.wrapError(error, "createPostAttachment");
		}
	}

	async uploadImage(filePath: string, userPublicId: string): Promise<{ url: string; publicId: string }> {
		return this.imageStorageService.uploadImage(filePath, userPublicId);
	}

	async createImageRecord(input: {
		url: string;
		storagePublicId: string;
		originalName: string;
		userInternalId: string;
		session?: mongoose.ClientSession;
	}): Promise<AttachmentCreationResult> {
		try {
			const slug = this.generateSlug(input.originalName);
			const createdAt = new Date();

			const imageDoc = (await this.imageRepository.create(
				{
					url: input.url,
					publicId: input.storagePublicId,
					originalName: input.originalName,
					slug,
					user: new mongoose.Types.ObjectId(input.userInternalId),
					createdAt,
				} as unknown as IImage,
				input.session,
			)) as ImageDocWithId;

			return {
				imageDoc,
				storagePublicId: input.storagePublicId,
				summary: {
					docId: new mongoose.Types.ObjectId(imageDoc._id),
					publicId: imageDoc.publicId,
					url: imageDoc.url,
					slug: imageDoc.slug,
				},
			};
		} catch (error) {
			throw this.wrapError(error, "createImageRecord");
		}
	}

	async rollbackUpload(publicId: string | null | undefined): Promise<void> {
		if (!publicId) return;
		try {
			await this.imageStorageService.deleteImage(publicId);
		} catch (error) {
			logger.error("Failed to rollback image upload", { error });
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
				.catch((error) => logger.error("Failed to delete attachment asset", { error }));

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

	async removePostAttachmentRecord(input: RemoveAttachmentRecordInput): Promise<RemoveAttachmentRecordResult> {
		try {
			const imageDoc = (await this.imageRepository.findById(input.imageId, input.session)) as ImageDocWithId | null;
			if (!imageDoc) {
				return { removed: false };
			}

			await this.imageRepository.delete(imageDoc._id.toString(), input.session);

			return {
				removed: true,
				removedPublicId: imageDoc.publicId,
				removedUrl: imageDoc.url,
			};
		} catch (error) {
			throw this.wrapError(error, "removePostAttachmentRecord");
		}
	}

	async deleteAttachmentAsset(input: DeleteAttachmentAssetInput): Promise<void> {
		await this.imageStorageService.deleteAssetByUrl(input.requesterPublicId, input.ownerPublicId, input.url);
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

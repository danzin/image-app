import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";

import { createError } from "../utils/errors";
import { CloudinaryDeleteResponse, DeletionResult } from "../types";
import { injectable, inject } from "tsyringe";
import { IImageStorageService } from "../types/customImageStorage/imageStorage.types";
import { logger } from "../utils/winston";
import { RetryService, RetryPresets } from "./retry.service";

@injectable()
export class CloudinaryService implements IImageStorageService {
	constructor(@inject("RetryService") private readonly retryService: RetryService) {
		cloudinary.config({
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
			api_key: process.env.CLOUDINARY_API_KEY,
			api_secret: process.env.CLOUDINARY_API_SECRET,
		});
	}
	private extractPublicId(url: string): string | null {
		const regex = /\/(?:v\d+\/)?([^\/]+)\.[a-zA-Z]+$/;
		const matches = url.match(regex);
		return matches ? matches[1] : null;
	}

	/**
	 * Check if an error is retryable for Cloudinary operations
	 */
	private isCloudinaryRetryable(error: any): boolean {
		if (!error) return false;
		const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
		const retryablePatterns = [
			"timeout",
			"econnreset",
			"econnrefused",
			"socket hang up",
			"network",
			"rate limit",
			"too many requests",
			"503",
			"502",
			"504",
		];
		return retryablePatterns.some((p) => message.includes(p));
	}

	async uploadImage(filePath: string, userId: string): Promise<{ url: string; publicId: string }> {
		try {
			return this.retryService.execute(
				() =>
					new Promise((resolve, reject) => {
						const stream = cloudinary.uploader.upload_stream({ folder: userId }, (error, result) => {
							if (error) {
								const errorName = error.name || "StorageError";
								const errorMessage = error.message || "Error uploading image";
								return reject(createError(errorName, errorMessage));
							}
							if (!result) {
								return reject(createError("StorageError", "Upload failed, no result returned"));
							}
							resolve({
								url: result.secure_url,
								publicId: result.public_id,
							});
						});

						fs.createReadStream(filePath).pipe(stream);
					}),
				{
					...RetryPresets.externalApi(),
					shouldRetry: (err) => this.isCloudinaryRetryable(err),
				}
			);
		} finally {
			await fs.promises
				.unlink(filePath)
				.catch((err) => logger.error(`Failed to cleanup temp file: ${filePath}`, { error: err }));
		}
	}

	async deleteAssetByUrl(username: string, url: string): Promise<{ result: string }> {
		const publicId = this.extractPublicId(url);
		if (!publicId) {
			throw new Error("Invalid URL format");
		}

		return this.retryService.execute(
			async () => {
				logger.info("URL of image about to delete:", url);
				const assetPath = `${username}/${publicId}`;
				const result = await cloudinary.uploader.destroy(assetPath);
				logger.info(result);

				// return only the necessary fields to make sure object doesn't get polluted with unserializable data
				return { result: result.result };
			},
			{
				...RetryPresets.externalApi(),
				shouldRetry: (err) => this.isCloudinaryRetryable(err),
			}
		);
	}

	// deletes image by public Id
	async deleteImage(publicId: string): Promise<void> {
		await this.retryService.execute(
			async () => {
				await cloudinary.uploader.destroy(publicId);
			},
			{
				...RetryPresets.externalApi(),
				shouldRetry: (err) => this.isCloudinaryRetryable(err),
			}
		);
	}

	// deletes lots of images with username prefix
	async deleteMany(username: string): Promise<DeletionResult> {
		return this.retryService
			.execute(
				async () => {
					const result = await cloudinary.api.delete_resources_by_prefix(username);
					return this.processDeleteResponse(result);
				},
				{
					...RetryPresets.externalApi(),
					shouldRetry: (err) => this.isCloudinaryRetryable(err),
				}
			)
			.catch((error) => ({
				result: "error" as const,
				message: error instanceof Error ? error.message : "Error deleting cloudinary resources",
			}));
	}

	/**
	 * @processDeleteResponse method accepts the response from the resolved promise returned by cloudinary.api.delete_resources_by_prefix
	 * Object.value() converts the response object's deleted_counts into an array
	 * of the values of the object. The object in this case is {'username/imagename': { original: x, derived: 0 }}
	 * The array looks like this:
	 * [
	 *  { original: 1, derived: 0 }
	 * ]
	 * .some() is an array method that returns true if AT LEAST ONE
	 * element in the array satisfies the condition in the callback function.
	 * The count parameter in the callback of `some()` is each object like { original: 1, derived: 0 }.
	 * and the condition is > 0
	 * That way there are no unnecessary errors from successful deletions
	 */
	private processDeleteResponse(response: CloudinaryDeleteResponse): DeletionResult {
		const hasSuccessfulDeletions = Object.values(response.deleted_counts).some((count) => count.original > 0);

		if (hasSuccessfulDeletions) {
			return { result: "ok" };
		}

		return {
			result: "error",
			message: "No resources were deleted",
		};
	}
}

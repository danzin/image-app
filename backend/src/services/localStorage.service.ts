import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { IImageStorageService } from "../types";
import { injectable } from "tsyringe";
import { createError } from "../utils/errors";
import { logger } from "../utils/winston";

@injectable()
export class LocalStorageService implements IImageStorageService {
	private uploadsDir: string;

	constructor() {
		this.uploadsDir = path.join(process.cwd(), "uploads");
		if (!fs.existsSync(this.uploadsDir)) {
			fs.mkdirSync(this.uploadsDir, { recursive: true });
		}
		logger.info("LocalStorageService: Uploads directory path inside container:", { uploadsDir: this.uploadsDir });
	}

	async uploadImage(filePath: string, userId: string): Promise<{ url: string; publicId: string }> {
		try {
			const safeUserId = this.validateUserId(userId);

			const filename = `${uuidv4()}.png`;
			logger.info("UserID in local storage service:", { safeUserId });

			// Safely join paths with traversal protection
			const userDir = this.safeJoin(this.uploadsDir, safeUserId);
			const destFilepath = this.safeJoin(userDir, filename);

			if (!fs.existsSync(userDir)) {
				fs.mkdirSync(userDir, { recursive: true });
			}

			// Try to move the file efficiently using rename which is O(1) if they're on the same filesystem
			try {
				await fs.promises.rename(filePath, destFilepath);
			} catch (error: any) {
				// Fallback for EXDEV if /tmp and /uploads are on different partitions in the contaner
				if (error.code === "EXDEV") {
					await fs.promises.copyFile(filePath, destFilepath);
					// don't unlink here because the handler's finally block handles cleanup
					// but since rename would remove it and copy doesnt
					// I'll let the handler to clean up the source file if it still exists
					// If rename succeeds, the file is gone from source.
					// If copy succeeds, the file remains at source.
					// The CQRS handler checks fs.existsSync(command.imagePath) before unlinking so it handles both cases
				} else {
					throw error;
				}
			}

			const url = `/uploads/${safeUserId}/${filename}`;

			return { url, publicId: filename };
		} catch (error) {
			logger.error("Failed to upload image", { error });
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	async deleteImage(publicId: string): Promise<void> {
		try {
			// validate filename format
			const safeFileName = this.validateFileName(publicId);

			// search for the file in all user directories
			const userDirs = await fs.promises.readdir(this.uploadsDir);

			for (const userDir of userDirs) {
				// validate each user directory name is a UUID
				try {
					const safeUserDir = this.validateUserId(userDir);
					const filePath = this.safeJoin(this.uploadsDir, safeUserDir, safeFileName);

					if (fs.existsSync(filePath)) {
						await fs.promises.unlink(filePath);
						return;
					}
				} catch (err) {
					logger.warn(`Skipping invalid user directory: ${userDir}`, { error: err });
					continue;
				}
			}
		} catch (error) {
			logger.error("Error deleting asset", { error });
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	/**
	 * Delete an asset by URL
	 * Authorization must be handled by the calling handler/service BEFORE invoking this method
	 * This service only handles file operations, not permission checks
	 */
	async deleteAssetByUrl(_requesterPublicId: string, ownerPublicId: string, url: string): Promise<{ result: string }> {
		// parse & decode URL robustly
		const parsed = (() => {
			try {
				return new URL(url, "http://localhost");
			} catch {
				return null;
			}
		})();
		if (!parsed) throw createError("StorageError", "Invalid URL");
		const pathname = decodeURIComponent(parsed.pathname);

		const publicId = this.extractPublicId(pathname);
		if (!publicId) throw createError("StorageError", "Could not extract publicId from URL");

		// validate filename and ownerPublicId
		const safeFileName = this.validateFileName(publicId);
		const safeOwner = this.validateUserId(ownerPublicId);

		const assetPath = this.safeJoin(this.uploadsDir, safeOwner, safeFileName);

		// lstat + symlink/file check
		const stat = await fs.promises.lstat(assetPath).catch(() => null);
		if (!stat || !stat.isFile()) {
			return { result: "skipped" };
		}
		if (stat.isSymbolicLink()) {
			throw createError("StorageError", "Refusing to remove symlink");
		}

		await fs.promises.unlink(assetPath);
		return { result: "ok" };
	}

	async deleteMany(username: string): Promise<{ result: "ok" | "error"; message?: string }> {
		try {
			// validate username is a proper UUID v4
			const safeUsername = this.validateUserId(username);

			// safely join paths with traversal protection
			const userDir = this.safeJoin(this.uploadsDir, safeUsername);

			if (!fs.existsSync(userDir)) {
				return {
					result: "ok",
					message: "User folder does not exist, nothing to delete.",
				};
			}

			const files = await fs.promises.readdir(userDir);
			if (files.length === 0) {
				return { result: "ok", message: "User folder is already empty." };
			}

			// only delete files that match the expected format
			await Promise.all(
				files.map(async (file) => {
					try {
						// validate each file is a proper image file
						const safeFileName = this.validateFileName(file);
						const filePath = this.safeJoin(userDir, safeFileName);
						await fs.promises.unlink(filePath);
					} catch (err) {
						// skip files that don't match expected format
						logger.warn(`Skipping invalid file: ${file}`, { error: err });
					}
				})
			);

			// remove directory if empty
			const remainingFiles = await fs.promises.readdir(userDir);
			if (remainingFiles.length === 0) {
				await fs.promises.rmdir(userDir);
			}

			return {
				result: "ok",
				message: `Successfully deleted all images for user: ${safeUsername}`,
			};
		} catch (error) {
			logger.error("Error deleting multiple assets:", { error });
			return {
				result: "error",
				message: error instanceof Error ? error.message : "Error deleting local storage resources",
			};
		}
	}

	/* Methods to validate inputs in order to prevent directory traversal attacks */
	private validateUserId(userId: string): string {
		// remove null bytes and trim
		const cleaned = String(userId).replace(/\0/g, "").trim();

		const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

		if (!uuidV4Regex.test(cleaned)) {
			throw createError("SecurityError", "Invalid user identifier format");
		}

		return cleaned;
	}

	private validateFileName(fileName: string): string {
		// remove null bytes and use basename to prevent directory traversal
		const cleaned = path.basename(String(fileName).replace(/\0/g, "").trim());

		// expected format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.png
		const fileNameRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$/i;

		if (!fileNameRegex.test(cleaned)) {
			throw createError("SecurityError", "Invalid file name format");
		}

		return cleaned;
	}

	// safe path join that prevents directory traversal
	private safeJoin(base: string, ...segments: string[]): string {
		const resolvedBase = path.resolve(base);
		const resolvedPath = path.resolve(resolvedBase, ...segments);
		const relativePath = path.relative(resolvedBase, resolvedPath);

		// check if resolved path escapes base directory
		if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
			throw createError("SecurityError", "Path traversal attempt detected");
		}

		return resolvedPath;
	}

	private extractPublicId(url: string): string | null {
		try {
			// if url is absolute, parse; if relative, prepend origin so URL works
			const parsed = new URL(url, "http://localhost");
			const pathname = decodeURIComponent(parsed.pathname);
			const match = pathname.match(/\/uploads\/[^\/]+\/([^\/]+)$/);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	}
}

import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { IImageStorageService } from "../types";
import { injectable } from "tsyringe";
import { createError } from "../utils/errors";

@injectable()
export class LocalStorageService implements IImageStorageService {
	private uploadsDir: string;
	private isAdminFlag: boolean;
	constructor() {
		this.isAdminFlag = false;
		this.uploadsDir = path.join(process.cwd(), "uploads");
		if (!fs.existsSync(this.uploadsDir)) {
			fs.mkdirSync(this.uploadsDir, { recursive: true });
		}
		console.log("LocalStorageService: Uploads directory path inside container:", this.uploadsDir);
	}

	async uploadImage(file: Buffer, userId: string): Promise<{ url: string; publicId: string }> {
		try {
			// validate userId is a proper UUID v4
			const safeUserId = this.validateUserId(userId);

			// generate filename with UUID v4
			const filename = `${uuidv4()}.png`;
			console.log("UserID in local storage service:", safeUserId);

			// safely join paths with traversal protection
			const userDir = this.safeJoin(this.uploadsDir, safeUserId);
			const filepath = this.safeJoin(userDir, filename);

			if (!fs.existsSync(userDir)) {
				fs.mkdirSync(userDir, { recursive: true });
			}

			await fs.promises.writeFile(filepath, file);
			const url = `/uploads/${safeUserId}/${filename}`;

			return { url, publicId: filename };
		} catch (error) {
			console.error(error);
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
					console.warn(`Skipping invalid user directory: ${userDir}, error: ${err}`);
					continue;
				}
			}
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	// async deleteAssetByUrl(username: string, url: string): Promise<{ result: string }> {
	// 	if (!this.isLocalUrl(url)) {
	// 		console.log(`Skipping deletion of non-local URL: ${url}`);
	// 		return { result: "skipped" };
	// 	}

	// 	try {
	// 		console.log("URL of image about to delete:", url);

	// 		// validate username is a proper UUID v4
	// 		const safeUsername = this.validateUserId(username);

	// 		// extract publicId from URL
	// 		const publicId = this.extractPublicId(url);
	// 		if (!publicId) {
	// 			throw createError("StorageError", "Could not extract publicId from URL");
	// 		}

	// 		// validate filename format
	// 		const safeFileName = this.validateFileName(publicId);

	// 		// safely join paths with traversal protection
	// 		const assetPath = this.safeJoin(this.uploadsDir, safeUsername, safeFileName);

	// 		await fs.promises.unlink(assetPath);
	// 		return { result: "ok" };
	// 	} catch (error) {
	// 		console.error("Error deleting asset:", error);
	// 		if (error instanceof Error) {
	// 			throw createError("StorageError", error.message);
	// 		} else {
	// 			throw createError("StorageError", String(error));
	// 		}
	// 	}
	// }

	async deleteAssetByUrl(requesterPublicId: string, ownerPublicId: string, url: string): Promise<{ result: string }> {
		if (!requesterPublicId) throw createError("AuthError", "Missing requester identity");

		// ownership enforcement: allow if requester == owner OR requester is admin
		if (requesterPublicId !== ownerPublicId && !this.isAdmin(requesterPublicId)) {
			throw createError("ForbiddenError", "Not allowed to delete another user's asset");
		}

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
						console.warn(`Skipping invalid file: ${file}, error: ${err}`);
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
			console.error("Error deleting multiple assets:", error);
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

	// validate filename format (UUID v4 + .png extension)
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

	private isAdmin(userId: string): boolean {
		return this.isAdminFlag;
	}

	private extractPublicId(url: string): string | null {
		try {
			// If url is absolute, parse; if relative, prepend origin so URL works
			const parsed = new URL(url, "http://localhost");
			const pathname = decodeURIComponent(parsed.pathname);
			const match = pathname.match(/\/uploads\/[^\/]+\/([^\/]+)$/);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	}

	private isLocalUrl(url: string): boolean {
		return url.startsWith("http://localhost:3000/uploads/") || url.startsWith("/uploads/");
	}
}

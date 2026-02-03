export interface IImageStorageService {
	uploadImage(filePath: string, userId: string, folder?: string): Promise<{ url: string; publicId: string }>;
	deleteImage(publicId: string): Promise<void>;
	deleteAssetByUrl(requesterPublicId: string, ownerPublicId: string, url: string): Promise<{ result: string }>;
	deleteMany(userId: string): Promise<{
		result: "ok" | "error";
		message?: string;
	}>;
}

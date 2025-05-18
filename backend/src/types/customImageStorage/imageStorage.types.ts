export interface IImageStorageService {
  uploadImage(
    file: Buffer,
    userId: string
  ): Promise<{ url: string; publicId: string }>;
  deleteImage(publicId: string): Promise<void>;
  deleteAssetByUrl(userId: string, url: string): Promise<{ result: string }>;
  deleteMany(userId: string): Promise<{
    result: "ok" | "error";
    message?: string;
  }>;
}

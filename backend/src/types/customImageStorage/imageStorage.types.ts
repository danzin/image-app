

export interface IImageStorageService {
  uploadImage(file: Buffer, username: string): Promise<{url: string, publicId: string}>;
  deleteImage(publicId: string): Promise<void>;
  deleteAssetByUrl(username: string, url: string): Promise<{result: string}>;
  deleteMany(username: string): Promise<{
    result: 'ok' | 'error';
    message?: string;
  }>
}
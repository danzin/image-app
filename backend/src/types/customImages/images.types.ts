import { Document } from "mongoose";

export interface IImage extends Document {
	url: string;
	publicId: string;
	user: {
		publicId: string;
		username: string;
		avatar: string;
	};
	title?: string;
	slug: string;
	originalName: string;
	createdAt: Date;
}

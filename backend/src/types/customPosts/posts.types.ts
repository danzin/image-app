import mongoose, { ClientSession, Document } from "mongoose";
import { IImage } from "types/customImages/images.types";

export interface IPost extends Document {
	publicId: string;
	user: mongoose.Types.ObjectId;
	author: {
		_id: mongoose.Types.ObjectId;
		publicId: string;
		username: string;
		avatarUrl?: string;
		displayName?: string;
	};
	body?: string;
	slug?: string;
	image?: mongoose.Types.ObjectId | null;
	tags: mongoose.Types.ObjectId[];
	likesCount: number;
	commentsCount: number;
	viewsCount: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreatePostAttachmentInput {
	buffer: Buffer;
	originalName: string;
	userInternalId: string;
	userPublicId: string;
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

export interface IPostWithId extends IPost {
	_id: mongoose.Types.ObjectId;
}

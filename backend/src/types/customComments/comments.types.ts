import mongoose, { Document } from "mongoose";

export interface IComment extends Document {
	_id: mongoose.Types.ObjectId;
	content: string;
	imageId: mongoose.Types.ObjectId;
	userId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

export interface CommentCreateDto {
	content: string;
	imageId: string;
	userId: string;
}

export interface CommentUpdateDto {
	content: string;
}

export interface CommentResponseDto {
	id: string;
	content: string;
	imageId: string;
	user: {
		id: string;
		username: string;
		avatar?: string;
	};
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

export interface CommentsPaginationResponse {
	comments: CommentResponseDto[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

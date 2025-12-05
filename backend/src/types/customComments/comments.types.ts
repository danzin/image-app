import mongoose, { Document } from "mongoose";
import { Types } from "mongoose";

export interface IComment extends Document {
	_id: mongoose.Types.ObjectId;
	content: string;
	postId: mongoose.Types.ObjectId;
	userId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

export interface CommentCreateDto {
	content: string;
	postId: string;
	userId: string;
}

export interface CommentUpdateDto {
	content: string;
}

export interface CommentResponseDto {
	id: string;
	content: string;
	postId: string;
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

export interface TransformedComment {
	id: string;
	content: string;
	postPublicId: string;
	user: {
		publicId: string;
		username: string;
		avatar?: string;
	};
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

// interface for populated comment from lean() query
export interface PopulatedCommentLean {
	_id: Types.ObjectId;
	content: string;
	postId: { publicId: string };
	userId: { publicId: string; username: string; avatar?: string };
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

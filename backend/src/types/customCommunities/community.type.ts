import { Document, Types } from "mongoose";

export interface ICommunity extends Document {
	_id: Types.ObjectId;
	publicId: string;
	name: string;
	slug: string;
	description: string;
	avatar: string;
	coverPhoto: string;
	creatorId: Types.ObjectId;
	stats: {
		memberCount: number;
		postCount: number;
	};
	createdAt: Date;
	updatedAt: Date;
}

import { ObjectId } from "mongoose";

export interface ICommunity {
	_id: ObjectId;
	name: string;
	slug: string;
	description: string;
	creatorId: ObjectId;
	stats: {
		memberCount: number;
		postCount: number;
	};
	createdAt: Date;
}

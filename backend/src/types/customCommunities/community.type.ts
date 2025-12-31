import { ObjectId } from "mongoose";

export interface Community {
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

import { ObjectId } from "mongoose";

export interface ICommunityMember {
	_id: ObjectId;
	communityId: ObjectId;
	userId: ObjectId;
	role: "admin" | "moderator" | "member";
	joinedAt: Date;
}

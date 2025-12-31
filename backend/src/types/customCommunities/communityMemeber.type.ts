import { ObjectId } from "mongoose";

export interface CommunityMember {
	_id: ObjectId;
	communityId: ObjectId;
	userId: ObjectId;
	role: "admin" | "moderator" | "member";
	joinedAt: Date;
}

import { Document, Types } from "mongoose";

export interface ICommunityMember extends Document {
	_id: Types.ObjectId;
	communityId: Types.ObjectId;
	userId: Types.ObjectId;
	role: "admin" | "moderator" | "member";
	joinedAt: Date;
}

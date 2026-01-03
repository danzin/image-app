import mongoose, { Schema } from "mongoose";
import { ICommunityMember } from "../types";

const communityMemberSchema = new Schema<ICommunityMember>({
	communityId: { type: Schema.Types.ObjectId, ref: "Community", required: true },
	userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
	role: {
		type: String,
		enum: ["admin", "moderator", "member"],
		default: "member",
	},
	joinedAt: { type: Date, default: Date.now },
});

// Compound Index
communityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });
communityMemberSchema.index({ userId: 1 });

export const CommunityMember = mongoose.model<ICommunityMember>("CommunityMember", communityMemberSchema);

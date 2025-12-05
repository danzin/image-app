import { Document, Types } from "mongoose";

export interface IPostLike extends Document<Types.ObjectId, {}, IPostLike> {
	_id: Types.ObjectId;
	userId: Types.ObjectId;
	postId: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

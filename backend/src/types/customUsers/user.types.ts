import { Document, Types } from "mongoose";

export interface IUser extends Document {
	publicId: string;
	username: string;
	email: string;
	avatar: string;
	cover: string;
	password: string;
	bio: string;
	createdAt: Date;
	updatedAt: Date;
	isAdmin: boolean;
	isBanned: boolean;
	bannedAt?: Date;
	bannedReason?: string;
	bannedBy?: Types.ObjectId | string;
	postCount?: number;
	followerCount?: number;
	followingCount?: number;
	comparePassword(candidatePassword: string): Promise<boolean>;
}

// Create a user lookup map using publicId
export interface UserLookupData {
	publicId: string;
	username: string;
	avatar?: string;
}

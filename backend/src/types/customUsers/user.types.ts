import { Document, Types } from "mongoose";

export interface IUser extends Document {
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
	images: string[];
	followers: string[];
	following: string[];
	comparePassword(candidatePassword: string): Promise<boolean>;
}

import { Document, Types } from "mongoose";
import { IPost } from "../customPosts/posts.types";
import { ICommunityCacheItem } from "../customCommunities/communityCacheItem.types";

export interface IUser extends Document {
	publicId: string;
	username: string;
	email: string;
	joinedCommunities: ICommunityCacheItem[];
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
	resetToken?: string;
	resetTokenExpires?: Date;
	isEmailVerified?: boolean;
	emailVerificationToken?: string;
	emailVerificationExpires?: Date;

	comparePassword(candidatePassword: string): Promise<boolean>;
	canViewPost(post: Pick<IPost, "canBeViewedBy" | "user" | "author">): boolean;
}

// Create a user lookup map using publicId
export interface UserLookupData {
	publicId: string;
	username: string;
	avatar?: string;
}

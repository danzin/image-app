interface BaseUserDTO {
	publicId: string;
	handle: string;
	username: string;
	avatar?: string;
	cover?: string;
	followerCount: number;
	followingCount: number;
	createdAt: Date;
	bio?: string;
	postCount: number;
}

export interface AdminUserDTO extends BaseUserDTO {
	email: string;
	isEmailVerified: boolean;
	isAdmin: boolean;
	isBanned: boolean;
	bannedAt?: Date;
	bannedReason?: string;
	bannedBy?: string;
	updatedAt: Date;
}

export interface PublicUserDTO extends BaseUserDTO {}

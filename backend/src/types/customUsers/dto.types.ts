interface BaseUserDTO {
	id: string;
	username: string;
	avatar?: string;
	cover?: string;
	images?: string[];
	followers?: string[];
	following?: string[];
	createdAt: Date;
	bio?: string;
}

export interface AdminUserDTO extends BaseUserDTO {
	email: string;
	isAdmin: boolean;
	isBanned: boolean;
	bannedAt?: Date;
	bannedReason?: string;
	bannedBy?: string;
	updatedAt: Date;
}

export interface PublicUserDTO extends BaseUserDTO {}

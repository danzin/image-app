import { injectable } from "tsyringe";
import { IUser, IImage } from "../types";

export interface PublicUserDTO {
	publicId: string;
	username: string;
	avatar: string;
	cover: string;
	bio: string;
	createdAt: Date;
	followerCount: number;
	followingCount: number;
	imageCount: number;
}

export interface AuthenticatedUserDTO extends PublicUserDTO {
	email: string; // Only for the user themselves
}

export interface AdminUserDTO extends AuthenticatedUserDTO {
	isAdmin: boolean;
	isBanned: boolean;
	bannedAt?: Date;
	bannedReason?: string;
	bannedBy?: string;
	updatedAt: Date;
}

export interface PublicImageDTO {
	publicId: string;
	slug: string;
	url: string;
	title?: string;
	tags: string[];
	user: {
		publicId: string;
		username: string;
		avatar: string;
	};
	likes: number;
	commentsCount: number;
	createdAt: Date;
	isLikedByViewer?: boolean; // Only when user is authenticated
}

@injectable()
export class DTOService {
	toPublicUserDTO(user: IUser, viewerUserId?: string): PublicUserDTO {
		return {
			publicId: user.publicId,
			username: user.username,
			avatar: user.avatar,
			cover: user.cover,
			bio: user.bio,
			createdAt: user.createdAt,
			followerCount: user.followers?.length || 0,
			followingCount: user.following?.length || 0,
			imageCount: user.images?.length || 0,
		};
	}

	toAuthenticatedUserDTO(user: IUser): AuthenticatedUserDTO {
		return {
			...this.toPublicUserDTO(user),
			email: user.email,
		};
	}

	// Convenience methods with shorter names for backward compatibility
	toPublicDTO(user: IUser, viewerUserId?: string): PublicUserDTO {
		return this.toPublicUserDTO(user, viewerUserId);
	}

	toAdminDTO(user: IUser): AdminUserDTO {
		return {
			...this.toPublicUserDTO(user),
			email: user.email,
			isAdmin: user.isAdmin,
			isBanned: user.isBanned,
			bannedAt: user.bannedAt,
			bannedReason: user.bannedReason,
			bannedBy: user.bannedBy?.toString(),
			updatedAt: user.updatedAt,
		};
	}

	toPublicImageDTO(image: IImage, viewerUserId?: string): PublicImageDTO {
		return {
			publicId: image.publicId,
			slug: image.slug,
			url: image.url,
			title: image.title,
			tags: image.tags?.map((tag) => tag.tag) || [],
			user: {
				publicId: image.user.publicId,
				username: image.user.username,
				avatar: image.user.avatar,
			},
			likes: image.likes || 0,
			commentsCount: image.commentsCount || 0,
			createdAt: image.createdAt,
			isLikedByViewer: viewerUserId ? image.likedBy?.includes(viewerUserId) : undefined,
		};
	}
}

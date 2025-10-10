import { injectable } from "tsyringe";
import { IUser, IImage, IMessage, MessageDTO } from "../types";

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
	isFavoritedByViewer?: boolean;
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

	toPublicImageDTO(image: IImage): PublicImageDTO {
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
			isLikedByViewer: (image as any).isLikedByViewer || false,
			isFavoritedByViewer: (image as any).isFavoritedByViewer || false,
		};
	}

	toPublicMessageDTO(message: IMessage, conversationPublicId: string): MessageDTO {
		const sender: any = (message as any).sender || {};

		const readBy = Array.isArray((message as any).readBy)
			? (message as any).readBy.map((entry: any) => {
					if (!entry) return "";
					if (typeof entry === "string") return entry;
					if (typeof entry === "object" && "publicId" in entry) {
						return (entry as any).publicId;
					}
					if (typeof entry === "object" && typeof entry.toString === "function") {
						return entry.toString();
					}
					return String(entry);
			  })
			: [];

		const attachments = Array.isArray((message as any).attachments) ? (message as any).attachments : [];

		const createdAtValue = (message as any).createdAt;
		const createdAt = createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue);

		return {
			publicId: (message as any).publicId,
			conversationId: conversationPublicId,
			body: (message as any).body,
			sender: {
				publicId: sender?.publicId ?? "",
				username: sender?.username ?? "",
				avatar: sender?.avatar ?? "",
			},
			attachments,
			status: (message as any).status,
			createdAt: createdAt.toISOString(),
			readBy: readBy.filter((value: string) => Boolean(value)),
		};
	}
}

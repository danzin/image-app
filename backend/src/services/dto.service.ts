import { injectable } from "tsyringe";
import { IUser, IMessage, MessageDTO, PostDTO } from "../types";

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

@injectable()
export class DTOService {
	/**
	 * Converts a raw post document to PostDTO
	 * Handles both Mongo documents and aggregation results
	 */
	toPostDTO(post: any): PostDTO {
		const tags = Array.isArray(post.tags)
			? post.tags.map((tag: any) => {
					if (typeof tag === "string") return tag;
					if (tag?.tag) return tag.tag;
					return "";
				})
			: [];

		const imageData = post.image ? (post.image as any) : null;
		const url = imageData?.url || undefined;
		const imagePublicId = imageData?.publicId || undefined;

		// Create nested image object if image exists
		const image = imageData && url && imagePublicId ? { url, publicId: imagePublicId } : null;

		return {
			publicId: post.publicId,
			body: post.body,
			slug: post.slug,
			// Nested format
			image,
			// Legacy flat format for backward compatibility
			url,
			imagePublicId,
			tags: tags.filter(Boolean),
			likes: post.likes ?? post.likesCount ?? 0,
			commentsCount: post.commentsCount ?? 0,
			viewsCount: post.viewsCount ?? 0,
			createdAt: post.createdAt,
			isLikedByViewer: post.isLikedByViewer,
			isFavoritedByViewer: post.isFavoritedByViewer,
			user: {
				publicId: post.user?.publicId ?? post.user?.id ?? "",
				username: post.user?.username ?? "",
				avatar: post.user?.avatar ?? "",
			},
		};
	}
	toPublicUserDTO(user: IUser, _viewerUserId?: string): PublicUserDTO {
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
	toPublicDTO(user: IUser): PublicUserDTO {
		return this.toPublicUserDTO(user);
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

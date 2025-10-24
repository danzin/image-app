import { injectable } from "tsyringe";
import { IUser, IImage, IMessage, MessageDTO, PostDTO } from "../types";

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

	toPublicPostDTO(
		post: PostDTO
	): PublicImageDTO & { body?: string; image?: { publicId: string; url: string; slug?: string } } {
		// Build the response object
		const response: any = {
			publicId: post.publicId,
			slug: post.slug ?? post.publicId,
			body: post.body,

			user: {
				publicId: post.user.publicId,
				username: post.user.username,
				avatar: post.user.avatar,
			},
			likes: post.likes,
			commentsCount: post.commentsCount,
			createdAt: post.createdAt,
			isLikedByViewer: post.isLikedByViewer ?? false,
			isFavoritedByViewer: post.isFavoritedByViewer ?? false,
		};

		// Add image data if present (for backward compatibility, keep both formats)
		if (post.url && post.imagePublicId) {
			response.image = {
				publicId: post.imagePublicId,
				url: post.url,
				slug: post.slug,
			};
			response.url = post.url; // Backward compatibility
		} else {
			response.url = "";
		}

		return response;
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

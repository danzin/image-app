import { injectable } from "tsyringe";
import { IUser, IMessage, IMessageAttachment, MessageDTO, PostDTO, IMessagePopulated } from "../types";

export interface PublicUserDTO {
	publicId: string;
	username: string;
	avatar: string;
	cover: string;
	bio: string;
	createdAt: Date;
	postCount: number;
	followerCount: number;
	followingCount: number;
}

export interface AuthenticatedUserDTO extends PublicUserDTO {
	email: string;
	isEmailVerified: boolean;
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
		const likeCount = Array.isArray(post.likes)
			? post.likes.length
			: typeof post.likes === "number"
				? post.likes
				: typeof post.likesCount === "number"
					? post.likesCount
					: 0;

		const userSnapshot = this.resolvePostUserSnapshot(post);

		const repostOf = this.buildRepostOf(post.repostOf);

		return {
			publicId: post.publicId,
			body: post.body,
			slug: post.slug,
			type: post.type ?? "original",
			repostCount: post.repostCount ?? 0,
			repostOf: repostOf,
			// Nested format
			image,
			// Legacy flat format for backward compatibility
			url,
			imagePublicId,
			tags: tags.filter(Boolean),
			likes: likeCount,
			commentsCount: post.commentsCount ?? 0,
			viewsCount: post.viewsCount ?? 0,
			createdAt: post.createdAt,
			isLikedByViewer: post.isLikedByViewer,
			isFavoritedByViewer: post.isFavoritedByViewer,
			user: {
				publicId: userSnapshot.publicId,
				username: userSnapshot.username,
				avatar: userSnapshot.avatar,
			},
			community: this.buildCommunity(post.community ?? post.communityId),
		};
	}

	private buildCommunity(source: any) {
		if (!source || typeof source !== "object") return null;
		const publicId = this.pickString(source.publicId);
		if (!publicId) return null;
		return {
			publicId,
			name: this.pickString(source.name) || "",
			slug: this.pickString(source.slug) || "",
			avatar: this.pickString(source.avatar) || undefined,
		};
	}

	private buildRepostOf(source: any) {
		if (!source) return undefined;
		const imageData = source.image ? (source.image as any) : null;
		const image = imageData?.url && imageData?.publicId ? { url: imageData.url, publicId: imageData.publicId } : null;
		const userSnapshot = this.resolvePostUserSnapshot(source);
		return {
			publicId: source.publicId,
			user: {
				publicId: userSnapshot.publicId,
				username: userSnapshot.username,
				avatar: userSnapshot.avatar,
			},
			body: source.body,
			slug: source.slug,
			image,
		};
	}

	private resolvePostUserSnapshot(post: any) {
		const normalizedUser = this.normalizeUserLike(post?.user);
		if (normalizedUser) {
			return normalizedUser;
		}

		return this.normalizeAuthorLike(post?.author);
	}

	private normalizeUserLike(candidate: any) {
		if (!candidate || typeof candidate !== "object") {
			return null;
		}

		const publicId = this.pickString(candidate.publicId ?? candidate.userPublicId ?? candidate.id);
		if (!publicId) {
			return null;
		}

		return {
			publicId,
			username: this.pickString(candidate.username ?? candidate.displayName) || "",
			avatar: this.pickString(candidate.avatar ?? candidate.avatarUrl ?? candidate.profile?.avatarUrl) || "",
		};
	}

	private normalizeAuthorLike(author: any) {
		const source = author && typeof author === "object" ? author : {};
		return {
			publicId: this.pickString(source.publicId) || "",
			username: this.pickString(source.username ?? source.displayName) || "",
			avatar: this.pickString(source.avatarUrl) || "",
		};
	}

	private pickString(value: any): string | "" {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
		return "";
	}
	toPublicUserDTO(user: IUser, _viewerUserId?: string): PublicUserDTO {
		return {
			publicId: user.publicId,
			username: user.username,
			avatar: user.avatar,
			cover: user.cover,
			bio: user.bio,
			createdAt: user.createdAt,
			postCount: this.resolvePostCount(user),
			followerCount: this.resolveFollowerCount(user),
			followingCount: this.resolveFollowingCount(user),
		};
	}

	toAuthenticatedUserDTO(user: IUser): AuthenticatedUserDTO {
		return {
			...this.toPublicUserDTO(user),
			email: user.email,
			isEmailVerified: user.isEmailVerified ?? true,
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
			isEmailVerified: user.isEmailVerified ?? true,
			isAdmin: user.isAdmin,
			isBanned: user.isBanned,
			bannedAt: user.bannedAt,
			bannedReason: user.bannedReason,
			bannedBy: user.bannedBy?.toString(),
			updatedAt: user.updatedAt,
		};
	}

	private resolvePostCount(user: IUser): number {
		if (typeof user.postCount === "number" && Number.isFinite(user.postCount)) {
			return user.postCount;
		}
		return 0;
	}

	private resolveFollowerCount(user: IUser): number {
		if (typeof user.followerCount === "number" && Number.isFinite(user.followerCount)) {
			return user.followerCount;
		}

		return 0;
	}

	private resolveFollowingCount(user: IUser): number {
		if (typeof user.followingCount === "number" && Number.isFinite(user.followingCount)) {
			return user.followingCount;
		}

		return 0;
	}

	toPublicMessageDTO(message: IMessage | IMessagePopulated, conversationPublicId: string): MessageDTO {
		const populatedMessage = message as IMessagePopulated;
		const sender = populatedMessage.sender || {};

		const readBy = Array.isArray(populatedMessage.readBy)
			? populatedMessage.readBy.map((entry) => {
					if (!entry) return "";
					if (typeof entry === "string") return entry;
					if (typeof entry === "object" && "publicId" in entry && entry.publicId) {
						return entry.publicId;
					}
					if (typeof entry === "object" && typeof entry.toString === "function") {
						return entry.toString();
					}
					return String(entry);
				})
			: [];

		const attachments: IMessageAttachment[] = Array.isArray(message.attachments) ? message.attachments : [];

		const createdAtValue = message.createdAt;
		const createdAt = createdAtValue instanceof Date ? createdAtValue : new Date(createdAtValue);

		return {
			publicId: message.publicId,
			conversationId: conversationPublicId,
			body: message.body,
			sender: {
				publicId: sender?.publicId ?? "",
				username: sender?.username ?? "",
				avatar: sender?.avatar ?? "",
			},
			attachments,
			status: message.status,
			createdAt: createdAt.toISOString(),
			readBy: readBy.filter((value: string) => Boolean(value)),
		};
	}
}

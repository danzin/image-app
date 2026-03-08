import { injectable } from "tsyringe";
import { IUser, IMessage, IMessageAttachment, MessageDTO, PostDTO, IPost, FeedPost, IMessagePopulated, ICommunity, ICommunityMember } from "@/types";

export interface PublicUserDTO {
	publicId: string;
	handle: string;
	username: string;
	avatar: string;
	cover: string;
	bio: string;
	createdAt: Date;
	postCount: number;
	followerCount: number;
	followingCount: number;
}

export interface HandleSuggestionDTO {
	publicId: string;
	handle: string;
	username: string;
	avatar: string;
}

export interface AuthenticatedUserDTO extends PublicUserDTO {
	email: string;
	isEmailVerified: boolean;
}

// sensitive account info for settings page (not exposed to other users)
export interface AccountInfoDTO {
	publicId: string;
	handle: string;
	username: string;
	email: string;
	isEmailVerified: boolean;
	createdAt: Date;
	registrationIp?: string;
}

export interface AdminUserDTO extends AuthenticatedUserDTO {
	isAdmin: boolean;
	isBanned: boolean;
	bannedAt?: Date;
	bannedReason?: string;
	bannedBy?: string;
	updatedAt: Date;
	registrationIp?: string;
	lastActive?: Date;
	lastIp?: string;
}

export interface CommunityDTO {
	publicId: string;
	name: string;
	slug: string;
	description: string;
	avatar?: string;
	coverPhoto?: string;
	stats: {
		memberCount: number;
		postCount: number;
	};
	createdAt: Date;
	updatedAt: Date;
	isMember?: boolean;
	isCreator?: boolean;
	isAdmin?: boolean;
}

export interface CommunityMemberDTO {
	userId: {
		publicId: string;
		handle: string;
		username: string;
		avatar?: string;
	};
	role: "admin" | "moderator" | "member";
	joinedAt: Date;
}

type RawPostInput = Record<string, unknown>;

@injectable()
export class DTOService {
	/**
	 * Converts a raw post document to PostDTO
	 * Handles both Mongo documents and aggregation results
	 */
	toPostDTO(post: IPost | FeedPost | RawPostInput): PostDTO {
		const p = post as RawPostInput;
		const tags = Array.isArray(p.tags)
			? p.tags.map((tag: unknown) => {
					if (typeof tag === "string") return tag;
					if (tag && typeof tag === "object" && "tag" in tag) return (tag as { tag: unknown }).tag as string;
					return "";
				})
			: [];

		const imageData = p.image && typeof p.image === "object" ? (p.image as { url?: string; publicId?: string }) : null;
		const url = imageData?.url || undefined;
		const imagePublicId = imageData?.publicId || undefined;

		// Create nested image object if image exists
		const image = imageData && url && imagePublicId ? { url, publicId: imagePublicId } : null;
		const likeCount = Array.isArray(p.likes)
			? (p.likes as unknown[]).length
			: typeof p.likes === "number"
				? p.likes
				: typeof p.likesCount === "number"
					? p.likesCount
					: 0;

		const userSnapshot = this.resolvePostUserSnapshot(p);

		const repostOf = this.buildRepostOf(p.repostOf as RawPostInput | undefined);

		return {
			publicId: p.publicId as string,
			body: p.body as string,
			slug: p.slug as string,
			type: (p.type as "original" | "repost") ?? "original",
			repostCount: (p.repostCount as number) ?? 0,
			repostOf: repostOf,
			// Nested format
			image,
			// Legacy flat format for backward compatibility
			url,
			imagePublicId,
			tags: tags.filter(Boolean),
			likes: likeCount,
			commentsCount: (p.commentsCount as number) ?? 0,
			viewsCount: (p.viewsCount as number) ?? 0,
			createdAt: p.createdAt as Date,
			isLikedByViewer: p.isLikedByViewer as boolean | undefined,
			isFavoritedByViewer: p.isFavoritedByViewer as boolean | undefined,
			isRepostedByViewer: p.isRepostedByViewer as boolean | undefined,
			user: {
				publicId: userSnapshot.publicId,
				handle: userSnapshot.handle,
				username: userSnapshot.username,
				avatar: userSnapshot.avatar,
			},
			community: this.buildCommunity((p.community ?? p.communityId) as RawPostInput | undefined),
		};
	}

	private buildCommunity(source: RawPostInput | undefined | null) {
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

	private buildRepostOf(source: RawPostInput | undefined) {
		if (!source) return undefined;
		const imageData = source.image && typeof source.image === "object" ? (source.image as { url?: string; publicId?: string }) : null;
		const image = imageData?.url && imageData?.publicId ? { url: imageData.url, publicId: imageData.publicId } : null;
		const userSnapshot = this.resolvePostUserSnapshot(source);

		// calculate likes count from the source
		const likesCount = Array.isArray(source.likes)
			? source.likes.length
			: typeof source.likes === "number"
				? source.likes
				: typeof source.likesCount === "number"
					? source.likesCount
					: 0;

		return {
			publicId: source.publicId as string,
			user: {
				publicId: userSnapshot.publicId,
				handle: userSnapshot.handle,
				username: userSnapshot.username,
				avatar: userSnapshot.avatar,
			},
			body: source.body as string,
			slug: source.slug as string,
			image,
			likes: likesCount,
			repostCount: (source.repostCount as number) ?? 0,
			commentsCount: (source.commentsCount as number) ?? 0,
		};
	}

	private resolvePostUserSnapshot(post: RawPostInput) {
		const normalizedUser = this.normalizeUserLike(post?.user);
		if (normalizedUser) {
			return normalizedUser;
		}

		return this.normalizeAuthorLike(post?.author);
	}

	private normalizeUserLike(candidate: unknown) {
		if (!candidate || typeof candidate !== "object") {
			return null;
		}
		const c = candidate as Record<string, unknown>;

		const publicId = this.pickString(c.publicId ?? c.userPublicId ?? c.id);
		if (!publicId) {
			return null;
		}

		return {
			publicId,
			handle: this.pickString(c.handle) || "",
			username: this.pickString(c.username ?? c.displayName) || "",
			avatar: this.pickString(c.avatar ?? c.avatarUrl ?? (c.profile as Record<string, unknown>)?.avatarUrl) || "",
		};
	}

	private normalizeAuthorLike(author: unknown) {
		const source = author && typeof author === "object" ? (author as Record<string, unknown>) : ({} as Record<string, unknown>);
		return {
			publicId: this.pickString(source.publicId) || "",
			handle: this.pickString(source.handle) || "",
			username: this.pickString(source.username ?? source.displayName) || "",
			avatar: this.pickString(source.avatarUrl) || "",
		};
	}

	private pickString(value: unknown): string | "" {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
		return "";
	}

	toCommunityDTO(
		community: ICommunity,
		options?: {
			memberCount?: number;
			isMember?: boolean;
			isCreator?: boolean;
			isAdmin?: boolean;
		},
	): CommunityDTO {
		const source = community?.toObject ? community.toObject() : community;
		const avatar = this.pickString(source?.avatar);
		const coverPhoto = this.pickString(source?.coverPhoto);
		const stats = source?.stats ?? {};

		return {
			publicId: this.pickString(source?.publicId),
			name: this.pickString(source?.name),
			slug: this.pickString(source?.slug),
			description: this.pickString(source?.description),
			avatar: avatar || undefined,
			coverPhoto: coverPhoto || undefined,
			stats: {
				memberCount: options?.memberCount ?? stats.memberCount ?? 0,
				postCount: stats.postCount ?? 0,
			},
			createdAt: source.createdAt,
			updatedAt: source.updatedAt,
			isMember: options?.isMember,
			isCreator: options?.isCreator,
			isAdmin: options?.isAdmin,
		};
	}

	toCommunityMemberDTO(member: ICommunityMember): CommunityMemberDTO {
		const userCandidate = (member as { userId?: unknown })?.userId;
		const userSnapshot = this.normalizeUserLike(userCandidate) ?? {
			publicId: "",
			handle: "",
			username: "",
			avatar: "",
		};

		return {
			userId: {
				publicId: userSnapshot.publicId,
				handle: userSnapshot.handle,
				username: userSnapshot.username,
				avatar: userSnapshot.avatar || undefined,
			},
			role: member.role,
			joinedAt: member.joinedAt,
		};
	}
	toPublicUserDTO(user: IUser, _viewerUserId?: string): PublicUserDTO {
		return {
			publicId: user.publicId,
			handle: user.handle,
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

	toHandleSuggestionDTO(user: IUser): HandleSuggestionDTO {
		const source = user?.toObject ? user.toObject() : user;
		return {
			publicId: this.pickString(source?.publicId),
			handle: this.pickString(source?.handle),
			username: this.pickString(source?.username),
			avatar: this.pickString(source?.avatar),
		};
	}

	toAuthenticatedUserDTO(user: IUser): AuthenticatedUserDTO {
		return {
			...this.toPublicUserDTO(user),
			email: user.email,
			isEmailVerified: user.isEmailVerified ?? false,
		};
	}

	toAccountInfoDTO(user: IUser): AccountInfoDTO {
		return {
			publicId: user.publicId,
			handle: user.handle,
			username: user.username,
			email: user.email,
			isEmailVerified: user.isEmailVerified ?? false,
			createdAt: user.createdAt,
			registrationIp: user.registrationIp,
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
			isEmailVerified: user.isEmailVerified ?? false,
			isAdmin: user.isAdmin,
			isBanned: user.isBanned,
			bannedAt: user.bannedAt,
			bannedReason: user.bannedReason,
			bannedBy: user.bannedBy?.toString(),
			updatedAt: user.updatedAt,
			registrationIp: user.registrationIp,
			lastActive: user.lastActive,
			lastIp: user.lastIp,
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
				handle: sender?.handle ?? "",
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

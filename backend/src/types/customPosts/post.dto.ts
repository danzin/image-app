import { PaginationResult } from "../customCore/pagination.types";
import { PublicUserDTO } from "../customUsers/dto.types";

export interface PostDTO {
	publicId: string;
	body?: string; // text content of the post
	slug?: string;
	type?: "original" | "repost";
	repostCount?: number;
	repostOf?: {
		publicId: string;
		user: {
			publicId: string;
			handle: string;
			username: string;
			avatar: string;
		};
		body?: string;
		slug?: string;
		image?: {
			url: string;
			publicId: string;
		} | null;
		likes?: number;
		repostCount?: number;
		commentsCount?: number;
	};

	// Image data - nested format
	image?: {
		url: string;
		publicId: string;
	} | null;

	// Legacy: Flattened image data for backward compatibility
	url?: string;
	imagePublicId?: string;

	tags: string[];
	likes: number;
	commentsCount: number;
	viewsCount: number;
	createdAt: Date;

	user: {
		publicId: string;
		handle: string;
		username: string;
		avatar: string;
	};

	// Community info for community posts
	community?: {
		publicId: string;
		name: string;
		slug: string;
		avatar?: string;
	} | null;

	isLikedByViewer?: boolean;
	isFavoritedByViewer?: boolean;
	isRepostedByViewer?: boolean;
	canDelete?: boolean;
	authorCommunityRole?: "admin" | "moderator" | "member";
}

export interface UserPostsResult extends PaginationResult<PostDTO> {
	profile: PublicUserDTO;
}

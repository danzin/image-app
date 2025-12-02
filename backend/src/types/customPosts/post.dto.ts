import { PaginationResult } from "../customCore/pagination.types";
import { PublicUserDTO } from "../customUsers/dto.types";

export interface PostDTO {
	publicId: string;
	body?: string; // text content of the post
	slug?: string;

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
		username: string;
		avatar: string;
	};

	isLikedByViewer?: boolean;
	isFavoritedByViewer?: boolean;
}

export interface UserPostsResult extends PaginationResult<PostDTO> {
	profile: PublicUserDTO;
}

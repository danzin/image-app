export interface PostDTO {
	publicId: string;
	body?: string; // text
	slug?: string;

	// Image data - nested format (preferred)
	image?: {
		url: string;
		publicId: string;
	} | null;

	// Legacy: Flattened image data for backward compatibility
	url?: string;
	imagePublicId?: string;

	tags: string[]; // Resolved to tag names (not ObjectIds)
	likes: number; // Match frontend expectation
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

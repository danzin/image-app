export interface PostDTO {
	publicId: string;
	body?: string; // text
	slug?: string;

	// Flattened image data for easier frontend consumption
	url?: string; // Populated from image.url if image exists
	imagePublicId?: string; // Populated from image.publicId

	tags: string[]; // Resolved to tag names (not ObjectIds)
	likes: number; // Match frontend expectation
	commentsCount: number;
	createdAt: Date;

	user: {
		publicId: string;
		username: string;
		avatar: string;
	};

	// Optional: helps frontend determine rendering
	postType?: "text" | "image" | "mixed";

	isLikedByViewer?: boolean;
	isFavoritedByViewer?: boolean;
}

export interface FeedPost {
	publicId: string;
	body: string;
	slug: string;
	createdAt: Date;
	likes: number;
	commentsCount: number;
	viewsCount: number;
	userPublicId: string;
	tags: { tag: string; publicId?: string }[];
	user: {
		publicId: string;
		username: string;
		avatar: string;
	};
	image?: {
		publicId: string;
		url: string;
		slug: string;
	};
	rankScore?: number;
	trendScore?: number;
}

export interface PaginatedFeedResult {
	data: FeedPost[];
	page: number;
	limit: number;
	total: number;
	totalPages?: number;
}

export type CoreFeed = {
	total: number;
	page: number;
	limit: number;
	data: Array<{ publicId?: string; userPublicId: string; likes?: number; commentsCount?: number; viewsCount?: number }>;
};

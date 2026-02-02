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
		handle: string;
		username: string;
		avatar: string;
	};
	image?: {
		publicId: string;
		url: string;
		slug: string;
	};
	community?: {
		publicId: string;
		name: string;
		slug: string;
		avatar?: string;
	} | null;
	rankScore?: number;
	trendScore?: number;
	isPersonalized?: boolean;
}

export interface PaginatedFeedResult {
	data: FeedPost[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PostMeta {
	likes?: number;
	commentsCount?: number;
	viewsCount?: number;
}

export type CoreFeed = PaginatedFeedResult;

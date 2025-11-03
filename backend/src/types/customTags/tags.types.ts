export interface TrendingTag {
	tag: string;
	count: number;
	recentPostCount: number;
}

export interface GetTrendingTagsResult {
	tags: TrendingTag[];
}

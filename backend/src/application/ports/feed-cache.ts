export interface FeedPostMetadata {
  likes?: number;
  commentsCount?: number;
  viewsCount?: number;
}

export interface FeedCache {
  getPostMetadata(
    postPublicIds: readonly string[],
  ): Promise<(FeedPostMetadata | null)[]>;
}

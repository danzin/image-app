import type { FeedPost, IPost, PaginationOptions, PaginationResult } from "@/types";

/**
 * Post search reads used by text, tag, and unfiltered search endpoints.
 */
export interface PostSearchLookup {
  searchByText(terms: string[], limit?: number): Promise<FeedPost[]>;
  findByTags(
    tagIds: string[],
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    },
  ): Promise<PaginationResult<IPost>>;
  findWithPagination(
    options: PaginationOptions,
  ): Promise<PaginationResult<FeedPost>>;
}

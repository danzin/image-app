export interface PaginationResult<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface PaginationOptions {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

/**
 * Cursor-based pagination options
 * @description more efficient for large datasets and deep pagination
 * avoids skip() overhead by using cursor (last seen document) as anchor
 */
export interface CursorPaginationOptions {
	limit?: number;
	cursor?: string; // encoded cursor (e.g., base64 of { createdAt, _id })
	direction?: "forward" | "backward";
}

/**
 * Cursor-based pagination result
 * @description includes cursor tokens for navigating to next/previous pages
 */
export interface CursorPaginationResult<T> {
	data: T[];
	hasMore: boolean;
	nextCursor?: string; // cursor for next page
	prevCursor?: string; // cursor for previous page (optional)
}

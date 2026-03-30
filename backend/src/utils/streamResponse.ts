import { Response } from "express";
import { Transform, TransformCallback } from "stream";

/**
 * Options for streaming JSON responses
 */
export interface StreamResponseOptions {
	/** Initial data to send before streaming begins (e.g., metadata) */
	prelude?: Record<string, unknown>;
	/** Key name for the array being streamed (default: "data") */
	arrayKey?: string;
	/** Whether to include a total count after streaming (default: false) */
	includeTotal?: boolean;
}

/**
 * Transform stream that converts objects to JSON array elements.
 * Handles proper JSON formatting with commas between elements.
 */
export class JsonArrayTransform extends Transform {
	private isFirst = true;

	constructor() {
		super({ objectMode: true });
	}

	_transform(chunk: unknown, _encoding: BufferEncoding, callback: TransformCallback): void {
		try {
			const json = JSON.stringify(chunk);
			if (this.isFirst) {
				this.push(json);
				this.isFirst = false;
			} else {
				this.push("," + json);
			}
			callback();
		} catch (error) {
			callback(error as Error);
		}
	}
}

/**
 * Stream a paginated response with cursor-based pagination.
 * Efficiently streams large arrays without buffering entire response in memory.
 * 
 * @example
 * ```typescript
 * // In controller:
 * const result = await repository.findWithCursor(limit, cursor);
 * streamCursorResponse(res, result.data, {
 *   hasMore: result.hasMore,
 *   nextCursor: result.nextCursor,
 * });
 * ```
 */
export function streamCursorResponse<T>(
	res: Response,
	data: T[],
	pagination: { hasMore: boolean; nextCursor?: string },
	options: StreamResponseOptions = {},
): void {
	const { arrayKey = "data" } = options;

	res.setHeader("Content-Type", "application/json");
	res.setHeader("Transfer-Encoding", "chunked");

	// Build response structure
	const response: Record<string, unknown> = {
		hasMore: pagination.hasMore,
	};
	
	if (pagination.nextCursor) {
		response.nextCursor = pagination.nextCursor;
	}

	// For small responses, just send directly (streaming overhead not worth it)
	if (data.length < 100) {
		response[arrayKey] = data;
		res.json(response);
		return;
	}

	// For larger responses, stream the array
	// Start JSON object
	res.write("{");
	
	// Write pagination metadata first
	res.write(`"hasMore":${pagination.hasMore}`);
	if (pagination.nextCursor) {
		res.write(`,"nextCursor":"${pagination.nextCursor}"`);
	}
	
	// Start the data array
	res.write(`,"${arrayKey}":[`);

	// Stream each item
	for (let i = 0; i < data.length; i++) {
		const json = JSON.stringify(data[i]);
		if (i > 0) {
			res.write(",");
		}
		res.write(json);
	}

	// Close array and object
	res.write("]}");
	res.end();
}

/**
 * Stream a paginated response with traditional pagination.
 * Efficiently streams large arrays without buffering entire response in memory.
 * 
 * @example
 * ```typescript
 * // In controller:
 * const result = await repository.findWithPagination(options);
 * streamPaginatedResponse(res, result.data, {
 *   total: result.total,
 *   page: result.page,
 *   limit: result.limit,
 *   totalPages: result.totalPages,
 * });
 * ```
 */
export function streamPaginatedResponse<T>(
	res: Response,
	data: T[],
	pagination: { total: number; page: number; limit: number; totalPages: number },
	options: StreamResponseOptions = {},
): void {
	const { arrayKey = "data" } = options;

	res.setHeader("Content-Type", "application/json");
	res.setHeader("Transfer-Encoding", "chunked");

	// For small responses, just send directly
	if (data.length < 100) {
		const response: Record<string, unknown> = {
			...pagination,
			[arrayKey]: data,
		};
		res.json(response);
		return;
	}

	// For larger responses, stream the array
	res.write("{");
	
	// Write pagination metadata first
	res.write(`"total":${pagination.total}`);
	res.write(`,"page":${pagination.page}`);
	res.write(`,"limit":${pagination.limit}`);
	res.write(`,"totalPages":${pagination.totalPages}`);
	
	// Start the data array
	res.write(`,"${arrayKey}":[`);

	// Stream each item
	for (let i = 0; i < data.length; i++) {
		const json = JSON.stringify(data[i]);
		if (i > 0) {
			res.write(",");
		}
		res.write(json);
	}

	// Close array and object
	res.write("]}");
	res.end();
}

/**
 * Stream data from an async generator to the response.
 * Useful for streaming database cursors or other async data sources.
 * 
 * @example
 * ```typescript
 * // Stream logs from database cursor
 * const generator = repository.streamLogsByDateRange(startDate, endDate);
 * await streamFromGenerator(res, generator);
 * ```
 */
export async function streamFromGenerator<T>(
	res: Response,
	generator: AsyncGenerator<T[], void, unknown>,
	options: StreamResponseOptions = {},
): Promise<void> {
	const { arrayKey = "data" } = options;

	res.setHeader("Content-Type", "application/json");
	res.setHeader("Transfer-Encoding", "chunked");

	// Start JSON object and array
	res.write(`{"${arrayKey}":[`);

	let isFirst = true;
	let totalCount = 0;

	for await (const batch of generator) {
		for (const item of batch) {
			const json = JSON.stringify(item);
			if (isFirst) {
				res.write(json);
				isFirst = false;
			} else {
				res.write("," + json);
			}
			totalCount++;
		}
	}

	// Close array
	res.write("]");
	
	// Add total if requested
	if (options.includeTotal) {
		res.write(`,"total":${totalCount}`);
	}

	// Close object
	res.write("}");
	res.end();
}

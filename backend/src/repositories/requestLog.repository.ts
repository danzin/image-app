import { injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IRequestLog, PaginationOptions, PaginationResult, CursorPaginationResult } from "@/types";
import { RequestLogModel } from "@/models/requestLog.model";
import { createError } from "@/utils/errors";
import { encodeCursor, decodeCursor } from "@/utils/cursorCodec";
import mongoose from "mongoose";

interface RequestLogCursor {
	timestamp: string;
	_id: string;
	[key: string]: unknown;
}

@injectable()
export class RequestLogRepository extends BaseRepository<IRequestLog> {
	constructor() {
		super(RequestLogModel);
	}

	/**
	 * Cursor-based pagination for request logs - efficient for large datasets.
	 */
	async findWithCursor(
		limit: number = 100,
		cursor?: string,
		filter: Record<string, unknown> = {},
	): Promise<CursorPaginationResult<IRequestLog>> {
		try {
			const decodedCursor = decodeCursor<RequestLogCursor>(cursor);
			const queryFilter = { ...filter };

			if (decodedCursor) {
				queryFilter.$or = [
					{ timestamp: { $lt: new Date(decodedCursor.timestamp) } },
					{
						timestamp: new Date(decodedCursor.timestamp),
						_id: { $lt: new mongoose.Types.ObjectId(decodedCursor._id) },
					},
				];
			}

			const logs = await this.model
				.find(queryFilter)
				.sort({ timestamp: -1, _id: -1 })
				.limit(limit + 1)
				.lean()
				.exec();

			const hasMore = logs.length > limit;
			const data = hasMore ? logs.slice(0, limit) : logs;

			let nextCursor: string | undefined;
			if (hasMore && data.length > 0) {
				const lastItem = data[data.length - 1];
				nextCursor = encodeCursor({
					timestamp: (lastItem.timestamp as Date).toISOString(),
					_id: (lastItem._id as mongoose.Types.ObjectId).toString(),
				});
			}

			return {
				data: data as unknown as IRequestLog[],
				hasMore,
				nextCursor,
			};
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Stream logs for a date range using MongoDB cursor.
	 * Yields batches of logs for memory-efficient processing of large datasets.
	 */
	async *streamLogsByDateRange(
		startDate: Date,
		endDate: Date,
		batchSize: number = 100,
	): AsyncGenerator<IRequestLog[], void, unknown> {
		const cursor = this.model
			.find({ timestamp: { $gte: startDate, $lte: endDate } })
			.sort({ timestamp: -1 })
			.lean()
			.cursor({ batchSize });

		let batch: IRequestLog[] = [];
		
		for await (const doc of cursor) {
			batch.push(doc as unknown as IRequestLog);
			if (batch.length >= batchSize) {
				yield batch;
				batch = [];
			}
		}
		
		// Yield any remaining documents
		if (batch.length > 0) {
			yield batch;
		}
	}

	async findWithPagination(options: PaginationOptions): Promise<PaginationResult<IRequestLog>> {
		try {
			const { page = 1, limit = 50, sortBy = "timestamp", sortOrder = "desc", filter = {} } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder };

			const [data, total] = await Promise.all([
				this.model.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
				this.model.countDocuments(filter),
			]);

			return {
				data: data as unknown as IRequestLog[],
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			};
		} catch (error) {
			if (error instanceof Error) {
				throw createError("DatabaseError", error.message);
			}
			throw createError("DatabaseError", String(error));
		}
	}

	async findRecentLogs(limit = 100): Promise<IRequestLog[]> {
		return (await this.model.find().sort({ timestamp: -1 }).limit(limit).lean().exec()) as unknown as IRequestLog[];
	}

	async findLogsByDateRange(startDate: Date, endDate: Date): Promise<IRequestLog[]> {
		return (await this.model
			.find({ timestamp: { $gte: startDate, $lte: endDate } })
			.sort({ timestamp: -1 })
			.lean()
			.exec()) as unknown as IRequestLog[];
	}

	async findLogsByUserId(userId: string, limit = 50): Promise<IRequestLog[]> {
		return (await this.model
			.find({ "metadata.userId": userId })
			.sort({ timestamp: -1 })
			.limit(limit)
			.lean()
			.exec()) as unknown as IRequestLog[];
	}

	async findLogsByStatusCode(statusCode: number, limit = 100): Promise<IRequestLog[]> {
		return (await this.model
			.find({ "metadata.statusCode": statusCode })
			.sort({ timestamp: -1 })
			.limit(limit)
			.lean()
			.exec()) as unknown as IRequestLog[];
	}

	async getAverageResponseTime(startDate?: Date, endDate?: Date): Promise<number> {
		const match = startDate && endDate ? { timestamp: { $gte: startDate, $lte: endDate } } : {};

		const result = await this.model.aggregate([
			{ $match: match },
			{ $group: { _id: null, avg: { $avg: "$metadata.responseTimeMs" } } },
		]);

		return result.length > 0 ? result[0].avg : 0;
	}
}

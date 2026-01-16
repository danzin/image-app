import { injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IRequestLog, PaginationOptions, PaginationResult } from "../types";
import { RequestLogModel } from "../models/requestLog.model";
import { createError } from "../utils/errors";

@injectable()
export class RequestLogRepository extends BaseRepository<IRequestLog> {
	constructor() {
		super(RequestLogModel);
	}

	async findWithPagination(options: PaginationOptions): Promise<PaginationResult<IRequestLog>> {
		try {
			const { page = 1, limit = 50, sortBy = "timestamp", sortOrder = "desc", filter = {} } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

			const [data, total] = await Promise.all([
				this.model.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
				this.model.countDocuments(filter),
			]);

			return {
				data: data as IRequestLog[],
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
		return this.model.find().sort({ timestamp: -1 }).limit(limit).lean().exec();
	}

	async findLogsByDateRange(startDate: Date, endDate: Date): Promise<IRequestLog[]> {
		return this.model.find({ timestamp: { $gte: startDate, $lte: endDate } }).sort({ timestamp: -1 }).lean().exec();
	}

	async findLogsByUserId(userId: string, limit = 50): Promise<IRequestLog[]> {
		return this.model.find({ "metadata.userId": userId }).sort({ timestamp: -1 }).limit(limit).lean().exec();
	}

	async findLogsByStatusCode(statusCode: number, limit = 100): Promise<IRequestLog[]> {
		return this.model.find({ "metadata.statusCode": statusCode }).sort({ timestamp: -1 }).limit(limit).lean().exec();
	}

	async getAverageResponseTime(startDate?: Date, endDate?: Date): Promise<number> {
		const match = startDate && endDate ? { timestamp: { $gte: startDate, $lte: endDate } } : {};

		const result = await this.model.aggregate([{ $match: match }, { $group: { _id: null, avg: { $avg: "$metadata.responseTimeMs" } } }]);

		return result.length > 0 ? result[0].avg : 0;
	}
}

import { ClientSession, Model } from "mongoose";
import { IUserAction, PaginationOptions, PaginationResult } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { createError } from "../utils/errors";

@injectable()
export class UserActionRepository extends BaseRepository<IUserAction> {
	constructor(@inject("UserActionModel") model: Model<IUserAction>) {
		super(model);
	}

	async logAction(
		userId: string,
		actionType: string,
		targetId: string,
		session?: ClientSession,
		_admin?: boolean
	): Promise<IUserAction> {
		try {
			const doc = new this.model({ userId, actionType, targetId });
			// if(session) doc.$session(session);
			return await doc.save({ session });
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			}
			throw createError("UnknownError", String(error));
		}
	}

	async getActionsByUser(userId: string): Promise<IUserAction[]> {
		return this.model.find({ userId }).exec();
	}

	/**
	 * Retrieves paginated user actions from the database.
	 * @param options - Pagination options (page, limit, sorting).
	 * @returns A paginated result containing user actions.
	 */
	async findWithPagination(options: PaginationOptions): Promise<PaginationResult<IUserAction>> {
		try {
			const { page = 1, limit = 20, sortBy = "timestamp", sortOrder = "desc" } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder };

			const [data, total] = await Promise.all([
				this.model.find().sort(sort).skip(skip).limit(limit).populate("userId", "username").exec(),
				this.model.countDocuments(),
			]);

			return {
				data,
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

	async deleteManyByUserId(userId: string, session?: ClientSession): Promise<number> {
		try {
			const result = await this.model
				.deleteMany({ userId })
				.session(session || null)
				.exec();
			return result.deletedCount || 0;
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			}
			throw createError("UnknownError", String(error));
		}
	}
}

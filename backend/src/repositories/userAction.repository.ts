import mongoose, { ClientSession, Model } from "mongoose";
import UserAction from "../models/userAction.model";
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
		admin?: boolean
	): Promise<IUserAction> {
		try {
			const doc = new this.model({ userId, actionType, targetId });
			// if(session) doc.$session(session);
			return await doc.save({ session });
		} catch (error) {
			throw createError(error.name, error.message);
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
			throw createError("DatabaseError", error.message);
		}
	}
}

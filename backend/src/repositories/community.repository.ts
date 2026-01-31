import { injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { ICommunity } from "@/types";
import { Community } from "@/models/community.model";

@injectable()
export class CommunityRepository extends BaseRepository<ICommunity> {
	constructor() {
		super(Community);
	}

	async findBySlug(slug: string): Promise<ICommunity | null> {
		return this.model.findOne({ slug }).exec();
	}

	async findByIds(ids: string[]): Promise<ICommunity[]> {
		return this.model.find({ _id: { $in: ids } }).exec();
	}

	async search(terms: string[]): Promise<ICommunity[]> {
		const regexQueries = terms.map((term) => ({
			$or: [{ name: { $regex: term, $options: "i" } }, { description: { $regex: term, $options: "i" } }],
		}));

		return this.model.find({ $or: regexQueries }).limit(20).exec();
	}

	async findAll(
		page: number,
		limit: number,
		search?: string
	): Promise<{ data: ICommunity[]; total: number; page: number; limit: number; totalPages: number }> {
		const query: any = {};
		if (search) {
			query.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
		}

		const total = await this.model.countDocuments(query);
		const totalPages = Math.ceil(total / limit);
		const skip = (page - 1) * limit;

		const data = await this.model.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).exec();

		return { data, total, page, limit, totalPages };
	}

	async findByPublicId(publicId: string): Promise<ICommunity | null> {
		return this.model.findOne({ publicId }).exec();
	}
}

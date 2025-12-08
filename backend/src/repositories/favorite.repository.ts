import mongoose, { Model, ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IFavorite, IPost } from "types/index";

@injectable()
export class FavoriteRepository extends BaseRepository<IFavorite> {
	constructor(@inject("FavoriteModel") model: Model<IFavorite>) {
		super(model);
	}

	async findByUserAndPost(userId: string, postId: string, session?: ClientSession): Promise<IFavorite | null> {
		return this.model
			.findOne({ userId, postId })
			.session(session || null)
			.exec();
	}

	async remove(userId: string, postId: string, session?: ClientSession): Promise<boolean> {
		const result = await this.model
			.deleteOne({ userId, postId })
			.session(session || null)
			.exec();
		return result.deletedCount > 0;
	}

	async findFavoritesByUserId(
		userId: string,
		page: number = 1,
		limit: number = 20
	): Promise<{ data: IPost[]; total: number }> {
		const skip = (page - 1) * limit;

		// Use an aggregation pipeline to join Favorite documents with the Post documents
		const aggregation = this.model.aggregate([
			{ $match: { userId: new mongoose.Types.ObjectId(userId) } },
			{ $sort: { createdAt: -1 } },
			{ $skip: skip },
			{ $limit: limit },
			{
				$lookup: {
					from: "posts",
					localField: "postId",
					foreignField: "_id",
					as: "postDetails",
				},
			},
			{ $unwind: "$postDetails" },
			{ $replaceRoot: { newRoot: "$postDetails" } },
			{
				$lookup: {
					from: "images",
					localField: "image",
					foreignField: "_id",
					as: "imageDetails",
				},
			},
			{
				$addFields: {
					image: {
						$cond: {
							if: { $gt: [{ $size: "$imageDetails" }, 0] },
							then: { $arrayElemAt: ["$imageDetails", 0] },
							else: null,
						},
					},
				},
			},
			{
				$lookup: {
					from: "users",
					localField: "user",
					foreignField: "_id",
					as: "userDetails",
				},
			},
			{ $unwind: "$userDetails" },
			{ $addFields: { user: "$userDetails" } },
			{ $project: { userDetails: 0, imageDetails: 0 } },
		]);

		const totalFavorites = await this.model.countDocuments({ userId });
		const favoritedPosts = await aggregation.exec();

		return { data: favoritedPosts as IPost[], total: totalFavorites };
	}

	async deleteManyByUserId(userId: string, session?: ClientSession): Promise<number> {
		const result = await this.model
			.deleteMany({ userId })
			.session(session || null)
			.exec();
		return result.deletedCount || 0;
	}
}

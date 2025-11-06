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
			// find favorites for the given user
			{ $match: { userId: new mongoose.Types.ObjectId(userId) } },
			//  sort by most recent
			{ $sort: { createdAt: -1 } },
			//  pagination
			{ $skip: skip },
			{ $limit: limit },
			// "Join" with the posts collection
			{
				$lookup: {
					from: "posts", // collection name in db
					localField: "postId",
					foreignField: "_id",
					as: "postDetails",
				},
			},
			// deconstruct the array field to get object instead of array
			{ $unwind: "$postDetails" },
			// replace root to have postDetails at the top level
			{ $replaceRoot: { newRoot: "$postDetails" } },
			// populate the image field in the post
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
			// populate the user field in the post
			{
				$lookup: {
					from: "users",
					localField: "user",
					foreignField: "_id",
					as: "userDetails",
				},
			},
			{ $unwind: "$userDetails" },
			{ $addFields: { user: "$userDetails" } }, // replace user field
			{ $project: { userDetails: 0, imageDetails: 0 } }, // clean up
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

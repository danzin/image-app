import mongoose, { Model, ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import Favorite from "src/models/favorite.model";
import { IFavorite, IImage } from "types/index";

@injectable()
export class FavoriteRepository extends BaseRepository<IFavorite> {
	constructor(@inject("FavoriteModel") model: Model<IFavorite>) {
		super(model);
	}

	async findByUserAndImage(userId: string, imageId: string, session?: ClientSession): Promise<IFavorite | null> {
		return this.model
			.findOne({ userId, imageId })
			.session(session || null)
			.exec();
	}

	async remove(userId: string, imageId: string, session?: ClientSession): Promise<boolean> {
		const result = await this.model
			.deleteOne({ userId, imageId })
			.session(session || null)
			.exec();
		return result.deletedCount > 0;
	}

	async findFavoritesByUserId(
		userId: string,
		page: number = 1,
		limit: number = 20
	): Promise<{ data: IImage[]; total: number }> {
		const skip = (page - 1) * limit;

		// Use an aggregation pipeline to join Favorite documents with the Image documents
		const aggregation = this.model.aggregate([
			// Stage 1: find favorites for the given user
			{ $match: { userId: new mongoose.Types.ObjectId(userId) } },
			// Stage 2: sort by most recent
			{ $sort: { createdAt: -1 } },
			// Stage 3: pagination
			{ $skip: skip },
			{ $limit: limit },
			// Stage 4: "Join" with the images collection
			{
				$lookup: {
					from: "images", // collection name in MongoDB
					localField: "imageId",
					foreignField: "_id",
					as: "imageDetails",
				},
			},
			// Stage 5: deconstruct the array field to get object instead of array
			{ $unwind: "$imageDetails" },
			// Stage 6: replace root to have imageDetails at the top level
			{ $replaceRoot: { newRoot: "$imageDetails" } },
			// Stage 7: populate the user field in the image
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
			{ $project: { userDetails: 0 } }, // clean up
		]);

		const totalFavorites = await this.model.countDocuments({ userId });
		const favoritedImages = await aggregation.exec();

		return { data: favoritedImages as IImage[], total: totalFavorites };
	}
}

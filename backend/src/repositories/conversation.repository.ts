import mongoose, { ClientSession, Model } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IConversation } from "../types";
import { createError } from "../utils/errors";

/*
Notes on messaging system:

	Storing each message as its own MongoDB document is okay at moderate scale,
	but if volume grows significantly, certain guardrails must be put into place.
	
	- Shard or partition by conversationId so Mongo splits write load and keeps indexes bounded; 
			enable hashed sharding on conversationId + createdAt.
	- Bound indexes (compound { conversationId: 1, createdAt: -1 }) and avoid multi-field text indexes on the hot collection.
	- Cold-storage tiers: keep only the latest N (e.g., 5–20 k) messages per conversation in the primary messages collection,
			then roll off older ones to an archive collection or object storage via scheduled jobs.
	- Paginated reads using time or snowflake IDs rather than skip/limit to keep queries O(1).
	- Soft deletes/retention policies (per workspace, per conversation) stop infinite growth.
	- Attachment offloading: store blob metadata only; push files to S3/Cloudinary/other storage. 
			Just not in the message document itself.
	- Compression: enable MognoDB's WiredTiger block compression and keep payloads trimmed to reduce storage footprint.

	With sharding plus archival and retention policies, single-document messages remain manageable even at scale.
	For the current needs of the app, i'm keeping this approach. It's simple and fexible and I don't plan on
	having thousands of active users with millions of messages each. 
	This whole project is proof of concept.
*/
@injectable()
export class ConversationRepository extends BaseRepository<IConversation> {
	constructor(@inject("ConversationModel") model: Model<IConversation>) {
		super(model);
	}

	async findByPublicId(
		publicId: string,
		session?: ClientSession,
		options?: { populateParticipants?: boolean; includeLastMessage?: boolean }
	): Promise<IConversation | null> {
		const query = this.model.findOne({ publicId });
		if (options?.populateParticipants) {
			query.populate("participants", "publicId username avatar");
		}
		if (options?.includeLastMessage) {
			query.populate({
				path: "lastMessage",
				populate: { path: "sender", select: "publicId username avatar" },
			});
		}
		if (session) query.session(session);
		return query.exec();
	}

	async findByParticipantHash(participantHash: string, session?: ClientSession): Promise<IConversation | null> {
		const query = this.model.findOne({ participantHash });
		if (session) query.session(session);
		return query.exec();
	}

	async findUserConversations(
		userId: string,
		page: number,
		limit: number
	): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
		try {
			const objectId = new mongoose.Types.ObjectId(userId);
			const skip = (page - 1) * limit;

			const pipeline: mongoose.PipelineStage[] = [
				{ $match: { participants: objectId } },
				{ $sort: { lastMessageAt: -1, updatedAt: -1 } },
				{
					$lookup: {
						from: "messages",
						localField: "lastMessage",
						foreignField: "_id",
						as: "lastMessage",
					},
				},
				{ $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
				{
					$lookup: {
						from: "users",
						let: { senderId: "$lastMessage.sender" },
						pipeline: [
							{ $match: { $expr: { $eq: ["$_id", "$$senderId"] } } },
							{ $project: { publicId: 1, username: 1, avatar: 1 } },
						],
						as: "lastMessageSender",
					},
				},
				{
					$addFields: {
						lastMessage: {
							$cond: {
								if: { $gt: [{ $size: "$lastMessageSender" }, 0] },
								then: {
									$mergeObjects: ["$lastMessage", { sender: { $arrayElemAt: ["$lastMessageSender", 0] } }],
								},
								else: "$lastMessage",
							},
						},
					},
				},
				{
					$lookup: {
						from: "users",
						localField: "participants",
						foreignField: "_id",
						as: "participants",
					},
				},
				{
					$project: {
						participantHash: 1,
						publicId: 1,
						participants: {
							$map: {
								input: "$participants",
								as: "participant",
								in: {
									_id: "$$participant._id",
									publicId: "$$participant.publicId",
									username: "$$participant.username",
									avatar: "$$participant.avatar",
								},
							},
						},
						lastMessage: 1,
						lastMessageAt: 1,
						unreadCounts: 1,
						isGroup: 1,
						title: 1,
						createdAt: 1,
						updatedAt: 1,
					},
				},
				{ $skip: skip },
				{ $limit: limit },
			];

			const [data, total] = await Promise.all([
				this.model.aggregate(pipeline).exec(),
				this.model.countDocuments({ participants: objectId }),
			]);

			return {
				data,
				total,
				page,
				limit,
				totalPages: total > 0 ? Math.ceil(total / limit) : 0,
			};
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	async resetUnreadCount(conversationId: string, userId: string, session?: ClientSession): Promise<void> {
		const update = this.model.updateOne(
			{ _id: new mongoose.Types.ObjectId(conversationId) },
			{ $set: { [`unreadCounts.${userId}`]: 0 } }
		);
		if (session) update.session(session);
		await update.exec();
	}

	async incrementUnreadCounts(conversationId: string, recipientIds: string[], session?: ClientSession): Promise<void> {
		if (recipientIds.length === 0) return;

		const update = this.model.updateOne(
			{ _id: new mongoose.Types.ObjectId(conversationId) },
			{
				$inc: recipientIds.reduce<Record<string, number>>((acc, recipientId) => {
					acc[`unreadCounts.${recipientId}`] = 1;
					return acc;
				}, {}),
			}
		);

		if (session) update.session(session);
		await update.exec();
	}
}

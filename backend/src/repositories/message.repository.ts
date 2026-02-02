import mongoose, { ClientSession, Model } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IMessage } from "@/types";
import { createError } from "@/utils/errors";

@injectable()
export class MessageRepository extends BaseRepository<IMessage> {
	constructor(@inject("MessageModel") model: Model<IMessage>) {
		super(model);
	}

	async findByPublicId(publicId: string, session?: ClientSession): Promise<IMessage | null> {
		const query = this.model.findOne({ publicId }).populate("sender", "publicId handle username avatar");
		if (session) query.session(session);
		return query.exec();
	}

	async findMessagesByConversation(
		conversationId: string,
		page: number,
		limit: number
	): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
		try {
			const skip = (page - 1) * limit;
			const objectId = new mongoose.Types.ObjectId(conversationId);

			const [messages, total] = await Promise.all([
				this.model
					.find({ conversation: objectId })
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.populate("sender", "publicId handle username avatar")
					.lean()
					.exec(),
				this.model.countDocuments({ conversation: objectId }),
			]);

			return {
				data: messages,
				total,
				page,
				limit,
				totalPages: total > 0 ? Math.ceil(total / limit) : 0,
			};
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	// Trying different session handling here
	async markConversationMessagesAsRead(
		conversationId: string,
		readerId: string,
		session?: ClientSession
	): Promise<void> {
		const update = this.model.updateMany(
			{
				conversation: new mongoose.Types.ObjectId(conversationId),
				sender: { $ne: new mongoose.Types.ObjectId(readerId) },
				readBy: { $ne: new mongoose.Types.ObjectId(readerId) },
			},
			{
				$addToSet: { readBy: new mongoose.Types.ObjectId(readerId) },
				$set: { status: "read" },
			}
		);

		if (session) update.session(session);
		await update.exec();
	}

	async markConversationMessagesAsDelivered(
		conversationId: string,
		recipientId: string,
		session?: ClientSession,
	): Promise<boolean> {
		const update = this.model.updateMany(
			{
				conversation: new mongoose.Types.ObjectId(conversationId),
				sender: { $ne: new mongoose.Types.ObjectId(recipientId) },
				status: "sent",
			},
			{
				$set: { status: "delivered" },
			},
		);

		if (session) update.session(session);
		const result = await update.exec();
		return (result.modifiedCount ?? 0) > 0;
	}

	async findMessageById(messageId: string, session?: ClientSession): Promise<IMessage | null> {
		const query = this.model
			.findById(new mongoose.Types.ObjectId(messageId))
			.populate("sender", "publicId handle username avatar");
		if (session) query.session(session);
		return query.exec();
	}

	async deleteManyBySender(senderId: string, session?: ClientSession): Promise<number> {
		const result = await this.model
			.deleteMany({ sender: new mongoose.Types.ObjectId(senderId) })
			.session(session || null)
			.exec();
		return result.deletedCount || 0;
	}

	async removeUserFromReadBy(userId: string, session?: ClientSession): Promise<number> {
		const result = await this.model
			.updateMany(
				{ readBy: new mongoose.Types.ObjectId(userId) },
				{ $pull: { readBy: new mongoose.Types.ObjectId(userId) } }
			)
			.session(session || null)
			.exec();
		return result.modifiedCount || 0;
	}
}

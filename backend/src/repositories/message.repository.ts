import mongoose, { ClientSession, Model } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IMessage } from "../types";
import { createError } from "../utils/errors";

@injectable()
export class MessageRepository extends BaseRepository<IMessage> {
	constructor(@inject("MessageModel") model: Model<IMessage>) {
		super(model);
	}

	async findByPublicId(publicId: string, session?: ClientSession): Promise<IMessage | null> {
		const query = this.model.findOne({ publicId }).populate("sender", "publicId username avatar");
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
					.populate("sender", "publicId username avatar")
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

	async findMessageById(messageId: string, session?: ClientSession): Promise<IMessage | null> {
		const query = this.model
			.findById(new mongoose.Types.ObjectId(messageId))
			.populate("sender", "publicId username avatar");
		if (session) query.session(session);
		return query.exec();
	}
}

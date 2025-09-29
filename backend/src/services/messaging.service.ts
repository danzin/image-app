import mongoose from "mongoose";
import { inject, injectable } from "tsyringe";
import { ConversationRepository } from "../repositories/conversation.repository";
import { MessageRepository } from "../repositories/message.repository";
import { UserRepository } from "../repositories/user.repository";
import { UnitOfWork } from "../database/UnitOfWork";
import { createError } from "../utils/errors";
import { ConversationSummaryDTO, MessageDTO, SendMessagePayload } from "../types";
import { DTOService } from "./dto.service";
import { EventBus } from "../application/common/buses/event.bus";
import { MessageSentEvent } from "../application/events/message/message.event";
import { MessageSentHandler } from "../application/events/message/message-sent.handler";

@injectable()
export class MessagingService {
	constructor(
		@inject("ConversationRepository") private readonly conversationRepository: ConversationRepository,
		@inject("MessageRepository") private readonly messageRepository: MessageRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("MessageSentHandler") private readonly messageSentHandler: MessageSentHandler
	) {}

	async listConversations(
		userPublicId: string,
		page = 1,
		limit = 20
	): Promise<{
		conversations: ConversationSummaryDTO[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const userInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
		if (!userInternalId) {
			throw createError("NotFoundError", "User not found");
		}

		const result = await this.conversationRepository.findUserConversations(userInternalId, page, limit);
		const conversations = await Promise.all(
			result.data.map(async (conversation) => {
				const unreadCounts = this.extractUnreadCounts(conversation.unreadCounts);
				const lastMessage = conversation.lastMessage
					? this.dtoService.toPublicMessageDTO(conversation.lastMessage, conversation.publicId)
					: null;

				return {
					publicId: conversation.publicId,
					participants: conversation.participants.map((participant: any) => ({
						publicId: participant.publicId,
						username: participant.username,
						avatar: participant.avatar,
					})),
					lastMessage,
					lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
					unreadCount: unreadCounts[userInternalId] || 0,
					isGroup: Boolean(conversation.isGroup),
					title: conversation.title,
				} as ConversationSummaryDTO;
			})
		);

		return {
			conversations,
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
		};
	}

	async getConversationMessages(
		userPublicId: string,
		conversationPublicId: string,
		page = 1,
		limit = 30
	): Promise<{
		messages: MessageDTO[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const conversation = await this.ensureConversationAccess(userPublicId, conversationPublicId);
		const conversationId = (conversation._id as unknown as mongoose.Types.ObjectId).toString();
		const result = await this.messageRepository.findMessagesByConversation(conversationId, page, limit);
		const messages = result.data
			.slice()
			.reverse()
			.map((message) => this.dtoService.toPublicMessageDTO(message, conversation.publicId));

		return {
			messages,
			total: result.total,
			page,
			limit,
			totalPages: result.totalPages,
		};
	}

	async markConversationRead(userPublicId: string, conversationPublicId: string): Promise<void> {
		const conversation = await this.ensureConversationAccess(userPublicId, conversationPublicId);
		const userInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
		if (!userInternalId) {
			throw createError("NotFoundError", "User not found");
		}

		await this.unitOfWork.executeInTransaction(async (session) => {
			const conversationId = (conversation._id as unknown as mongoose.Types.ObjectId).toString();
			await this.messageRepository.markConversationMessagesAsRead(conversationId, userInternalId, session);
			await this.conversationRepository.resetUnreadCount(conversationId, userInternalId, session);
		});
	}

	async sendMessage(senderPublicId: string, payload: SendMessagePayload): Promise<MessageDTO> {
		if (!payload.body || payload.body.trim().length === 0) {
			throw createError("ValidationError", "Message body cannot be empty");
		}

		const senderInternalId = await this.userRepository.findInternalIdByPublicId(senderPublicId);
		if (!senderInternalId) {
			throw createError("NotFoundError", "Sender not found");
		}

		let targetConversation = payload.conversationPublicId
			? await this.conversationRepository.findByPublicId(payload.conversationPublicId, undefined, {
					populateParticipants: true,
			  })
			: null;

		if (!targetConversation && !payload.recipientPublicId) {
			throw createError("ValidationError", "Recipient is required when no conversation is provided");
		}

		const messageDoc = await this.unitOfWork.executeInTransaction(async (session) => {
			let conversationDoc = targetConversation;
			let recipientInternalIds: string[] = [];

			if (!conversationDoc) {
				const recipientInternalId = await this.userRepository.findInternalIdByPublicId(payload.recipientPublicId!);
				if (!recipientInternalId) {
					throw createError("NotFoundError", "Recipient not found");
				}

				const participantIds = [senderInternalId, recipientInternalId];
				const participantHash = this.buildParticipantHash(participantIds);

				conversationDoc = await this.conversationRepository.findByParticipantHash(participantHash, session);

				if (!conversationDoc) {
					const participantObjectIds = participantIds.map((id) => new mongoose.Types.ObjectId(id));
					const unreadSeed = participantIds.reduce<Record<string, number>>((acc, id) => {
						acc[id] = id === senderInternalId ? 0 : 1;
						return acc;
					}, {});

					conversationDoc = await this.conversationRepository.create(
						{
							participantHash,
							participants: participantObjectIds,
							lastMessageAt: new Date(),
							unreadCounts: unreadSeed as any,
						},
						session
					);
				}
				recipientInternalIds = participantIds.filter((id) => id !== senderInternalId);
			} else {
				const isParticipant = conversationDoc.participants
					.map((participant) => participant.toString())
					.includes(senderInternalId);
				if (!isParticipant) {
					throw createError("ForbiddenError", "You do not have access to this conversation");
				}
				recipientInternalIds = conversationDoc.participants
					.map((participant) => participant.toString())
					.filter((id) => id !== senderInternalId);
			}

			const conversationId = (conversationDoc!._id as unknown as mongoose.Types.ObjectId).toString();
			const message = await this.messageRepository.create(
				{
					conversation: new mongoose.Types.ObjectId(conversationId),
					sender: new mongoose.Types.ObjectId(senderInternalId),
					body: payload.body.trim(),
					readBy: [new mongoose.Types.ObjectId(senderInternalId)],
					status: "sent",
				},
				session
			);

			await this.conversationRepository.findOneAndUpdate(
				{ _id: conversationDoc!._id },
				{
					$set: {
						lastMessage: message._id,
						lastMessageAt: message.createdAt,
						[`unreadCounts.${senderInternalId}`]: 0,
					},
					$inc: recipientInternalIds.reduce<Record<string, number>>((acc, recipientId) => {
						acc[`unreadCounts.${recipientId}`] = 1;
						return acc;
					}, {}),
				},
				session
			);

			await message.populate("sender", "publicId username avatar");

			const participantDocs = await this.userRepository
				.find({ _id: { $in: conversationDoc!.participants } })
				.select("publicId")
				.session(session)
				.lean()
				.exec();

			const participantPublicIds = participantDocs.map((doc: any) => doc.publicId);

			this.eventBus.queueTransactional(
				new MessageSentEvent(
					conversationDoc!.publicId,
					senderPublicId,
					participantPublicIds.filter((id: string) => id !== senderPublicId),
					message.publicId
				),
				this.messageSentHandler
			);

			targetConversation = conversationDoc;
			return message;
		});

		if (!targetConversation) {
			throw createError("InternalError", "Conversation context missing after message creation");
		}

		return this.dtoService.toPublicMessageDTO(messageDoc, targetConversation.publicId);
	}

	private buildParticipantHash(participantIds: string[]): string {
		return participantIds
			.map((id) => id.toString())
			.sort()
			.join(":");
	}

	private extractUnreadCounts(unreadCounts: any): Record<string, number> {
		if (!unreadCounts) {
			return {};
		}

		if (unreadCounts instanceof Map) {
			return Object.fromEntries((unreadCounts as Map<string, number>).entries());
		}

		return unreadCounts as Record<string, number>;
	}

	private async ensureConversationAccess(userPublicId: string, conversationPublicId: string) {
		const conversation = await this.conversationRepository.findByPublicId(conversationPublicId, undefined, {
			populateParticipants: true,
			includeLastMessage: true,
		});

		if (!conversation) {
			throw createError("NotFoundError", "Conversation not found");
		}

		const userInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
		if (!userInternalId) {
			throw createError("NotFoundError", "User not found");
		}

		const hasAccess = conversation.participants.some((participant) => participant.toString() === userInternalId);
		if (!hasAccess) {
			throw createError("ForbiddenError", "You do not have access to this conversation");
		}

		return conversation;
	}
}

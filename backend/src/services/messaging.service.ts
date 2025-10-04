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
		const conversations = result.data.map((conversation) => this.mapConversationSummary(conversation, userInternalId));

		return {
			conversations,
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
		};
	}

	async initiateConversation(userPublicId: string, recipientPublicId: string): Promise<ConversationSummaryDTO> {
		if (userPublicId === recipientPublicId) {
			throw createError("ValidationError", "You cannot start a conversation with yourself");
		}

		const [userInternalId, recipientInternalId] = await Promise.all([
			this.userRepository.findInternalIdByPublicId(userPublicId),
			this.userRepository.findInternalIdByPublicId(recipientPublicId),
		]);

		if (!userInternalId) {
			throw createError("NotFoundError", "User not found");
		}

		if (!recipientInternalId) {
			throw createError("NotFoundError", "Recipient not found");
		}

		const participantIds = [userInternalId, recipientInternalId];
		const participantHash = this.buildParticipantHash(participantIds);

		let conversation = await this.conversationRepository.findByParticipantHash(participantHash);

		if (!conversation) {
			conversation = await this.unitOfWork.executeInTransaction(async (session) => {
				const participantObjectIds = participantIds.map((id) => new mongoose.Types.ObjectId(id));
				const unreadSeed = participantIds.reduce<Record<string, number>>((acc, id) => {
					acc[id] = 0;
					return acc;
				}, {});

				return this.conversationRepository.create(
					{
						participantHash,
						participants: participantObjectIds,
						lastMessageAt: new Date(),
						unreadCounts: unreadSeed as any,
						isGroup: false,
					},
					session
				);
			});
		}

		const hydratedConversation = await this.conversationRepository.findByPublicId(conversation.publicId, undefined, {
			populateParticipants: true,
			includeLastMessage: true,
		});

		if (!hydratedConversation) {
			throw createError("InternalError", "Conversation could not be loaded");
		}

		return this.mapConversationSummary(hydratedConversation, userInternalId);
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
			} else {
				const existingParticipantIds = this.getParticipantIds(conversationDoc.participants);
				if (!existingParticipantIds.includes(senderInternalId)) {
					throw createError("ForbiddenError", "You do not have access to this conversation");
				}
			}

			const participantIds: string[] = this.getParticipantIds(conversationDoc!.participants);
			if (!participantIds.includes(senderInternalId)) {
				throw createError("ForbiddenError", "You do not have access to this conversation");
			}

			const recipientInternalIds: string[] = participantIds.filter((id: string) => id !== senderInternalId);

			const conversationId = (conversationDoc!._id as unknown as mongoose.Types.ObjectId).toString();
			const message = await this.messageRepository.create(
				{
					conversation: new mongoose.Types.ObjectId(conversationId),
					sender: new mongoose.Types.ObjectId(senderInternalId),
					body: payload.body.trim(),
					attachments:
						Array.isArray(payload.attachments) && payload.attachments.length > 0
							? payload.attachments.map((attachment) => ({ ...attachment }))
							: undefined,
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
					$inc: recipientInternalIds.reduce<Record<string, number>>(
						(acc: Record<string, number>, recipientId: string) => {
							acc[`unreadCounts.${recipientId}`] = 1;
							return acc;
						},
						{}
					),
				},
				session
			);

			await message.populate("sender", "publicId username avatar");

			const participantObjectIds = participantIds.map(
				(participantId: string) => new mongoose.Types.ObjectId(participantId)
			);
			const participantDocs = await this.userRepository
				.find({ _id: { $in: participantObjectIds } })
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

	private mapConversationSummary(conversation: any, userInternalId: string): ConversationSummaryDTO {
		const unreadCounts = this.extractUnreadCounts(conversation.unreadCounts);
		const participants = Array.isArray(conversation.participants)
			? conversation.participants
					.map((participant: any) => ({
						publicId: participant?.publicId ?? this.extractParticipantId(participant) ?? "",
						username: participant?.username ?? "",
						avatar: participant?.avatar ?? "",
					}))
					.filter((participant: any) => Boolean(participant.publicId))
			: [];

		const hasLastMessage =
			conversation.lastMessage && (conversation.lastMessage.publicId || conversation.lastMessage._id);
		const lastMessage = hasLastMessage
			? this.dtoService.toPublicMessageDTO(conversation.lastMessage as any, conversation.publicId)
			: null;

		return {
			publicId: conversation.publicId,
			participants,
			lastMessage,
			lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
			unreadCount: unreadCounts[userInternalId] || 0,
			isGroup: Boolean(conversation.isGroup),
			title: conversation.title,
		};
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

		const hasAccess = Array.isArray(conversation.participants)
			? conversation.participants.some((participant) => this.participantMatchesUser(participant, userInternalId))
			: false;
		if (!hasAccess) {
			throw createError("ForbiddenError", "You do not have access to this conversation");
		}

		return conversation;
	}

	private participantMatchesUser(participant: any, userInternalId: string): boolean {
		if (!participant) {
			return false;
		}

		if (typeof participant === "string") {
			return participant === userInternalId;
		}

		if (participant instanceof mongoose.Types.ObjectId) {
			return participant.toString() === userInternalId;
		}

		const candidateId = this.extractParticipantId(participant);
		return candidateId ? candidateId === userInternalId : false;
	}

	private extractParticipantId(participant: any): string | null {
		if (!participant) {
			return null;
		}

		if (participant instanceof mongoose.Types.ObjectId) {
			return participant.toString();
		}

		if (typeof participant === "string") {
			return participant;
		}

		if (typeof participant._id === "string") {
			return participant._id;
		}

		if (participant._id instanceof mongoose.Types.ObjectId) {
			return participant._id.toString();
		}

		if (typeof participant.id === "string") {
			return participant.id;
		}

		if (typeof participant.toString === "function") {
			return participant.toString();
		}

		return null;
	}

	private getParticipantIds(participants: any): string[] {
		if (!Array.isArray(participants)) {
			return [];
		}

		return participants
			.map((participant: any) => this.extractParticipantId(participant))
			.filter((id: string | null): id is string => Boolean(id));
	}
}

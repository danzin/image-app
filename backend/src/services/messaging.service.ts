import mongoose from "mongoose";
import { inject, injectable } from "tsyringe";
import { ConversationRepository } from "@/repositories/conversation.repository";
import { MessageRepository } from "@/repositories/message.repository";
import { UserRepository } from "@/repositories/user.repository";
import { UnitOfWork } from "@/database/UnitOfWork";
import { createError } from "@/utils/errors";
import {
	ConversationSummaryDTO,
	HydratedConversation,
	IMessageWithPopulatedSender,
	MaybePopulatedParticipant,
	MessageDTO,
	SendMessagePayload,
	UserPublicIdLean,
} from "@/types";
import { DTOService } from "./dto.service";
import { EventBus } from "@/application/common/buses/event.bus";
import { MessageSentEvent, MessageStatusUpdatedEvent } from "@/application/events/message/message.event";
import { MessageSentHandler } from "@/application/events/message/message-sent.handler";
import { MessageStatusUpdatedHandler } from "@/application/events/message/message-status-updated.handler";
import { NotificationService } from "./notification.service";
import { sanitizeTextInput } from "@/utils/sanitizers";
import { isUserViewingConversation } from "../server/socketServer";

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
		@inject("MessageSentHandler") private readonly messageSentHandler: MessageSentHandler,
		@inject("MessageStatusUpdatedEventHandler")
		private readonly messageStatusUpdatedHandler: MessageStatusUpdatedHandler,
		@inject("NotificationService") private readonly notificationService: NotificationService,
	) {}

	async listConversations(
		userPublicId: string,
		page = 1,
		limit = 20,
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
				const unreadSeed = new Map<string, number>(participantIds.map((id) => [id, 0]));

				return this.conversationRepository.create(
					{
						participantHash,
						participants: participantObjectIds,
						lastMessageAt: new Date(),
						unreadCounts: unreadSeed,
						isGroup: false,
					},
					session,
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

		return this.mapConversationSummary(hydratedConversation as unknown as HydratedConversation, userInternalId);
	}

	async getConversationMessages(
		userPublicId: string,
		conversationPublicId: string,
		page = 1,
		limit = 30,
	): Promise<{
		messages: MessageDTO[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const conversation = await this.ensureConversationAccess(userPublicId, conversationPublicId);
		const conversationId = (conversation._id as unknown as mongoose.Types.ObjectId).toString();
		const userInternalId = await this.userRepository.findInternalIdByPublicId(userPublicId);
		if (!userInternalId) {
			throw createError("NotFoundError", "User not found");
		}

		if (page === 1) {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const updated = await this.messageRepository.markConversationMessagesAsDelivered(
					conversationId,
					userInternalId,
					session,
				);
				if (!updated) {
					return;
				}

				const participantIds = this.getParticipantIds(conversation.participants);
				const participantObjectIds = participantIds.map((participantId) => new mongoose.Types.ObjectId(participantId));
				const participantDocs = await this.userRepository
					.find({ _id: { $in: participantObjectIds } })
					.select("publicId")
					.session(session)
					.lean<UserPublicIdLean[]>()
					.exec();
				const participantPublicIds = participantDocs.map((doc) => doc.publicId).filter(Boolean);

				this.eventBus.queueTransactional(
					new MessageStatusUpdatedEvent(conversation.publicId, participantPublicIds, "delivered"),
					this.messageStatusUpdatedHandler,
				);
			});
		}

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

			const participantIds = this.getParticipantIds(conversation.participants);
			const participantObjectIds = participantIds.map((participantId) => new mongoose.Types.ObjectId(participantId));
			const participantDocs = await this.userRepository
				.find({ _id: { $in: participantObjectIds } })
				.select("publicId")
				.session(session)
				.lean<UserPublicIdLean[]>()
				.exec();
			const participantPublicIds = participantDocs.map((doc) => doc.publicId).filter(Boolean);

			this.eventBus.queueTransactional(
				new MessageStatusUpdatedEvent(conversation.publicId, participantPublicIds, "read"),
				this.messageStatusUpdatedHandler,
			);
		});
	}

	async sendMessage(senderPublicId: string, payload: SendMessagePayload): Promise<MessageDTO> {
		let sanitizedBody: string;
		try {
			sanitizedBody = sanitizeTextInput(payload.body, 5000);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Invalid message body";
			throw createError("ValidationError", message);
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

			await this.messageRepository.markConversationMessagesAsRead(
				(conversationDoc!._id as unknown as mongoose.Types.ObjectId).toString(),
				senderInternalId,
				session,
			);

			await this.conversationRepository.resetUnreadCount(
				(conversationDoc!._id as unknown as mongoose.Types.ObjectId).toString(),
				senderInternalId,
				session,
			);
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
					const unreadSeed = new Map<string, number>(participantIds.map((id) => [id, id === senderInternalId ? 0 : 1]));

					conversationDoc = await this.conversationRepository.create(
						{
							participantHash,
							participants: participantObjectIds,
							lastMessageAt: new Date(),
							unreadCounts: unreadSeed,
						},
						session,
					);
				}
			} else {
				const existingParticipantIds = this.getParticipantIds(conversationDoc.participants);
				if (!new Set(existingParticipantIds).has(senderInternalId)) {
					throw createError("ForbiddenError", "You do not have access to this conversation");
				}
			}

			const participantIds: string[] = this.getParticipantIds(conversationDoc!.participants);

			const recipientInternalIds: string[] = participantIds.filter((id: string) => id !== senderInternalId);

			const conversationId = (conversationDoc!._id as unknown as mongoose.Types.ObjectId).toString();
			const message = await this.messageRepository.create(
				{
					conversation: new mongoose.Types.ObjectId(conversationId),
					sender: new mongoose.Types.ObjectId(senderInternalId),
					body: sanitizedBody,
					attachments:
						Array.isArray(payload.attachments) && payload.attachments.length > 0
							? payload.attachments.map((attachment) => ({ ...attachment }))
							: undefined,
					readBy: [new mongoose.Types.ObjectId(senderInternalId)],
					status: "sent",
				},
				session,
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
						{},
					),
				},
				session,
			);

			await message.populate("sender", "publicId handle username avatar");
			const populatedMessage = message as unknown as IMessageWithPopulatedSender;

			const participantObjectIds = participantIds.map(
				(participantId: string) => new mongoose.Types.ObjectId(participantId),
			);
			const participantDocs = await this.userRepository
				.find({ _id: { $in: participantObjectIds } })
				.select("publicId")
				.session(session)
				.lean<UserPublicIdLean[]>()
				.exec();

			const participantPublicIds = participantDocs.map((doc) => doc.publicId);

			// Create notifications only for recipients who are NOT currently viewing this conversation
			const recipients = participantPublicIds.filter((id: string) => id !== senderPublicId);
			const recipientsNeedingNotification = recipients.filter(
				(recipientId) => !isUserViewingConversation(recipientId, conversationDoc!.publicId),
			);

			// only create notifications for users not actively viewing the conversation
			if (recipientsNeedingNotification.length > 0) {
				await Promise.all(
					recipientsNeedingNotification.map((recipientId) =>
												this.notificationService.createNotification({
													receiverId: recipientId,
													actionType: "message",
													actorId: senderPublicId,
													actorUsername: populatedMessage.sender?.username,
													actorHandle: populatedMessage.sender?.handle,
													actorAvatar: populatedMessage.sender?.avatar,
													targetId: conversationDoc!.publicId,
													targetType: "conversation",
													targetPreview: sanitizedBody.substring(0, 50) + (sanitizedBody.length > 50 ? "..." : ""),
													session,
						}),
					),
				);
			}

			this.eventBus.queueTransactional(
				new MessageSentEvent(conversationDoc!.publicId, senderPublicId, recipients, message.publicId),
				this.messageSentHandler,
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

	private mapConversationSummary(conversation: HydratedConversation, userInternalId: string): ConversationSummaryDTO {
		const unreadCounts = this.extractUnreadCounts(conversation.unreadCounts);
		const participants = Array.isArray(conversation.participants)
			? conversation.participants
					.map((participant) => {
						// handle ObjectId case
						if (participant instanceof mongoose.Types.ObjectId) {
						return {
							publicId: "",
							handle: "",
							username: "",
							avatar: "",
						};
						}
						// handle populated participant case
						const populatedParticipant = participant as MaybePopulatedParticipant;
						return {
							publicId: populatedParticipant?.publicId ?? this.extractParticipantId(participant) ?? "",
							handle: populatedParticipant?.handle ?? "",
							username: populatedParticipant?.username ?? "",
							avatar: populatedParticipant?.avatar ?? "",
						};
					})
					.filter((participant) => Boolean(participant.publicId))
			: [];

		const hasLastMessage =
			conversation.lastMessage && (conversation.lastMessage.publicId || conversation.lastMessage._id);
		const lastMessage =
			hasLastMessage && conversation.lastMessage
				? this.dtoService.toPublicMessageDTO(conversation.lastMessage, conversation.publicId)
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

	private extractUnreadCounts(
		unreadCounts: Map<string, number> | Record<string, number> | null | undefined,
	): Record<string, number> {
		if (!unreadCounts) {
			return {};
		}

		if (unreadCounts instanceof Map) {
			return Object.fromEntries(unreadCounts.entries());
		}

		return unreadCounts;
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

	private participantMatchesUser(
		participant: MaybePopulatedParticipant | mongoose.Types.ObjectId | string | null,
		userInternalId: string,
	): boolean {
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

	private extractParticipantId(
		participant: MaybePopulatedParticipant | mongoose.Types.ObjectId | string | null,
	): string | null {
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

	private getParticipantIds(
		participants: Array<MaybePopulatedParticipant | mongoose.Types.ObjectId | string> | null | undefined,
	): string[] {
		if (!Array.isArray(participants)) {
			return [];
		}

		return participants
			.map((participant) => this.extractParticipantId(participant))
			.filter((id): id is string => Boolean(id));
	}
}

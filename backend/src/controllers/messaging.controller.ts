import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { MessagingService } from "../services/messaging.service";
import { createError } from "../utils/errors";
import { SendMessagePayload } from "../types";

@injectable()
export class MessagingController {
	constructor(@inject("MessagingService") private readonly messagingService: MessagingService) {}

	listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const userPublicId = req.decodedUser?.publicId as string | undefined;
			if (!userPublicId) {
				throw createError("AuthenticationError", "User must be logged in to view conversations");
			}

			const page = Number(req.query.page) || 1;
			const limit = Number(req.query.limit) || 20;

			const result = await this.messagingService.listConversations(userPublicId, page, limit);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getConversationMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const userPublicId = req.decodedUser?.publicId as string | undefined;
			if (!userPublicId) {
				throw createError("AuthenticationError", "User must be logged in to view messages");
			}

			const { conversationId } = req.params;
			const page = Number(req.query.page) || 1;
			const limit = Number(req.query.limit) || 30;

			const result = await this.messagingService.getConversationMessages(userPublicId, conversationId, page, limit);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	markConversationRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const userPublicId = req.decodedUser?.publicId as string | undefined;
			if (!userPublicId) {
				throw createError("AuthenticationError", "User must be logged in to update read state");
			}

			const { conversationId } = req.params;
			await this.messagingService.markConversationRead(userPublicId, conversationId);
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	initiateConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const senderPublicId = req.decodedUser?.publicId as string | undefined;
			if (!senderPublicId) {
				throw createError("AuthenticationError", "User must be logged in to start a conversation");
			}

			const recipientPublicId = req.body.recipientPublicId as string | undefined;
			if (!recipientPublicId) {
				throw createError("ValidationError", "Recipient public ID is required");
			}

			const conversation = await this.messagingService.initiateConversation(senderPublicId, recipientPublicId);
			res.status(201).json({ conversation });
		} catch (error) {
			next(error);
		}
	};

	sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const senderPublicId = req.decodedUser?.publicId as string | undefined;
			if (!senderPublicId) {
				throw createError("AuthenticationError", "User must be logged in to send messages");
			}

			const payload: SendMessagePayload = {
				conversationPublicId: req.body.conversationPublicId,
				recipientPublicId: req.body.recipientPublicId,
				body: req.body.body,
				attachments: req.body.attachments,
			};

			const message = await this.messagingService.sendMessage(senderPublicId, payload);
			res.status(201).json({ message });
		} catch (error) {
			next(error);
		}
	};
}

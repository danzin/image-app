import { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { MessagingService } from "@/services/messaging.service";
import { createError } from "@/utils/errors";
import { SendMessagePayload } from "@/types";
import { streamPaginatedResponse } from "@/utils/streamResponse";
import { TOKENS } from "@/types/tokens";

/** Threshold for enabling streaming responses (items) */
const STREAM_THRESHOLD = 100;

@injectable()
export class MessagingController {
  constructor(
    @inject(TOKENS.Services.Messaging)
    private readonly messagingService: MessagingService,
  ) {}

  listConversations = async (req: Request, res: Response): Promise<void> => {
    const userPublicId = req.decodedUser?.publicId as string | undefined;
    if (!userPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to view conversations",
      );
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await this.messagingService.listConversations(
      userPublicId,
      page,
      limit,
    );
    res.status(200).json(result);
  };

  getConversationMessages = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const userPublicId = req.decodedUser?.publicId as string | undefined;
    if (!userPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to view messages",
      );
    }

    const { conversationId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;

    const result = await this.messagingService.getConversationMessages(
      userPublicId,
      conversationId,
      page,
      limit,
    );

    if (result.messages.length >= STREAM_THRESHOLD) {
      streamPaginatedResponse(res, result.messages, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      }, { arrayKey: "messages" });
    } else {
      res.status(200).json(result);
    }
  };

  markConversationRead = async (req: Request, res: Response): Promise<void> => {
    const userPublicId = req.decodedUser?.publicId as string | undefined;
    if (!userPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to update read state",
      );
    }

    const { conversationId } = req.params;
    await this.messagingService.markConversationRead(
      userPublicId,
      conversationId,
    );
    res.status(204).send();
  };

  initiateConversation = async (req: Request, res: Response): Promise<void> => {
    const senderPublicId = req.decodedUser?.publicId as string | undefined;
    if (!senderPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to start a conversation",
      );
    }

    const { recipientPublicId } = req.body; // validated by Zod middleware

    const conversation = await this.messagingService.initiateConversation(
      senderPublicId,
      recipientPublicId,
    );
    res.status(201).json({ conversation });
  };

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    const senderPublicId = req.decodedUser?.publicId as string | undefined;
    if (!senderPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to send messages",
      );
    }

    const payload: SendMessagePayload = {
      conversationPublicId: req.body.conversationPublicId,
      recipientPublicId: req.body.recipientPublicId,
      body: req.body.body,
      attachments: req.body.attachments,
    };

    const message = await this.messagingService.sendMessage(
      senderPublicId,
      payload,
      req.file,
    );
    res.status(201).json({ message });
  };

  editMessage = async (req: Request, res: Response): Promise<void> => {
    const userPublicId = req.decodedUser?.publicId as string | undefined;
    if (!userPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to edit messages",
      );
    }

    const { messageId } = req.params;
    const { body } = req.body;

    const message = await this.messagingService.editMessage(
      userPublicId,
      messageId,
      body,
    );
    res.status(200).json({ message });
  };

  deleteMessage = async (req: Request, res: Response): Promise<void> => {
    const userPublicId = req.decodedUser?.publicId as string | undefined;
    if (!userPublicId) {
      throw createError(
        "AuthenticationError",
        "User must be logged in to delete messages",
      );
    }

    const { messageId } = req.params;

    await this.messagingService.deleteMessage(userPublicId, messageId);
    res.status(204).send();
  };
}

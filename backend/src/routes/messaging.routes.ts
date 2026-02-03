import express from "express";
import { inject, injectable } from "tsyringe";
import { AuthFactory } from "../middleware/authentication.middleware";
import { MessagingController } from "../controllers/messaging.controller";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import upload from "../config/multer";
import {
	paginationSchema,
	conversationParamsSchema,
	initiateConversationSchema,
	sendMessageSchema,
	messageParamsSchema,
	editMessageSchema,
} from "@/utils/schemas/messaging.schemas";

@injectable()
export class MessagingRoutes {
	private readonly router: express.Router;
	private readonly auth = AuthFactory.bearerToken().handle();

	constructor(@inject("MessagingController") private readonly messagingController: MessagingController) {
		this.router = express.Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.use(this.auth);

		this.router.get(
			"/conversations",
			new ValidationMiddleware({ query: paginationSchema }).validate(),
			this.messagingController.listConversations
		);

		this.router.get(
			"/conversations/:conversationId/messages",
			new ValidationMiddleware({ params: conversationParamsSchema, query: paginationSchema }).validate(),
			this.messagingController.getConversationMessages
		);

		this.router.post(
			"/conversations/initiate",
			new ValidationMiddleware({ body: initiateConversationSchema }).validate(),
			this.messagingController.initiateConversation
		);

		this.router.post(
			"/conversations/:conversationId/read",
			new ValidationMiddleware({ params: conversationParamsSchema }).validate(),
			this.messagingController.markConversationRead
		);

		this.router.post(
			"/messages",
			upload.single("image"),
			// Note: validation middleware for body might fail if multipart form data is used and body is not JSON. 
			// Multer parses body. ValidationMiddleware should handle parsed body.
			new ValidationMiddleware({ body: sendMessageSchema }).validate(),
			this.messagingController.sendMessage
		);

		this.router.patch(
			"/messages/:messageId",
			new ValidationMiddleware({ params: messageParamsSchema, body: editMessageSchema }).validate(),
			this.messagingController.editMessage
		);

		this.router.delete(
			"/messages/:messageId",
			new ValidationMiddleware({ params: messageParamsSchema }).validate(),
			this.messagingController.deleteMessage
		);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}

import express from "express";
import { inject, injectable } from "tsyringe";
import { AuthFactory } from "../middleware/authentication.middleware";
import { MessagingController } from "../controllers/messaging.controller";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import {
	paginationSchema,
	conversationParamsSchema,
	initiateConversationSchema,
	sendMessageSchema,
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
			new ValidationMiddleware({ body: sendMessageSchema }).validate(),
			this.messagingController.sendMessage
		);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}

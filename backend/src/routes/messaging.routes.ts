import express from "express";
import { inject, injectable } from "tsyringe";
import { AuthFactory } from "../middleware/authentication.middleware";
import { MessagingController } from "../controllers/messaging.controller";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import { MessagingValidationSchemas } from "../utils/schemals/messaging.schemas";

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
			new ValidationMiddleware(MessagingValidationSchemas.listConversations()).validate(),
			this.messagingController.listConversations
		);

		this.router.get(
			"/conversations/:conversationId/messages",
			new ValidationMiddleware(MessagingValidationSchemas.conversationMessages()).validate(),
			this.messagingController.getConversationMessages
		);

		this.router.post(
			"/conversations/initiate",
			new ValidationMiddleware(MessagingValidationSchemas.initiateConversation()).validate(),
			this.messagingController.initiateConversation
		);

		this.router.post(
			"/conversations/:conversationId/read",
			new ValidationMiddleware(MessagingValidationSchemas.markConversationRead()).validate(),
			this.messagingController.markConversationRead
		);

		this.router.post(
			"/messages",
			new ValidationMiddleware(MessagingValidationSchemas.sendMessage()).validate(),
			this.messagingController.sendMessage
		);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}

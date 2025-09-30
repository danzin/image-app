import Joi from "joi";
import { ValidationSchema } from "./user.schemas";

const publicIdPattern = /^[A-Za-z0-9._\/-]{1,200}$/;

export class MessagingSchemas {
	static pagination(): Joi.ObjectSchema {
		return Joi.object({
			page: Joi.number().integer().min(1).default(1),
			limit: Joi.number().integer().min(1).max(100).default(20),
		})
			.options({ allowUnknown: false, stripUnknown: true })
			.messages({
				"number.base": "Pagination values must be numbers",
				"number.min": "Pagination values must be at least 1",
			});
	}

	static conversationParams(): Joi.ObjectSchema {
		return Joi.object({
			conversationId: Joi.string().pattern(publicIdPattern).required().messages({
				"string.pattern.base": "Invalid conversation public ID format",
				"any.required": "Conversation public ID is required",
			}),
		}).options({ allowUnknown: false, stripUnknown: true });
	}

	static sendMessageBody(): Joi.ObjectSchema {
		return Joi.object({
			conversationPublicId: Joi.string().pattern(publicIdPattern).optional(),
			recipientPublicId: Joi.string().pattern(publicIdPattern).optional(),
			body: Joi.string().trim().min(1).max(5000).required().messages({
				"string.empty": "Message body cannot be empty",
				"string.min": "Message body cannot be empty",
				"string.max": "Message body is too long",
				"any.required": "Message body is required",
			}),
			attachments: Joi.array()
				.items(
					Joi.object({
						url: Joi.string().uri().required(),
						type: Joi.string().trim().max(50).required(),
						mimeType: Joi.string().trim().max(100).optional(),
						thumbnailUrl: Joi.string().uri().optional(),
					})
				)
				.optional(),
		})
			.or("conversationPublicId", "recipientPublicId")
			.messages({
				"object.missing": "Either conversationPublicId or recipientPublicId must be provided",
			})
			.options({ allowUnknown: false, stripUnknown: true });
	}
}

export class MessagingValidationSchemas {
	static listConversations(): ValidationSchema {
		return { query: MessagingSchemas.pagination() };
	}

	static conversationMessages(): ValidationSchema {
		return {
			params: MessagingSchemas.conversationParams(),
			query: MessagingSchemas.pagination(),
		};
	}

	static markConversationRead(): ValidationSchema {
		return {
			params: MessagingSchemas.conversationParams(),
		};
	}

	static sendMessage(): ValidationSchema {
		return {
			body: MessagingSchemas.sendMessageBody(),
		};
	}
}

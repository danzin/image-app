import { z } from "zod";
import { sanitizeForMongo } from "../../utils/sanitizers";

export const paginationSchema = z
	.object({
		page: z.coerce.number().int().positive().optional().default(1),
		limit: z.coerce.number().int().positive().optional().default(20),
	})
	.strict();

export const conversationParamsSchema = z
	.object({
		conversationId: z.string().uuid("Invalid conversation ID format."),
	})
	.strict();

export const sendMessageSchema = z
	.object({
		conversationPublicId: z.string().uuid().optional(),
		recipientPublicId: z.string().uuid().optional(),
		body: z.string().trim().min(1).max(5000),
		attachments: z
			.array(
				z.object({
					url: z.string().url(),
					type: z.string().max(50),
					mimeType: z.string().max(100).optional(),
					thumbnailUrl: z.string().url().optional(),
				})
			)
			.optional(),
	})
	.strict()
	.transform(sanitizeForMongo)
	.refine((data) => data.conversationPublicId || data.recipientPublicId, {
		message: "Either conversationPublicId or recipientPublicId must be provided",
	});

export const initiateConversationSchema = z
	.object({
		recipientPublicId: z.string().uuid("Invalid recipient public ID format."),
	})
	.strict()
	.transform(sanitizeForMongo);

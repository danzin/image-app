import { z } from "zod";
import { sanitizeForMongo, sanitize } from "../../utils/sanitizers";

export const createCommentSchema = z
	.object({
		content: z
			.string()
			.trim()
			.min(1, "Comment cannot be empty.")
			.max(250, "Comment cannot be longer than 250 characters.")
			.transform(sanitize),
	})
	.strict()
	.transform(sanitizeForMongo);

export const updateCommentSchema = z
	.object({
		content: z
			.string()
			.trim()
			.min(1, "Comment cannot be empty.")
			.max(250, "Comment cannot be longer than 250 characters.")
			.transform(sanitize),
	})
	.strict()
	.transform(sanitizeForMongo);

export const commentIdSchema = z
	.object({
		commentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid comment ID format."),
	})
	.strict();

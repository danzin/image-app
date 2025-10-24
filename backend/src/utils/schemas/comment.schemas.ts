import { z } from "zod";
import sanitizeHtml from "sanitize-html";

// sanitize HTML content to prevent XSS
const sanitize = (text: string) =>
	sanitizeHtml(text, {
		allowedTags: [],
		allowedAttributes: {},
	});

// prevent prototype pollution by stripping dangerous keys from objects
// this protects against attacks like: { "__proto__": { "isAdmin": true } }
// note: this does NOT affect string content - users can still say "__proto__" in text
const stripDangerousKeys = <T extends Record<string, unknown>>(obj: T): T => {
	const dangerousKeys = ["__proto__", "constructor", "prototype"];
	const cleaned = { ...obj };

	for (const key of dangerousKeys) {
		if (key in cleaned) {
			delete cleaned[key];
		}
	}

	return cleaned;
};

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
	.transform(stripDangerousKeys);

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
	.transform(stripDangerousKeys);

export const commentIdSchema = z
	.object({
		commentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid comment ID format."),
	})
	.strict();

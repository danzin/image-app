import { z } from "zod";
import { stripDangerousKeys, sanitize } from "../../utils/sanitizers";

export const createPostSchema = z
	.object({
		body: z
			.string()
			.trim()
			.min(1, "Body cannot be empty.")
			.max(300, "Body cannot be longer than 300 characters.")
			.transform(sanitize)
			.optional(),
		tags: z.preprocess(
			(val) => {
				if (typeof val === "string") {
					try {
						const parsed = JSON.parse(val);
						if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
							return parsed;
						}
					} catch {
						// if cant parse return empty arr
						return [];
					}
				}
				return Array.isArray(val) ? val : [];
			},
			z.array(z.string().trim().min(1).max(20)).max(5, "You can add up to 5 tags.").default([])
		),
	})
	.passthrough() // allow extra fields from multer
	.transform((data) => {
		// strip dangerous keys after passthrough
		const cleaned = stripDangerousKeys(data);
		// only return relevant filds
		return {
			body: cleaned.body,
			tags: cleaned.tags,
		};
	});

export const slugSchema = z
	.object({
		slug: z
			.string()
			.trim()
			.min(1, "Slug cannot be empty.")
			.regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
	})
	.strict();

export const publicIdSchema = z
	.object({
		publicId: z.string().uuid("Invalid public ID format."),
	})
	.strict();

export const postPublicIdSchema = z
	.object({
		postPublicId: z.string().uuid("Invalid post public ID format."),
	})
	.strict();

export const searchByTagsSchema = z
	.object({
		tags: z.string().trim().min(1, "Tags query cannot be empty."),
		page: z.coerce.number().int().positive().optional().default(1),
		limit: z.coerce.number().int().positive().optional().default(10),
	})
	.strict();

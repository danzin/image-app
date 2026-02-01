import { z } from "zod";
import { sanitizeForMongo, sanitize } from "@/utils/sanitizers";

export const createCommunitySchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(3, "Community name must be at least 3 characters")
			.max(50, "Community name cannot exceed 50 characters")
			.transform(sanitize),
		description: z
			.string()
			.trim()
			.min(10, "Description must be at least 10 characters")
			.max(500, "Description cannot exceed 500 characters")
			.transform(sanitize),
	})
	.passthrough() // allow avatar file from multer
	.transform((data) => {
		const cleaned = sanitizeForMongo(data);
		return {
			name: cleaned.name,
			description: cleaned.description,
		};
	});

export const updateCommunitySchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(3, "Community name must be at least 3 characters")
			.max(50, "Community name cannot exceed 50 characters")
			.transform(sanitize)
			.optional(),
		description: z
			.string()
			.trim()
			.min(10, "Description must be at least 10 characters")
			.max(500, "Description cannot exceed 500 characters")
			.transform(sanitize)
			.optional(),
	})
	.strict()
	.transform(sanitizeForMongo)
	.refine((data) => data.name || data.description, {
		message: "At least one field must be provided for update",
	});

export const communityPublicIdSchema = z
	.object({
		id: z.string().uuid("Invalid community ID format"),
	})
	.strict();

export const communitySlugSchema = z
	.object({
		slug: z
			.string()
			.trim()
			.min(1, "Slug cannot be empty")
			.max(60, "Slug cannot exceed 60 characters")
			.regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
	})
	.strict();

export const kickMemberSchema = z
	.object({
		id: z.string().uuid("Invalid community ID format"),
		userId: z.string().uuid("Invalid user ID format"),
	})
	.strict();

export const communitySearchSchema = z
	.object({
		page: z.coerce.number().int().positive().optional().default(1),
		limit: z.coerce.number().int().positive().max(100).optional().default(20),
		search: z.string().trim().max(100).transform(sanitize).optional(),
	})
	.strict();

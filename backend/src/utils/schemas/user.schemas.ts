import { z } from "zod";
import { sanitizeForMongo } from "@/utils/sanitizers";

export const publicIdSchema = z
	.object({
		publicId: z.string().uuid("Invalid public ID format."),
	})
	.strict();

export const usernameSchema = z
	.object({
		username: z
			.string()
			.regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric.")
			.min(1)
			.max(30),
	})
	.strict();

export const handleSchema = z
	.object({
		handle: z
			.string()
			.regex(/^[a-zA-Z0-9._]+$/, "Handle must be alphanumeric and may include dots or underscores.")
			.min(4)
			.max(16),
	})
	.strict();

export const registrationSchema = z
	.object({
		email: z.string().email(),
		password: z.string().min(3),
		handle: z
			.string()
			.regex(/^[a-zA-Z0-9._]+$/, "Handle must be alphanumeric and may include dots or underscores.")
			.min(4)
			.max(16),
		username: z
			.string()
			.regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric.")
			.min(1)
			.max(30),
		confirmPassword: z.string(),
		website: z.string().optional(),
	})
	.strict()
	.transform(sanitizeForMongo)
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export const loginSchema = z
	.object({
		email: z.string().email(),
		password: z.string(),
		website: z.string().optional(),
	})
	.strict()
	.transform(sanitizeForMongo);

export const updateProfileSchema = z
	.object({
		username: z
			.string()
			.regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric.")
			.min(1)
			.max(30)
			.optional(),
		bio: z.string().max(500).optional(),
	})
	.strict()
	.transform(sanitizeForMongo);

export const changePasswordSchema = z
	.object({
		currentPassword: z.string(),
		newPassword: z.string().min(8),
	})
	.strict()
	.transform(sanitizeForMongo);

export const requestPasswordResetSchema = z
	.object({
		email: z.string().email(),
		website: z.string().optional(),
	})
	.strict()
	.transform(sanitizeForMongo);

export const resetPasswordSchema = z
	.object({
		token: z.string().min(1),
		newPassword: z.string().min(8),
	})
	.strict()
	.transform(sanitizeForMongo);

export const verifyEmailSchema = z
	.object({
		email: z.string().email(),
		token: z.string().regex(/^\d{5}$/, "Token must be 5 digits"),
	})
	.strict()
	.transform(sanitizeForMongo);

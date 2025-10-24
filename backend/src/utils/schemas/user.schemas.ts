import { z } from "zod";
import { stripDangerousKeys } from "../../utils/sanitizers";

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

export const registrationSchema = z
	.object({
		email: z.string().email(),
		password: z.string().min(8),
		username: z
			.string()
			.regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric.")
			.min(1)
			.max(30),
		confirmPassword: z.string(),
	})
	.strict()
	.transform(stripDangerousKeys)
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export const loginSchema = z
	.object({
		email: z.string().email(),
		password: z.string(),
	})
	.strict()
	.transform(stripDangerousKeys);

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
	.transform(stripDangerousKeys);

export const changePasswordSchema = z
	.object({
		currentPassword: z.string(),
		newPassword: z.string().min(8),
	})
	.strict()
	.transform(stripDangerousKeys);

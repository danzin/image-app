import Joi, { Schema } from "joi";

export class UserSchemas {
	static registration(): Joi.ObjectSchema {
		return Joi.object({
			email: Joi.string().email().required(),
			password: Joi.string().min(1).required(),
			username: Joi.string().alphanum().min(1).max(30).required(),
			confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
		});
	}

	static login(): Joi.ObjectSchema {
		return Joi.object({
			email: Joi.string().email().required(),
			password: Joi.string().required(),
		});
	}

	// For internal operations still using MongoDB ObjectIDs
	static followParams(): Joi.ObjectSchema {
		return Joi.object({
			targetUserId: Joi.string()
				.pattern(/^[0-9a-fA-F]{24}$/)
				.required()
				.messages({
					"string.pattern.base": "Invalid target user ID format",
					"any.required": "Target user ID is required",
				}),
		}).options({ allowUnknown: false });
	}

	// For public endpoints using UUIDs
	static publicIdParams(): Joi.ObjectSchema {
		// Accept UUID-like values (with optional image extension) and cloud-style IDs (may include slashes)
		const permissiveId = /^[A-Za-z0-9._\/-]{1,200}$/;
		return Joi.object({
			publicId: Joi.string().pattern(permissiveId).required().messages({
				"string.pattern.base": "Invalid public ID format",
				"any.required": "Public ID is required",
			}),
		}).options({ allowUnknown: false });
	}

	// For username-based routes
	static usernameParams(): Joi.ObjectSchema {
		return Joi.object({
			username: Joi.string().alphanum().min(1).max(30).required().messages({
				"string.alphanum": "Username must contain only alphanumeric characters",
				"string.min": "Username must be at least 1 character long",
				"string.max": "Username must not exceed 30 characters",
				"any.required": "Username is required",
			}),
		}).options({ allowUnknown: false });
	}

	// For profile update
	static updateProfile(): Joi.ObjectSchema {
		return Joi.object({
			username: Joi.string().alphanum().min(1).max(30).optional().messages({
				"string.alphanum": "Username must contain only alphanumeric characters",
				"string.min": "Username must be at least 1 character long",
				"string.max": "Username must not exceed 30 characters",
			}),
			bio: Joi.string().max(500).allow("").optional().messages({
				"string.max": "Bio must not exceed 500 characters",
			}),
		}).options({ allowUnknown: false, stripUnknown: true });
	}

	// For password change
	static changePassword(): Joi.ObjectSchema {
		return Joi.object({
			currentPassword: Joi.string().required().messages({
				"any.required": "Current password is required",
			}),
			newPassword: Joi.string().min(8).required().messages({
				"string.min": "New password must be at least 8 characters long",
				"any.required": "New password is required",
			}),
		}).options({ allowUnknown: false });
	}
}

// Image validation schemas
export class ImageSchemas {
	// For slug-based image routes
	static slugParams(): Joi.ObjectSchema {
		return Joi.object({
			slug: Joi.string()
				// allow standard slug plus an optional file extension (e.g., .png, .jpg)
				.pattern(/^[a-z0-9-]+(?:\.[a-z0-9]{2,5})?$/i)
				.min(1)
				.max(100)
				.required()
				.messages({
					"string.pattern.base": "Invalid slug format",
					"string.min": "Slug must be at least 1 character long",
					"string.max": "Slug must not exceed 100 characters",
					"any.required": "Slug is required",
				}),
		}).options({ allowUnknown: false });
	}

	// For public ID based image routes
	static publicIdParams(): Joi.ObjectSchema {
		const permissiveId = /^[A-Za-z0-9._\/-]{1,200}$/;
		return Joi.object({
			publicId: Joi.string().pattern(permissiveId).required().messages({
				"string.pattern.base": "Invalid public ID format",
				"any.required": "Public ID is required",
			}),
		}).options({ allowUnknown: false });
	}
}

export interface ValidationSchema {
	body?: Schema;
	params?: Schema;
	query?: Schema;
}

export class UserValidationSchemas {
	static registration(): ValidationSchema {
		return {
			body: Joi.object({
				email: Joi.string().email().required(),
				password: Joi.string().min(8).required(),
			}),
		};
	}

	static login(): ValidationSchema {
		return {
			body: Joi.object({
				email: Joi.string().email().required(),
				password: Joi.string().required(),
			}),
		};
	}

	static followAction(): ValidationSchema {
		return {
			params: UserSchemas.followParams(),
		};
	}

	static publicIdAction(): ValidationSchema {
		return {
			params: UserSchemas.publicIdParams(),
		};
	}

	static usernameAction(): ValidationSchema {
		return {
			params: UserSchemas.usernameParams(),
		};
	}
}

export class ImageValidationSchemas {
	static slugAction(): ValidationSchema {
		return {
			params: ImageSchemas.slugParams(),
		};
	}

	static publicIdAction(): ValidationSchema {
		return {
			params: ImageSchemas.publicIdParams(),
		};
	}
}

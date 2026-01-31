import mongoose from "mongoose";
import { AppError, isAppError, isMongoDBDuplicateKeyError } from "@/utils/errors";

export class PostNotFoundError extends AppError {
	constructor(message = "Post not found", context?: Record<string, unknown>) {
		super("PostNotFoundError", message, 404, context);
	}
}

export class PostAuthorizationError extends AppError {
	constructor(message = "You do not have permission to perform this action", context?: Record<string, unknown>) {
		super("PostAuthorizationError", message, 403, context);
	}
}

export class UserNotFoundError extends AppError {
	constructor(message = "User not found", context?: Record<string, unknown>) {
		super("UserNotFoundError", message, 404, context);
	}
}

export class PostConflictError extends AppError {
	constructor(message = "Post already exists", context?: Record<string, unknown>) {
		super("PostConflictError", message, 409, context);
	}
}

export class PostPersistenceError extends AppError {
	constructor(message = "Failed to persist post", context?: Record<string, unknown>) {
		super("PostPersistenceError", message, 500, context);
	}
}

export function mapPostError(error: unknown, context: Record<string, unknown> = {}): AppError {
	if (isAppError(error)) {
		return error;
	}

	if (isMongoDBDuplicateKeyError(error)) {
		return new PostConflictError("Post already exists", { ...context, keyValue: error.keyValue });
	}

	if (error instanceof mongoose.Error.ValidationError) {
		return new PostPersistenceError(error.message, { ...context, cause: "validation" });
	}

	if (error instanceof mongoose.Error.CastError) {
		return new PostPersistenceError(error.message, { ...context, cause: "cast" });
	}

	if (error instanceof Error) {
		return new PostPersistenceError(error.message, { ...context, name: error.name });
	}

	return new PostPersistenceError("Unexpected post persistence error", context);
}

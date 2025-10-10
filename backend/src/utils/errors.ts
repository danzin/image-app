import express from "express";
import { errorLogger } from "./winston";

//improved err factory
class AppError extends Error {
	public statusCode: number;
	public context: any;
	constructor(name: string, message: string, statusCode: number, context?: any) {
		super(message);
		this.name = name;
		this.statusCode = statusCode;
		this.context = context;
	}
}

class ValidationError extends AppError {
	constructor(message: string) {
		super("ValidationError", message, 400);
	}
}

class UnauthorizedError extends AppError {
	constructor(message: string) {
		super("UnauthorizedError", message, 403);
	}
}

class AuthenticationError extends AppError {
	constructor(message: string) {
		super("AuthenticationError", message, 401);
	}
}

class PathError extends AppError {
	constructor(message: string) {
		super("PathError", message, 404);
	}
}

class NotFoundError extends AppError {
	constructor(message: string) {
		super("NotFoundError", message, 404);
	}
}

class ForbiddenError extends AppError {
	constructor(message: string) {
		super("ForbiddenError", message, 403);
	}
}

class SecurityError extends AppError {
	constructor(message: string) {
		super("SecurityError", message, 403);
	}
}

class DuplicateError extends AppError {
	constructor(message: string) {
		super("DuplicateError", message, 409);
	}
}

class InternalServerError extends AppError {
	constructor(message: string) {
		super("InternalServerError", message, 500);
	}
}

class UnknownError extends AppError {
	constructor(message: string) {
		super("UnknownError", message, 500);
	}
}

class TransactionError extends AppError {
	constructor(message: string) {
		super("TransactionError", message, 500);
	}
}

class DatabaseError extends AppError {
	constructor(message: string) {
		super("DatabaseError", message, 500);
	}
}

class UoWError extends AppError {
	constructor(message: string) {
		super("UoWError", message, 500);
	}
}

class StorageError extends AppError {
	constructor(message: string) {
		super("StorageError", message, 500);
	}
}

const errorMap: { [key: string]: new (message: string) => AppError } = {
	ValidationError,
	UnauthorizedError,
	AuthenticationError,
	PathError,
	NotFoundError,
	ForbiddenError,
	DuplicateError,
	InternalServerError,
	StorageError,
	UnknownError,
	TransactionError,
	UoWError,
	DatabaseError,
	SecurityError,
};

export function createError(type: string, message: string, context?: any): AppError {
	const ErrorClass = errorMap[type] || UnknownError;
	const error = new ErrorClass(message);
	if (context) {
		error.context = context;
	}
	return error;
}

export class ErrorHandler {
	static handleError(err: AppError, req: express.Request, res: express.Response, next: express.NextFunction): void {
		const response: any = {
			type: err.name,
			message: err.message,
			code: err.statusCode || 500,
		};

		if (err.context) {
			response.context = err.context;
		}

		// Log all errors to winston
		errorLogger.error({
			type: err.name,
			message: err.message,
			statusCode: err.statusCode || 500,
			context: err.context,
			stack: err.stack,
			method: req.method,
			url: req.originalUrl,
			ip: req.ip,
			userAgent: req.get("user-agent"),
			timestamp: new Date().toISOString(),
		});

		//Return stack trace when not in production
		if (process.env.NODE_ENV !== "production") {
			response.stack = err.stack;
		}
		res.status(err.statusCode || 500).json(response);
	}
}

import express from "express";
import { errorLogger } from "./winston";

export interface ErrorOptions {
  context?: Record<string, unknown>;
  cause?: unknown; // Preserves the original stack trace
}

export interface ErrorWithStatusCode extends Error {
  statusCode: number;
}

export interface MongoDBDuplicateKeyError extends Error {
  code: number;
  keyValue: Record<string, unknown>;
}

// type guards for error checking
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error !== null && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function getErrorCode(error: unknown): number | string | undefined {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "number" || typeof code === "string") return code;
  }
  return undefined;
}

export function getErrorLabels(error: unknown): string[] | undefined {
  if (error !== null && typeof error === "object" && "errorLabels" in error) {
    const labels = (error as { errorLabels: unknown }).errorLabels;
    if (Array.isArray(labels)) return labels as string[];
  }
  return undefined;
}

export function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  if (error !== null && typeof error === "object" && "name" in error) {
    const name = (error as { name: unknown }).name;
    if (typeof name === "string") return name;
  }
  return undefined;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNamedError(error: unknown): error is { name: string } {
  return (
    error !== null &&
    typeof error === "object" &&
    typeof (error as Record<string, unknown>).name === "string"
  );
}

export function isErrorWithStatusCode(
  error: unknown,
): error is ErrorWithStatusCode {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error instanceof Error
  );
}

export function isMongoDBDuplicateKeyError(
  error: unknown,
): error is MongoDBDuplicateKeyError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as MongoDBDuplicateKeyError).code === 11000 &&
    "keyValue" in error
  );
}

export class AppError extends Error {
  public statusCode: number;
  public context?: Record<string, unknown>;

  constructor(
    name: string,
    message: string,
    statusCode: number,
    options?: ErrorOptions,
  ) {
    // Pass the cause to the native Error constructor
    super(message, { cause: options?.cause });
    this.name = name;
    this.statusCode = statusCode;
    this.context = options?.context;

    // Capture proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Update your custom errors to accept options instead of completely overriding the constructor
class ValidationError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("ValidationError", message, 400, options);
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("UnauthorizedError", message, 401, options);
  }
}

class AuthenticationError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("AuthenticationError", message, 401, options);
  }
}

class PathError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("PathError", message, 404, options);
  }
}

class NotFoundError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("NotFoundError", message, 404, options);
  }
}

class ForbiddenError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("ForbiddenError", message, 403, options);
  }
}

class SecurityError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("SecurityError", message, 403, options);
  }
}

class DuplicateError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("DuplicateError", message, 409, options);
  }
}

class InternalServerError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("InternalServerError", message, 500, options);
  }
}

class UnknownError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("UnknownError", message, 500, options);
  }
}

class TransactionError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("TransactionError", message, 500, options);
  }
}

class DatabaseError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("DatabaseError", message, 500, options);
  }
}

class UoWError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("UoWError", message, 500, options);
  }
}

class StorageError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("StorageError", message, 500, options);
  }
}

class UploadError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("UploadError", message, 500, options);
  }
}

class FeedError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("FeedError", message, 500, options);
  }
}

class InternalError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("InternalError", message, 500, options);
  }
}

class ConfigError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("ConfigError", message, 500, options);
  }
}

class ConflictError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super("ConflictError", message, 409, options);
  }
}

const errorMap = {
  ValidationError,
  UnauthorizedError,
  AuthenticationError,
  PathError,
  NotFoundError,
  ForbiddenError,
  DuplicateError,
  InternalServerError,
  InternalError,
  StorageError,
  UploadError,
  FeedError,
  UnknownError,
  TransactionError,
  UoWError,
  DatabaseError,
  SecurityError,
  ConfigError,
  ConflictError,
};

export type ErrorType = keyof typeof errorMap;

export function createError(
  type: ErrorType,
  message: string,
  options?: ErrorOptions,
): AppError {
  const ErrorClass = errorMap[type] || UnknownError;
  return new ErrorClass(message, options);
}

/**
 * Wraps an unknown caught error as an AppError.
 * If the error is already an AppError it is returned unchanged (preserving its type & status code).
 * Otherwise it is wrapped with the given fallback type and the original error attached as `cause`.
 */
export function wrapError(
  error: unknown,
  fallbackType: ErrorType = "InternalServerError",
  options?: Omit<ErrorOptions, "cause">,
): AppError {
  if (error instanceof AppError) return error;
  return createError(fallbackType, getErrorMessage(error), {
    ...options,
    cause: error,
  });
}

export function handleMongoError(error: unknown): never {
  if (error instanceof AppError) throw error;

  if (isMongoDBDuplicateKeyError(error)) {
    throw createError(
      "DuplicateError",
      "Resource already exists (duplicate key).",
      { cause: error },
    );
  }

  if (typeof error === "object" && error !== null && "name" in error) {
    if ((error as Error).name === "ValidationError") {
      throw createError("ValidationError", (error as Error).message, {
        cause: error,
      });
    }
    if ((error as Error).name === "CastError") {
      throw createError(
        "ValidationError",
        "Invalid ID or data format provided.",
        { cause: error },
      );
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  throw createError("DatabaseError", message, { cause: error });
}

export class ErrorHandler {
  static handleError(
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ): void {
    const appError =
      err instanceof AppError
        ? err
        : createError("UnknownError", getErrorMessage(err), { cause: err });

    const response: Record<string, unknown> = {
      type: appError.name,
      message: appError.message,
      code: appError.statusCode || 500,
    };

    if (appError.context) response.context = appError.context;

    if (process.env.NODE_ENV !== "production") {
      response.stack = appError.stack;
      if (appError.cause instanceof Error) {
        // Expose DB layer stacktrace locally
        response.cause = {
          message: appError.cause.message,
          stack: appError.cause.stack,
        };
      }
    }

    errorLogger.error({
      type: appError.name,
      message: appError.message,
      statusCode: appError.statusCode || 500,
      context: appError.context,
      stack: appError.stack,
      cause: appError.cause,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(appError.statusCode || 500).json(response);
  }
}

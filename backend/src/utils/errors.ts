import express from 'express';

//improved err factory
class AppError extends Error {
  public statusCode: number;

  constructor(name: string, message: string, statusCode: number) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super('ValidationError', message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UnauthorizedError', message, 403);
  }
}

class AuthenticationError extends AppError {
  constructor(message: string) {
    super('AuthenticationError', message, 401);
  }
}

class PathError extends AppError {
  constructor(message: string) {
    super('PathError', message, 404);
  }
}

class DuplicateError extends AppError {
  constructor(message: string) {
    super('DuplicateError', message, 409);
  }
}

class InternalServerError extends AppError {
  constructor(message: string) {
    super('InternalServerError', message, 500);
  }
}

class UnknownError extends AppError {
  constructor(message: string) {
    super('UnknownError', message, 500);
  }
}

const errorMap: { [key: string]: new (message: string) => AppError } = {
  ValidationError,
  UnauthorizedError,
  AuthenticationError,
  PathError,
  DuplicateError,
  InternalServerError,
  UnknownError,
};

export function createError(type: string, message: string): AppError {
  const ErrorClass = errorMap[type] || UnknownError;
  return new ErrorClass(message);
}

export class ErrorHandler {
  static handleError(
    err: AppError,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void {
    const response: any = {
      type: err.name,
      message: err.message,
      code: err.statusCode || 500,
    };

    //Return stack trace when not in production
    if (process.env.NODE_ENV !== 'production') {
      response.stack = err.stack;
    }
    res.status(err.statusCode || 500).json(response);
  }
}

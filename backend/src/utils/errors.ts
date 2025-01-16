import express from 'express';

class ValidationError extends Error {
  public statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;

  }
}

class UnauthorizedError extends Error{
  public statusCode: number;

  constructor(message: string){
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 403;
  }
}

class AuthenticationError extends Error {
  public statusCode: number;

  constructor(message: string){
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class PathError extends Error {
  public statusCode: number;

  constructor(message: string){
    super(message);
    this.name = 'PathError';
    this.statusCode = 404;
  }
}

class DuplicateError extends Error {
  public statusCode: number;

  constructor(message: string){
    super(message);
    this.name = 'DuplicateError';
    this.statusCode = 409;
  }
}

class InternalServerError extends Error {
  public statusCode: number;

  constructor(message: string){
    super(message);
    this.name = 'InternalServerError';
    this.statusCode = 500;
  }
}

export function createError(type: string, message: string): Error{
  switch(type){
    case 'ValidationError':
      return new ValidationError(message);
    case 'AuthenticationError':
      return new AuthenticationError(message);
    case 'PathError':
      return new PathError(message);
    case 'UnauthorizedError':
      return new UnauthorizedError(message);
    case 'InternalServerError':
      return new InternalServerError(message);
    case 'DuplicateError':
      return new DuplicateError(message);
    default: 
      throw new Error(message);
  }
}

export class ErrorHandler {
  private static errorMap: {  [key: string]: number} = {
    ValidationError: 400,
    AuthenticationError: 401,
    UnauthorizedError: 403,
    PathError: 404,
    DuplicateError: 409,
    InternalServerError: 500,

  }
  
  static handleError(
    err: Error, 
    req: express.Request, 
    res: express.Response, 
    next: express.NextFunction
  ): void {
    const statusCode = ErrorHandler.errorMap[err.name] || 500;
    res.status(statusCode).json({
      type: err.name,
      message: err.message,
      code: statusCode
  });

  }
}
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createError } from '../utils/errors';
import sanitize from 'mongo-sanitize';
import { IUser } from '../models/user.model';


declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
    }
  }
}

interface ValidationStrategy {
  validate(req: Request): void;
}

export class UserRegistrationValidation implements ValidationStrategy {
  validate(req: Request): void {
    const { email = '', password = '', username = '' } = req.body;
    if (!email || !password || !username) {
      throw createError('ValidationError', 'All fields are requiredYO');
    }
    if (!isEmail(email)) {
      throw createError('ValidationError', 'Invalid email format.');
    }
    req.validatedBody = {
      email: sanitize(email),
      password: sanitize(password),
      username: sanitize(username),
    };
  }
}

export class UserLoginValidation implements ValidationStrategy {
  validate(req: Request): void {
    const { email = '', password = '' } = req.body;
    if (!email || !password) {
      throw createError('ValidationError', 'All fields are required');
    }
    if (!isEmail(email)) {
      throw createError('ValidationError', 'Invalid email format.');
    }
    req.validatedBody = {
      email: sanitize(email),
      password: sanitize(password),
    };
  }
}

export class UserEditValidation implements ValidationStrategy{
  validate(req: Request): void {
    const { email = '', password = '', username = '' } = req.body;
    if (!email && !password && !username) {
      throw createError('ValidationError', 'At least one field is required');
    }
    if (email && !isEmail(email)) {
      throw createError('ValidationError', 'Invalid email format');
    }
    req.validatedBody = {
      email: sanitize(email),
      password: sanitize(password),
      username: sanitize(username),
    };
  }

}

export class ValidationMiddleware {
  static validate(strategy: ValidationStrategy): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        strategy.validate(req);
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}


function isEmail(e: string){
  const filter = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  return e.match(filter);
}

  


import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      decodedUser?: JwtPayload;
    }
  }
}

export abstract class AuthStrategy {
  abstract authenticate(req: Request): Promise<JwtPayload>;
}

export class BearerTokenStrategy extends AuthStrategy {
  constructor(private secret: string) {
    super();
  }

  async authenticate(req: Request): Promise<JwtPayload> {
    const token = req.headers.authorization?.split(' ')[1];
    console.log(`token: ${token}`)
    if (!token) throw createError('UnauthorizedError', 'Missing token');
    const user = jwt.verify(token, this.secret) as JwtPayload
    return user;
  }
}

export class AuthenticationMiddleware {
  constructor(private strategy: AuthStrategy) {}

  handle(): RequestHandler {
    return async (req: Request, _res: Response, next: NextFunction) => {
      try {
        req.decodedUser = await this.strategy.authenticate(req);
        next();
      } catch (error) {
        next(createError('UnauthorizedError', error.message));
      }
    };
  }
}

// Factory for common authentication types
export class AuthFactory {
  static bearerToken(): AuthenticationMiddleware {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    
    return new AuthenticationMiddleware(
      new BearerTokenStrategy(secret)
    );
  }
}
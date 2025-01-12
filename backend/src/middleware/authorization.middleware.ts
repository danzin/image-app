import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createError } from '../utils/errors';

declare global {
  namespace Express{
    interface Request{
      decodedUser?:  JwtPayload;
    }
  }
}


export class AuthentitactionMiddleware {
  private static SECRET_KEY: string = process.env.JWT_SECRET;

  static auth: RequestHandler = async (
    req: Request,
    res: Response,
    next:NextFunction) => {
      try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if(!token){
          createError('UnauthorizedError', 'Unauthorized');
        }
      
        const decoded = jwt.verify(token, AuthentitactionMiddleware.SECRET_KEY) as JwtPayload;
        req.decodedUser = decoded;
        next();
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          next(createError('UnauthorizedError', 'Invalid token'));
        } else {
          next(createError('UnknownError', error.message));
        }
      }
  }
}

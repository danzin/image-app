import { Request, Response, NextFunction } from 'express';
import { behaviourLogger, detailedRequestLogger } from '../utils/winston'; // Adjust path accordingly
declare module 'express-serve-static-core' {
  interface Request {
    _startTime: number;
  }
}

// Middleware for logging behavior
export const logBehaviour = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url } = req;
  
  behaviourLogger.info(`Request started: ${method} ${url}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    behaviourLogger.info(`Request completed: ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms`);
  });

  next(); 
};

export const detailedRequestLogging = (req: Request, res: Response, next: NextFunction) => {
  // Prepare the log object with all interesting attributes
  const logObject = {
    method: req.method,
    url: req.url,
    params: req.params,
    query: req.query,
    body: req.body, // Be careful with sensitive data here
    headers: req.headers,
    decodedUser: req?.decodedUser || {}, 
    ip: req.ip,
    timestamp: new Date().toISOString()
  };

  // Log the request details
  detailedRequestLogger.info('Detailed Request Log', logObject);

  // We can also log when the response is sent if needed
  res.on('finish', () => {
    detailedRequestLogger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      responseTime: Date.now() - req._startTime 
    });
  });

  next();
};
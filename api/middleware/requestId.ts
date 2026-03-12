import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existingId = req.headers['x-request-id'] as string | undefined;
  req.requestId = existingId || randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

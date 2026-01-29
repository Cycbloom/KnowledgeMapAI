import { type Request, type Response, type NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);

  // Default error format
  const status = err.status || 500;
  const message = err.message || '内部服务器错误';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

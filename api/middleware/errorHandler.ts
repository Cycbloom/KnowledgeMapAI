import { type Request, type Response, type NextFunction } from 'express';
import { ErrorCodes } from '../constants/errorCodes.js';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: string;

  constructor(message: string, statusCode: number, code: string = ErrorCodes.INTERNAL_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log the error for debugging
  console.error('Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    user: (req as any).user?.id
  });

  // Handle specific Supabase/Postgres errors
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      success: false,
      code: ErrorCodes.DUPLICATE_ENTRY,
      error: 'Duplicate entry found'
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      code: ErrorCodes.FOREIGN_KEY_VIOLATION,
      error: 'Referenced record not found'
    });
  }

  // Handle AppError (operational errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message
    });
  }

  // Handle SyntaxError (e.g., bad JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      code: ErrorCodes.INVALID_JSON,
      error: 'Invalid JSON payload'
    });
  }

  // Default error format
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal Server Error'
    : err.message || '内部服务器错误';
  
  res.status(status).json({
    success: false,
    code: ErrorCodes.INTERNAL_ERROR,
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

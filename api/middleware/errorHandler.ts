import { type Request, type Response, type NextFunction } from 'express';
import { ErrorCodes } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';

const SENSITIVE_FIELDS = [
  'password',
  'password_confirmation',
  'current_password',
  'new_password',
  'token',
  'refreshToken',
  'refresh_token',
  'access_token',
  'accessToken',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'authorization',
  'credential',
  'credentials',
  'privateKey',
  'private_key',
];

const sanitizeValue = (value: unknown, depth: number = 0): unknown => {
  if (depth > 5) return '[MAX_DEPTH]';
  
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > 1000) {
      return value.substring(0, 100) + '...[TRUNCATED]';
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val, depth + 1);
      }
    }
    return sanitized;
  }

  return '[UNKNOWN_TYPE]';
};

const sanitizeBody = (body: unknown): unknown => {
  if (!body || typeof body !== 'object') {
    return body;
  }
  return sanitizeValue(body);
};

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
  const sanitizedBody = sanitizeBody(req.body);
  
  logger.error('Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: sanitizedBody,
    user: (req as any).user?.id
  });

  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      code: ErrorCodes.DUPLICATE_ENTRY,
      error: 'Duplicate entry found'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      code: ErrorCodes.FOREIGN_KEY_VIOLATION,
      error: 'Referenced record not found'
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message
    });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      code: ErrorCodes.INVALID_JSON,
      error: 'Invalid JSON payload'
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal Server Error'
    : err.message || '内部服务器错误';
  
  return res.status(status).json({
    success: false,
    code: ErrorCodes.INTERNAL_ERROR,
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

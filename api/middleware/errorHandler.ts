import { type Request, type Response, type NextFunction } from 'express';
import { ErrorCodes, type ErrorCode, ErrorCodeMessages, ErrorCodeStatus } from '../../shared/types/errorCodes.js';
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

export interface AppErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  [key: string]: unknown;
}

export interface AppErrorContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface AppErrorOptions {
  message?: string;
  statusCode?: number;
  details?: AppErrorDetails;
  context?: AppErrorContext;
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: ErrorCode;
  context: AppErrorContext;
  timestamp: Date;
  details?: AppErrorDetails;

  constructor(code: ErrorCode, options?: AppErrorOptions);
  constructor(message: string, statusCode: number, code?: ErrorCode);
  constructor(codeOrMessage: ErrorCode | string, optionsOrStatusCode?: AppErrorOptions | number, code?: ErrorCode) {
    let message: string;
    let statusCode: number;
    let errorCode: ErrorCode;
    let details: AppErrorDetails | undefined;
    let context: AppErrorContext | undefined;

    if (typeof optionsOrStatusCode === 'number') {
      message = codeOrMessage as string;
      statusCode = optionsOrStatusCode;
      errorCode = code ?? ErrorCodes.SYSTEM_INTERNAL_ERROR;
    } else {
      errorCode = codeOrMessage as ErrorCode;
      message = optionsOrStatusCode?.message ?? ErrorCodeMessages[errorCode] ?? '未知错误';
      statusCode = optionsOrStatusCode?.statusCode ?? ErrorCodeStatus[errorCode] ?? 500;
      details = optionsOrStatusCode?.details;
      context = optionsOrStatusCode?.context;
    }
    
    super(message);
    
    this.code = errorCode;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.timestamp = new Date();
    this.context = context ?? {};
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static fromCode(code: ErrorCode, context?: AppErrorContext, details?: AppErrorDetails): AppError {
    return new AppError(code, { context, details });
  }

  addContext(key: string, value: unknown): this {
    this.context[key] = value;
    return this;
  }

  setDetails(details: AppErrorDetails): this {
    this.details = details;
    return this;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(Object.keys(this.context).length > 0 && { context: this.context }),
      ...(this.details && { details: this.details }),
    };
  }
}

export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  details?: unknown;
  stack?: string;
}

const buildErrorResponse = (
  req: Request,
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: unknown
): { response: ErrorResponse; status: number } => {
  const requestId = req.requestId || 'unknown';
  const timestamp = new Date().toISOString();
  
  const response: ErrorResponse = {
    success: false,
    code,
    message,
    requestId,
    timestamp,
  };

  if (details) {
    response.details = details;
  }

  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    response.stack = new Error().stack;
  }

  return { response, status: statusCode };
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.requestId || 'unknown';
  const userId = (req as any).user?.id;
  const sanitizedBody = sanitizeBody(req.body);
  
  logger.errorWithRequest('Error occurred', err, {
    requestId,
    userId,
    path: req.originalUrl,
    method: req.method,
  }, {
    code: err.code,
    statusCode: err.statusCode || err.status || 500,
    body: sanitizedBody,
  });

  if (err.code === '23505') {
    const { response, status } = buildErrorResponse(
      req,
      ErrorCodes.DATABASE_DUPLICATE_ENTRY,
      ErrorCodeMessages.DATABASE_DUPLICATE_ENTRY,
      409
    );
    return res.status(status).json(response);
  }

  if (err.code === '23503') {
    const { response, status } = buildErrorResponse(
      req,
      ErrorCodes.DATABASE_FOREIGN_KEY_VIOLATION,
      ErrorCodeMessages.DATABASE_FOREIGN_KEY_VIOLATION,
      400
    );
    return res.status(status).json(response);
  }

  if (err instanceof AppError) {
    const { response, status } = buildErrorResponse(
      req,
      err.code,
      err.message,
      err.statusCode,
      err.details
    );
    return res.status(status).json(response);
  }

  if (err instanceof SyntaxError && 'body' in err) {
    const { response, status } = buildErrorResponse(
      req,
      ErrorCodes.VALIDATION_INVALID_JSON,
      ErrorCodeMessages.VALIDATION_INVALID_JSON,
      400
    );
    return res.status(status).json(response);
  }

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal Server Error'
    : err.message || '内部服务器错误';
  
  const { response, status: responseStatus } = buildErrorResponse(
    req,
    ErrorCodes.SYSTEM_INTERNAL_ERROR,
    message,
    status
  );

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  return res.status(responseStatus).json(response);
};

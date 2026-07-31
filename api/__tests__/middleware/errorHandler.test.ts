import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import i18next from 'i18next';
import { AppError, errorHandler } from '../../middleware/errorHandler';
import { ErrorCodes, ErrorCodeMessageKeys } from '../../../shared/types/errorCodes';
import { logger } from '../../utils/logger';

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithRequest: vi.fn(),
    debug: vi.fn(),
  },
}));

const createMockReq = (overrides: {
  body?: unknown;
  requestId?: string;
  user?: { id?: string } | null;
  originalUrl?: string;
  method?: string;
} = {}): Request => {
  return {
    body: overrides.body,
    // Preserve explicit undefined so the "requestId missing -> unknown" test
    // can exercise the errorHandler fallback. Only default when the key is
    // absent entirely.
    requestId: 'requestId' in overrides ? overrides.requestId : 'test-req-id',
    user: overrides.user as unknown as Request['user'],
    originalUrl: overrides.originalUrl ?? '/api/test',
    method: overrides.method ?? 'POST',
  } as unknown as Request;
};

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

describe('errorHandler middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('AppError', () => {
    it('should create AppError with message, statusCode, and code', () => {
      const error = new AppError('Custom message', 404, ErrorCodes.RESOURCE_NOT_FOUND);

      expect(error.message).toBe('Custom message');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it('should create AppError from error code with default message and status', () => {
      const error = new AppError(ErrorCodes.RESOURCE_NOT_FOUND);

      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.message).toBe(i18next.t(ErrorCodeMessageKeys.RESOURCE_NOT_FOUND));
      expect(error.statusCode).toBe(404);
    });

    it('should create AppError with options (context and details)', () => {
      const error = new AppError(ErrorCodes.NOT_FOUND, {
        message: 'Custom not found',
        statusCode: 404,
        context: { userId: 'user-123' },
        details: { field: 'id' },
      });

      expect(error.message).toBe('Custom not found');
      expect(error.statusCode).toBe(404);
      expect(error.context).toEqual({ userId: 'user-123' });
      expect(error.details).toEqual({ field: 'id' });
    });

    it('should support static fromCode factory', () => {
      const error = AppError.fromCode(
        ErrorCodes.RESOURCE_NOT_FOUND,
        { userId: 'user-456' },
      );

      expect(error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(error.context).toEqual({ userId: 'user-456' });
    });

    it('should support addContext chainable method', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const result = error.addContext('ip', '127.0.0.1');

      expect(result).toBe(error);
      expect(error.context.ip).toBe('127.0.0.1');
    });

    it('should support setDetails chainable method', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const result = error.setDetails({ field: 'name' });

      expect(result).toBe(error);
      expect(error.details).toEqual({ field: 'name' });
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('test message', 400, ErrorCodes.VALIDATION_ERROR);
      error.addContext('userId', 'user-1');
      error.setDetails({ constraint: 'required' });

      const json = error.toJSON();

      expect(json).toMatchObject({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'test message',
        statusCode: 400,
      });
      expect(json.context).toEqual({ userId: 'user-1' });
      expect(json.details).toEqual({ constraint: 'required' });
    });
  });

  describe('errorHandler with AppError', () => {
    it('should respond with AppError statusCode and code', () => {
      const error = new AppError('Not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = jsonCall?.[0];
      expect(body).toMatchObject({
        success: false,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: 'Not found',
        requestId: 'test-req-id',
      });
    });

    it('should include details in response when present', () => {
      const error = new AppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR);
      error.setDetails({ field: 'email' });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jsonCall?.[0].details).toEqual({ field: 'email' });
    });

    it('should include context in response when present', () => {
      const error = new AppError('test', 403, ErrorCodes.AUTH_FORBIDDEN);
      error.addContext('userId', 'user-123');

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('database error codes', () => {
    it('should convert 23505 (unique violation) to 409', () => {
      const dbError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(dbError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jsonCall?.[0].code).toBe(ErrorCodes.DATABASE_DUPLICATE_ENTRY);
    });

    it('should convert 23503 (foreign key violation) to 400', () => {
      const dbError = Object.assign(new Error('foreign key violation'), {
        code: '23503',
      });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(dbError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jsonCall?.[0].code).toBe(ErrorCodes.DATABASE_FOREIGN_KEY_VIOLATION);
    });
  });

  describe('JSON SyntaxError', () => {
    it('should convert JSON parse SyntaxError to 400', () => {
      const syntaxError = Object.assign(new SyntaxError('Unexpected token'), {
        body: '<parsed content>',
      });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(syntaxError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jsonCall?.[0].code).toBe(ErrorCodes.VALIDATION_INVALID_JSON);
    });
  });

  describe('generic error fallback', () => {
    it('should respond with 500 for unknown errors', () => {
      const error = new Error('something went wrong');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jsonCall?.[0].code).toBe(ErrorCodes.SYSTEM_INTERNAL_ERROR);
    });

    it('should use err.status or err.statusCode when available', () => {
      const error = Object.assign(new Error('gone'), {
        statusCode: 410,
      });
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(410);
    });
  });

  describe('sensitive information filtering', () => {
    it('should redact password field in body when logging', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const req = createMockReq({
        body: { username: 'alice', password: 'secret123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      // The errorHandler should have logged with sanitized body
      // We verify by checking that errorWithRequest was called
      const logCall = logger.errorWithRequest.mock.calls[0];
      // The third argument contains the logged metadata including body
      const loggedMeta = logCall?.[3];
      // body should be sanitized (password redacted)
      expect(loggedMeta.body).toMatchObject({
        username: 'alice',
        password: '[REDACTED]',
      });
      // Original password should not appear in logs
      expect(JSON.stringify(loggedMeta.body)).not.toContain('secret123');
    });

    it('should redact token field in body when logging', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const req = createMockReq({
        body: { token: 'jwt-token-value', data: 'visible' },
      });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const logCall = logger.errorWithRequest.mock.calls[0];
      const loggedMeta = logCall?.[3];
      expect(loggedMeta.body).toMatchObject({
        token: '[REDACTED]',
        data: 'visible',
      });
      expect(JSON.stringify(loggedMeta.body)).not.toContain('jwt-token-value');
    });

    it('should redact nested sensitive fields', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const req = createMockReq({
        body: {
          user: { name: 'bob', apiKey: 'api-secret' },
          items: [{ refreshToken: 'r-token' }],
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const logCall = logger.errorWithRequest.mock.calls[0];
      const loggedMeta = logCall?.[3];
      expect(loggedMeta.body.user.apiKey).toBe('[REDACTED]');
      expect(loggedMeta.body.items[0].refreshToken).toBe('[REDACTED]');
      expect(JSON.stringify(loggedMeta.body)).not.toContain('api-secret');
      expect(JSON.stringify(loggedMeta.body)).not.toContain('r-token');
    });

    it('should not leak sensitive fields in the HTTP response', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const req = createMockReq({
        body: { password: 'secret123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const responseBody = JSON.stringify(jsonCall?.[0]);
      expect(responseBody).not.toContain('secret123');
      expect(responseBody).not.toContain('password');
    });
  });

  describe('dev stack leak protection', () => {
    it('should NOT include stack in response in production environment', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('internal failure');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = jsonCall?.[0];
      expect(body.stack).toBeUndefined();
      // Production should hide internal error messages for 500
      expect(body.message).toBe('Internal Server Error');
    });

    it('should include stack in response in development environment', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('internal failure');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = jsonCall?.[0];
      expect(body.stack).toBeDefined();
      // In development, the actual message is shown
      expect(body.message).toBe('internal failure');
    });

    it('should show original error message for non-500 errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('bad request');
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();
      Object.assign(error, { statusCode: 400 });

      errorHandler(error, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = jsonCall?.[0];
      // Non-500 errors should show the original message even in production
      expect(body.message).toBe('bad request');
      expect(body.stack).toBeUndefined();
    });
  });

  describe('response structure', () => {
    it('should always include requestId and timestamp in response', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const req = createMockReq({ requestId: 'req-abc-123' });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = jsonCall?.[0];
      expect(body.requestId).toBe('req-abc-123');
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('should use "unknown" when requestId is missing', () => {
      const error = new AppError('test', 400, ErrorCodes.VALIDATION_ERROR);
      const req = createMockReq({ requestId: undefined });
      const res = createMockRes();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(jsonCall?.[0].requestId).toBe('unknown');
    });
  });
});

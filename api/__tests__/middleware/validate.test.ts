import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { validate } from '../../middleware/validate';
import { ErrorCodes } from '../../../shared/types/errorCodes';

const createMockReq = (overrides: {
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
} = {}): Request => {
  return {
    body: overrides.body ?? {},
    query: overrides.query ?? {},
    params: overrides.params ?? {},
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

describe('validate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('body validation (enhanced mode)', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
    });

    it('should call next() when body is valid', () => {
      const middleware = validate({ body: bodySchema });
      const req = createMockReq({
        body: { name: 'Alice', age: 25 },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Alice', age: 25 });
    });

    it('should return 400 when body is invalid', () => {
      const middleware = validate({ body: bodySchema });
      const req = createMockReq({
        body: { name: '', age: -1 },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: ErrorCodes.VALIDATION_ERROR,
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should include field-level error details in response', () => {
      const middleware = validate({ body: bodySchema });
      const req = createMockReq({
        body: { name: 123, age: 'not-a-number' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const responseBody = jsonCall?.[0];
      expect(responseBody.details).toBeInstanceOf(Array);
      expect(responseBody.details.length).toBeGreaterThan(0);
      expect(responseBody.details[0]).toHaveProperty('field');
      expect(responseBody.details[0]).toHaveProperty('message');
    });

    it('should return 400 when required fields are missing', () => {
      const middleware = validate({ body: bodySchema });
      const req = createMockReq({
        body: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const responseBody = jsonCall?.[0];
      // Both name and age should be missing
      expect(responseBody.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('query validation', () => {
    const querySchema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.enum(['asc', 'desc']).optional(),
    });

    it('should call next() when query is valid', () => {
      const middleware = validate({ query: querySchema });
      const req = createMockReq({
        query: { page: '1', limit: '10', sort: 'asc' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should return 400 when query has invalid enum value', () => {
      const middleware = validate({ query: querySchema });
      const req = createMockReq({
        query: { sort: 'invalid' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const responseBody = jsonCall?.[0];
      expect(responseBody.details.some(
        (d: { field: string }) => d.field === 'sort',
      )).toBe(true);
    });
  });

  describe('params validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    it('should call next() when params are valid', () => {
      const middleware = validate({ params: paramsSchema });
      const req = createMockReq({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should return 400 when params id is not a UUID', () => {
      const middleware = validate({ params: paramsSchema });
      const req = createMockReq({
        params: { id: 'not-a-uuid' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const responseBody = jsonCall?.[0];
      expect(responseBody.details.some(
        (d: { field: string }) => d.field === 'id',
      )).toBe(true);
    });
  });

  describe('combined validation (body + query + params)', () => {
    const schemas = {
      body: z.object({ content: z.string().min(1) }),
      query: z.object({ verbose: z.enum(['true', 'false']).optional() }),
      params: z.object({ id: z.string().min(1) }),
    };

    it('should call next() when all parts are valid', () => {
      const middleware = validate(schemas);
      const req = createMockReq({
        body: { content: 'hello' },
        query: { verbose: 'true' },
        params: { id: 'abc' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ content: 'hello' });
    });

    it('should return 400 when body is invalid but params are valid', () => {
      const middleware = validate(schemas);
      const req = createMockReq({
        body: { content: '' },
        query: {},
        params: { id: 'abc' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('legacy mode (single ZodSchema)', () => {
    const bodySchema: ZodSchema = z.object({
      title: z.string().min(1),
    });

    it('should validate body when given a single ZodSchema', () => {
      const middleware = validate(bodySchema);
      const req = createMockReq({
        body: { title: 'My Graph' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ title: 'My Graph' });
    });

    it('should return 400 for invalid body in legacy mode', () => {
      const middleware = validate(bodySchema);
      const req = createMockReq({
        body: { title: '' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('error response format', () => {
    it('should have consistent error response structure', () => {
      const middleware = validate({
        body: z.object({ email: z.string().email() }),
      });
      const req = createMockReq({
        body: { email: 'not-an-email' },
      });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const responseBody = jsonCall?.[0];
      expect(responseBody).toMatchObject({
        success: false,
        code: ErrorCodes.VALIDATION_ERROR,
        error: '输入验证失败',
        details: expect.any(Array),
      });
    });
  });

  describe('non-ZodError handling', () => {
    it('should call next(error) for non-ZodError exceptions', () => {
      // Create a schema that throws during parse (not a ZodError)
      const throwingSchema = {
        parse: () => {
          throw new Error('unexpected error');
        },
      } as unknown as ZodSchema;

      const middleware = validate({ body: throwingSchema });
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

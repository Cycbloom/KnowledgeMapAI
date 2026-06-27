import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { csrfProtection, getCsrfToken } from '../../middleware/csrf';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

interface MockRequest {
  headers: Record<string, string | undefined>;
  method?: string;
  path?: string;
  hostname?: string;
  cookies?: Record<string, string>;
}

const createMockReq = (overrides: MockRequest = {}): Request => {
  return {
    headers: overrides.headers ?? {},
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/',
    // Default to a non-localhost hostname so CSRF validation logic is actually
    // exercised. The localhost-skip behavior is tested explicitly with
    // hostname: 'localhost' in its own describe block below.
    hostname: overrides.hostname ?? 'api.example.com',
    cookies: overrides.cookies ?? {},
  } as unknown as Request;
};

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn(),
    locals: {} as Record<string, unknown>,
  };
  return res as unknown as Response;
};

const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

describe('csrf middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to test environment (non-production) for most tests
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('token validation (POST requests)', () => {
    it('should call next() when token is valid', () => {
      const token = 'a'.repeat(64); // 64-char hex token
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER]: token },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next with 403 error when token is invalid', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: { [CSRF_COOKIE_NAME]: 'a'.repeat(64) },
        headers: { [CSRF_HEADER]: 'b'.repeat(64) },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0]?.[0];
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).code).toBe(ErrorCodes.AUTH_FORBIDDEN);
    });

    it('should call next with 403 error when token lengths differ', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: { [CSRF_COOKIE_NAME]: 'short-token' },
        headers: { [CSRF_HEADER]: 'a-much-longer-token-value' },
      });
      const res = createMockRes();
      const next = createMockNext();

      // Should NOT throw (timingSafeEqual would throw on different lengths)
      expect(() => csrfProtection(req, res, next)).not.toThrow();

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0]?.[0];
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    });

    it('should call next with 403 error when cookie token is missing', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: {},
        headers: { [CSRF_HEADER]: 'some-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      const error = next.mock.calls[0]?.[0];
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    });

    it('should call next with 403 error when header token is missing', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: { [CSRF_COOKIE_NAME]: 'some-token' },
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      const error = next.mock.calls[0]?.[0];
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    });
  });

  describe('GET requests (token generation)', () => {
    it('should set csrf cookie and call next() on GET when no cookie exists', () => {
      const req = createMockReq({
        method: 'GET',
        path: '/api/graphs',
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({ path: '/' }),
      );
      expect(res.locals.csrfToken).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should reuse existing cookie token on GET', () => {
      const existingToken = 'existing-token-value';
      const req = createMockReq({
        method: 'GET',
        path: '/api/graphs',
        cookies: { [CSRF_COOKIE_NAME]: existingToken },
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.locals.csrfToken).toBe(existingToken);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() on HEAD requests without setting cookie', () => {
      const req = createMockReq({
        method: 'HEAD',
        path: '/api/graphs',
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() on OPTIONS requests', () => {
      const req = createMockReq({
        method: 'OPTIONS',
        path: '/api/graphs',
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('skip routes (whitelist)', () => {
    const skipRoutes = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/health',
      '/api/health/system',
      '/api/analytics',
      '/api/system-monitor',
    ];

    skipRoutes.forEach((route) => {
      it(`should skip CSRF for ${route} on POST`, () => {
        const req = createMockReq({
          method: 'POST',
          path: route,
          cookies: {},
          headers: {},
        });
        const res = createMockRes();
        const next = createMockNext();

        csrfProtection(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    it('should skip CSRF for sub-paths of whitelisted routes', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/auth/login/sub-path',
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('client type skip', () => {
    it('should skip CSRF when x-mobile-client header is true', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: {},
        headers: { 'x-mobile-client': 'true' },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should skip CSRF when x-electron-client header is true', () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        cookies: {},
        headers: { 'x-electron-client': 'true' },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('localhost skip behavior', () => {
    it('should skip CSRF for localhost in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        hostname: 'localhost',
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should skip CSRF for 127.0.0.1 in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        hostname: '127.0.0.1',
        cookies: {},
        headers: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should NOT skip CSRF for localhost in production environment', () => {
      process.env.NODE_ENV = 'production';
      const token = 'c'.repeat(64);
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        hostname: 'localhost',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER]: token },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      // Should validate token (not skip) in production
      expect(next).toHaveBeenCalledWith();
    });

    it('should require valid token for localhost in production (invalid token returns 403)', () => {
      process.env.NODE_ENV = 'production';
      const req = createMockReq({
        method: 'POST',
        path: '/api/graphs',
        hostname: 'localhost',
        cookies: { [CSRF_COOKIE_NAME]: 'a'.repeat(64) },
        headers: { [CSRF_HEADER]: 'b'.repeat(64) },
      });
      const res = createMockRes();
      const next = createMockNext();

      csrfProtection(req, res, next);

      const error = next.mock.calls[0]?.[0];
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
    });
  });

  describe('getCsrfToken', () => {
    it('should return existing token from res.locals when present', () => {
      const existingToken = 'local-token';
      const req = createMockReq({ cookies: {} });
      const res = createMockRes();
      res.locals.csrfToken = existingToken;

      getCsrfToken(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        existingToken,
        expect.any(Object),
      );
      expect(res.json).toHaveBeenCalledWith({ csrfToken: existingToken });
    });

    it('should return existing token from cookie when present', () => {
      const cookieToken = 'cookie-token-value';
      const req = createMockReq({
        cookies: { [CSRF_COOKIE_NAME]: cookieToken },
      });
      const res = createMockRes();

      getCsrfToken(req, res);

      expect(res.json).toHaveBeenCalledWith({ csrfToken: cookieToken });
    });

    it('should generate new token when none exists', () => {
      const req = createMockReq({ cookies: {} });
      const res = createMockRes();

      getCsrfToken(req, res);

      expect(res.cookie).toHaveBeenCalled();
      const cookieArgs = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(cookieArgs?.[1]).toEqual(expect.any(String));
      expect(res.json).toHaveBeenCalledWith({
        csrfToken: expect.any(String),
      });
    });
  });
});

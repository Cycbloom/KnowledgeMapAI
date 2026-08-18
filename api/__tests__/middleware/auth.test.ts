import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Response, type NextFunction } from 'express';
import { requireAuth, optionalAuth, requireAdmin, type AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

// Mock supabase module
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockAnonClient = { id: 'anon-client' };
const mockTokenClient = { id: 'token-client' };

vi.mock('../../supabase', () => ({
  getSupabaseAdmin: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
  getSupabaseAnon: () => mockAnonClient,
  createClientWithToken: () => mockTokenClient,
}));

// Mock cacheService to prevent cache pollution across tests.
// vi.hoisted ensures the mock fns are initialized before the hoisted vi.mock
// factory runs (the factory accesses them eagerly, unlike the supabase mock
// above which wraps variable access in lazily-called functions).
const { mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn().mockResolvedValue(undefined),
  mockCacheSet: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/common/cacheService', () => ({
  cacheService: {
    get: mockCacheGet,
    set: mockCacheSet,
  },
}));

interface MockRequest {
  headers: Record<string, string | undefined>;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  ip?: string;
  connection?: { remoteAddress?: string };
  hostname?: string;
  path?: string;
  method?: string;
  cookies?: Record<string, string>;
  originalUrl?: string;
  requestId?: string;
  user?: unknown;
  supabase?: unknown;
}

const createMockReq = (overrides: MockRequest = {}): AuthRequest => {
  const req = {
    headers: overrides.headers ?? {},
    body: overrides.body,
    query: overrides.query,
    params: overrides.params,
    ip: overrides.ip,
    connection: overrides.connection ?? { remoteAddress: '127.0.0.1' },
    hostname: overrides.hostname ?? 'localhost',
    path: overrides.path ?? '/',
    method: overrides.method ?? 'GET',
    cookies: overrides.cookies,
    originalUrl: overrides.originalUrl ?? '/',
    requestId: overrides.requestId ?? 'test-request-id',
  } as unknown as AuthRequest;
  return req;
};

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    cookie: vi.fn(),
    locals: {},
    statusCode: 200,
    on: vi.fn(),
  };
  return res as unknown as Response;
};

const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should throw 401 when authorization header is missing', async () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAuth(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_HEADER_MISSING,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw 401 when authorization header format is invalid (no Bearer)', async () => {
      const req = createMockReq({
        headers: { authorization: 'Basic abc123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAuth(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw 401 when token is missing after Bearer', async () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer ' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAuth(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_MISSING,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw 401 when token is invalid (supabase returns error)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid token' },
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAuth(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_INVALID,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw 401 when token is expired', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'token has expired' },
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer expired-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAuth(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_EXPIRED,
      });
    });

    it('should throw 401 when supabase returns no user and no error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer some-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAuth(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_INVALID,
      });
    });

    it('should set req.user and call next() when token is valid', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(req.supabase).toBe(mockTokenClient);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should accept lowercase bearer prefix', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockReq({
        headers: { authorization: 'bearer valid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('optionalAuth', () => {
    it('should call next() with req.user undefined when no authorization header', async () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(req.supabase).toBe(mockAnonClient);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next() with req.user undefined when header format is invalid', async () => {
      const req = createMockReq({
        headers: { authorization: 'Basic abc123' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(req.supabase).toBe(mockAnonClient);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should set req.user when token is valid', async () => {
      const mockUser = { id: 'user-456', email: 'valid@example.com' };
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(req.supabase).toBe(mockTokenClient);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next() with req.user undefined when token is invalid (error returned)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid token' },
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(req.supabase).toBe(mockAnonClient);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next() with req.user undefined when supabase throws', async () => {
      mockGetUser.mockRejectedValue(new Error('network error'));

      const req = createMockReq({
        headers: { authorization: 'Bearer some-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(req.supabase).toBe(mockAnonClient);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireAdmin', () => {
    const setupAdminChain = (role: string) => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'admin@example.com' } },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role },
          error: null,
        }),
      });
    };

    it('should call next() when user is admin (role-based)', async () => {
      setupAdminChain('admin');

      const req = createMockReq({
        headers: { authorization: 'Bearer admin-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next() when user email is in ADMIN_EMAILS list', async () => {
      const originalAdminEmails = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = 'superadmin@example.com';

      // ADMIN_EMAILS Set 在模块加载期构建，设置 env 后需重新加载模块才能生效。
      // vi.resetModules 不影响已注册的 vi.mock 工厂（仍引用同一批闭包 mock fn）。
      vi.resetModules();
      const { requireAdmin: freshRequireAdmin } = await import('../../middleware/auth');

      setupAdminChain('user');

      const req = createMockReq({
        headers: { authorization: 'Bearer admin-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      // Override mock to return non-admin user with admin email
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'superadmin@example.com' } },
        error: null,
      });

      await freshRequireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);

      process.env.ADMIN_EMAILS = originalAdminEmails;
      vi.resetModules();
    });

    it('should not call next when user is not admin (throws in callback)', async () => {
      setupAdminChain('user');

      const req = createMockReq({
        headers: { authorization: 'Bearer user-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      // requireAdmin delegates to requireAuth with a callback that throws on
      // non-admin users. The throw happens inside the async callback, so we
      // capture unhandled rejections and verify next() was NOT called.
      const rejections: unknown[] = [];
      const handler = (reason: unknown) => rejections.push(reason);
      process.on('unhandledRejection', handler);

      await requireAdmin(req, res, next);
      // Allow microtask queue to flush
      await new Promise((resolve) => setImmediate(resolve));

      process.removeListener('unhandledRejection', handler);

      // The outer next() should NOT be called (admin check failed)
      expect(next).not.toHaveBeenCalled();
      // An AppError with 403 should have been thrown (as unhandled rejection)
      const adminError = rejections.find(
        (r): r is AppError => r instanceof AppError && r.statusCode === 403,
      );
      expect(adminError).toBeDefined();
      expect(adminError?.code).toBe(ErrorCodes.AUTH_FORBIDDEN);
    });

    it('should not call next when DB query returns error (throws in callback)', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB connection failed' },
        }),
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer some-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const rejections: unknown[] = [];
      const handler = (reason: unknown) => rejections.push(reason);
      process.on('unhandledRejection', handler);

      await requireAdmin(req, res, next);
      await new Promise((resolve) => setImmediate(resolve));

      process.removeListener('unhandledRejection', handler);

      expect(next).not.toHaveBeenCalled();
      const dbError = rejections.find(
        (r): r is AppError => r instanceof AppError && r.statusCode === 500,
      );
      expect(dbError).toBeDefined();
      expect(dbError?.code).toBe(ErrorCodes.SYSTEM_INTERNAL_ERROR);
    });

    it('should throw 401 when auth token is missing', async () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      await expect(requireAdmin(req, res, next)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('AppError integration', () => {
    it('thrown errors should be AppError instances', async () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      const next = createMockNext();

      try {
        await requireAuth(req, res, next);
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });
  });
});

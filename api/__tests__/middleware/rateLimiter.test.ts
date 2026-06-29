import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { createRateLimiter, destroyRateLimiter } from '../../middleware/rateLimiter';

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

interface MockRequest {
  headers?: Record<string, string | undefined>;
  body?: unknown;
  ip?: string;
  connection?: { remoteAddress?: string };
  user?: { id?: string } | undefined;
  method?: string;
}

const createMockReq = (overrides: MockRequest = {}): Request => {
  return {
    headers: overrides.headers ?? {},
    body: overrides.body,
    ip: overrides.ip ?? '127.0.0.1',
    connection: overrides.connection ?? { remoteAddress: '127.0.0.1' },
    user: overrides.user as unknown as Request['user'],
    method: overrides.method ?? 'GET',
  } as unknown as Request;
};

const createMockRes = (): Response => {
  const headers: Record<string, string> = {};
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
    statusCode: 200,
    on: vi.fn(),
  };
  return res as unknown as Response;
};

const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

describe('rateLimiter middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDisableRateLimit = process.env.DISABLE_RATE_LIMIT;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    // Rate limiter is disabled when NODE_ENV === 'test', so override for tests
    process.env.NODE_ENV = 'development';
    process.env.DISABLE_RATE_LIMIT = 'false';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DISABLE_RATE_LIMIT = originalDisableRateLimit;
    vi.clearAllMocks();
  });

  afterAll(() => {
    destroyRateLimiter();
  });

  describe('rate limit counting', () => {
    it('should allow requests under the limit and call next()', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyPrefix: 'test-under-limit',
      });

      const req = createMockReq({ ip: '10.0.0.1' });
      const res = createMockRes();
      const next = createMockNext();

      await limiter(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
    });

    it('should return 429 when limit is exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'test-exceeded',
      });

      const req = createMockReq({ ip: '10.0.0.2' });
      const next = createMockNext();

      // First request - allowed
      const res1 = createMockRes();
      await limiter(req, res1, next);
      expect(next).toHaveBeenCalledWith();

      // Second request - allowed
      const res2 = createMockRes();
      await limiter(req, res2, next);
      expect(next).toHaveBeenCalledWith();

      // Third request - should be rate limited
      const res3 = createMockRes();
      await limiter(req, res3, next);

      expect(res3.status).toHaveBeenCalledWith(429);
      expect(res3.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          retryAfter: expect.any(Number),
        }),
      );
      expect(next).toHaveBeenCalledTimes(2); // Only first two called next()
    });

    it('should set X-RateLimit-Remaining to 0 when limit exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test-remaining-zero',
      });

      const req = createMockReq({ ip: '10.0.0.3' });

      // First request allowed
      await limiter(req, createMockRes(), createMockNext());

      // Second request rate limited
      const res2 = createMockRes();
      await limiter(req, res2, createMockNext());

      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });
  });

  describe('window expiration', () => {
    it('should reset counter after window expires', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000, // 1 second window
        maxRequests: 1,
        keyPrefix: 'test-window-expire',
      });

      const req = createMockReq({ ip: '10.0.0.4' });

      // First request allowed
      const res1 = createMockRes();
      const next1 = createMockNext();
      await limiter(req, res1, next1);
      expect(next1).toHaveBeenCalledWith();

      // Second request - rate limited
      const res2 = createMockRes();
      const next2 = createMockNext();
      await limiter(req, res2, next2);
      expect(res2.status).toHaveBeenCalledWith(429);

      // Advance time past the window
      vi.advanceTimersByTime(1500);

      // Third request - should be allowed again (counter reset)
      const res3 = createMockRes();
      const next3 = createMockNext();
      await limiter(req, res3, next3);
      expect(next3).toHaveBeenCalledWith();
      expect(res3.status).not.toHaveBeenCalledWith(429);
    });

    it('should not reset counter within the same window', async () => {
      const limiter = createRateLimiter({
        windowMs: 10000,
        maxRequests: 1,
        keyPrefix: 'test-same-window',
      });

      const req = createMockReq({ ip: '10.0.0.5' });

      // First request allowed
      await limiter(req, createMockRes(), createMockNext());

      // Advance time but stay within window
      vi.advanceTimersByTime(5000);

      // Second request - should still be rate limited
      const res2 = createMockRes();
      await limiter(req, res2, createMockNext());
      expect(res2.status).toHaveBeenCalledWith(429);
    });
  });

  describe('key isolation', () => {
    it('should isolate rate limits by IP when no user', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test-ip-isolation',
      });

      const req1 = createMockReq({ ip: '10.0.0.10' });
      const req2 = createMockReq({ ip: '10.0.0.11' });

      // First IP - allowed
      const res1 = createMockRes();
      await limiter(req1, res1, createMockNext());
      expect(res1.status).not.toHaveBeenCalledWith(429);

      // Second IP - should also be allowed (different key)
      const res2 = createMockRes();
      await limiter(req2, res2, createMockNext());
      expect(res2.status).not.toHaveBeenCalledWith(429);

      // First IP again - should be rate limited
      const res3 = createMockRes();
      await limiter(req1, res3, createMockNext());
      expect(res3.status).toHaveBeenCalledWith(429);
    });

    it('should isolate rate limits by user ID when user is present', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test-user-isolation',
      });

      const req1 = createMockReq({
        ip: '10.0.0.20',
        user: { id: 'user-1' },
      });
      const req2 = createMockReq({
        ip: '10.0.0.20', // Same IP
        user: { id: 'user-2' }, // Different user
      });

      // user-1 - allowed
      await limiter(req1, createMockRes(), createMockNext());

      // user-2 (same IP) - should be allowed (different key by user)
      const res2 = createMockRes();
      await limiter(req2, res2, createMockNext());
      expect(res2.status).not.toHaveBeenCalledWith(429);

      // user-1 again - should be rate limited
      const res3 = createMockRes();
      await limiter(req1, res3, createMockNext());
      expect(res3.status).toHaveBeenCalledWith(429);
    });

    it('should isolate rate limits by different keyPrefix', async () => {
      const limiter1 = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'prefix-a',
      });
      const limiter2 = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'prefix-b',
      });

      const req = createMockReq({ ip: '10.0.0.30' });

      // limiter1 - allowed
      await limiter1(req, createMockRes(), createMockNext());

      // limiter2 (same IP) - should be allowed (different keyPrefix)
      const res2 = createMockRes();
      await limiter2(req, res2, createMockNext());
      expect(res2.status).not.toHaveBeenCalledWith(429);

      // limiter1 again - should be rate limited
      const res3 = createMockRes();
      await limiter1(req, res3, createMockNext());
      expect(res3.status).toHaveBeenCalledWith(429);
    });
  });

  describe('rate limit disabled', () => {
    it('should bypass rate limiting when NODE_ENV is test', async () => {
      process.env.NODE_ENV = 'test';

      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test-disabled-env',
      });

      const req = createMockReq({ ip: '10.0.0.40' });

      // Multiple requests should all pass
      await limiter(req, createMockRes(), createMockNext());
      await limiter(req, createMockRes(), createMockNext());
      const res3 = createMockRes();
      const next3 = createMockNext();
      await limiter(req, res3, next3);

      expect(next3).toHaveBeenCalledWith();
      expect(res3.status).not.toHaveBeenCalledWith(429);
    });

    it('should bypass rate limiting when DISABLE_RATE_LIMIT is true', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'test-disabled-flag',
      });

      const req = createMockReq({ ip: '10.0.0.41' });

      await limiter(req, createMockRes(), createMockNext());
      const res2 = createMockRes();
      const next2 = createMockNext();
      await limiter(req, res2, next2);

      expect(next2).toHaveBeenCalledWith();
      expect(res2.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('skipFailedRequests', () => {
    it('should decrement count when response status >= 400', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'test-skip-failed',
        skipFailedRequests: true,
      });

      const req = createMockReq({ ip: '10.0.0.50' });

      // First request - allowed, but will finish with error status
      const res1 = createMockRes();
      const next1 = createMockNext();
      await limiter(req, res1, next1);

      // Simulate the response finishing with error status
      // The middleware registers a 'finish' listener on res
      const finishCall = (res1.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === 'finish',
      );
      expect(finishCall).toBeDefined();
      res1.statusCode = 500;
      // Trigger the finish callback (decrement is async, but we don't need to
      // await here since the next increment happens after the await below)
      const finishCb = finishCall?.[1] as (() => void) | undefined;
      finishCb?.();
      // Allow the async decrement promise to flush
      await Promise.resolve();

      // Second request - should still be allowed (count was decremented)
      const res2 = createMockRes();
      const next2 = createMockNext();
      await limiter(req, res2, next2);

      expect(next2).toHaveBeenCalledWith();
      expect(res2.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('retryAfter header', () => {
    it('should calculate correct retryAfter based on remaining window time', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000, // 60 seconds
        maxRequests: 1,
        keyPrefix: 'test-retry-after',
      });

      const req = createMockReq({ ip: '10.0.0.60' });

      // First request allowed
      await limiter(req, createMockRes(), createMockNext());

      // Advance time by 10 seconds
      vi.advanceTimersByTime(10000);

      // Second request - rate limited, should report ~50 seconds retryAfter
      const res2 = createMockRes();
      await limiter(req, res2, createMockNext());

      expect(res2.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: expect.any(Number),
        }),
      );
      const jsonCall = (res2.json as ReturnType<typeof vi.fn>).mock.calls[0];
      const retryAfter = jsonCall?.[0]?.retryAfter;
      // Window was 60s, 10s elapsed, so ~50s remaining
      expect(retryAfter).toBeGreaterThanOrEqual(49);
      expect(retryAfter).toBeLessThanOrEqual(50);
    });
  });
});

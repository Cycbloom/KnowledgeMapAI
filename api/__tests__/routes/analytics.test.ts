import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../../supabase';
import {
  postErrorsHandler,
  getStatsHandler,
  getRecentErrorsHandler,
} from '../../routes/analytics';

// Mock logger to keep test output clean
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithRequest: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock supabase admin client
vi.mock('../../supabase', () => ({
  getSupabaseAdmin: vi.fn(),
}));

interface SupabaseMockOptions {
  insertError?: unknown;
  count?: number | null;
  countError?: unknown;
  recentData?: unknown[];
  recentError?: unknown;
}

const createSupabaseMock = (opts: SupabaseMockOptions = {}) => {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const limit = vi.fn().mockResolvedValue({
    data: opts.recentData ?? [],
    error: opts.recentError ?? null,
  });
  const order = vi.fn().mockReturnValue({ limit });
  const countSelect = vi.fn().mockResolvedValue({
    count: opts.count ?? 0,
    error: opts.countError ?? null,
  });
  const select = vi.fn((_cols: string, countOpts?: { count?: string }) => {
    if (countOpts?.count) {
      return countSelect();
    }
    return { order };
  });
  const from = vi.fn(() => ({ insert, select, order, limit }));

  return { admin: { from }, from, insert, select, countSelect, order, limit };
};

const createMockReq = (overrides: { body?: unknown; query?: Record<string, unknown> } = {}): Request =>
  ({
    body: overrides.body,
    query: overrides.query ?? {},
  }) as unknown as Request;

const createMockRes = (): Response & { json: ReturnType<typeof vi.fn> } =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response & { json: ReturnType<typeof vi.fn> };

const sampleErrors = [
  { message: 'boom', url: 'https://example.com', userId: 'u1' },
  { message: 'crash', stack: 'at x', userAgent: 'Mozilla' },
];

describe('analytics route — error report persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /errors', () => {
    it('persists valid error array and returns count', async () => {
      const mock = createSupabaseMock();
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await postErrorsHandler(createMockReq({ body: { errors: sampleErrors } }), res);

      expect(mock.from).toHaveBeenCalledWith('error_reports');
      expect(mock.insert).toHaveBeenCalledTimes(1);
      const rows = mock.insert.mock.calls[0][0];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ message: 'boom', url: 'https://example.com', user_id: 'u1' });
      expect(rows[1]).toMatchObject({ message: 'crash', user_agent: 'Mozilla' });
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 2 });
    });

    it('truncates over-long message, url and stack fields', async () => {
      const mock = createSupabaseMock();
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      const long = 'x'.repeat(2000);
      await postErrorsHandler(
        createMockReq({ body: { errors: [{ message: long, url: long }] } }),
        res,
      );

      const rows = mock.insert.mock.calls[0][0];
      expect(rows[0].message).toHaveLength(1000);
      expect(rows[0].url).toHaveLength(500);
    });

    it('maps metadata as an object', async () => {
      const mock = createSupabaseMock();
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await postErrorsHandler(
        createMockReq({ body: { errors: [{ message: 'x', metadata: { type: 'unhandledrejection' } }] } }),
        res,
      );

      const rows = mock.insert.mock.calls[0][0];
      expect(rows[0].metadata).toEqual({ type: 'unhandledrejection' });
    });

    it('rejects empty array with 400', async () => {
      const res = createMockRes();
      await expect(
        postErrorsHandler(createMockReq({ body: { errors: [] } }), res),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects non-array body with 400', async () => {
      const res = createMockRes();
      await expect(
        postErrorsHandler(createMockReq({ body: { errors: 'nope' } }), res),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects batch larger than 50 with 400', async () => {
      const res = createMockRes();
      const batch = Array.from({ length: 51 }, (_, i) => ({ message: `e${i}` }));
      await expect(
        postErrorsHandler(createMockReq({ body: { errors: batch } }), res),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 500 when database insert fails', async () => {
      const mock = createSupabaseMock({ insertError: { message: 'connection lost' } });
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await expect(
        postErrorsHandler(createMockReq({ body: { errors: sampleErrors } }), res),
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('GET /stats', () => {
    it('returns real error count', async () => {
      const mock = createSupabaseMock({ count: 42 });
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await getStatsHandler(createMockReq(), res);

      expect(mock.countSelect).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors: expect.objectContaining({ total: 42 }) }),
      );
    });

    it('throws 500 when counting fails', async () => {
      const mock = createSupabaseMock({ countError: { message: 'db down' } });
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await expect(getStatsHandler(createMockReq(), res)).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe('GET /errors/recent', () => {
    it('returns recent errors and count', async () => {
      const recentData = [{ id: '1', message: 'a' }, { id: '2', message: 'b' }];
      const mock = createSupabaseMock({ recentData });
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await getRecentErrorsHandler(createMockReq({ query: { limit: '5' } }), res);

      expect(mock.order).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mock.limit).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith({ errors: recentData, count: 2 });
    });

    it('clamps limit to allowed range', async () => {
      const mock = createSupabaseMock();
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      // 500 -> clamped to 100
      await getRecentErrorsHandler(createMockReq({ query: { limit: '500' } }), res);
      expect(mock.limit).toHaveBeenCalledWith(100);

      // invalid -> default 20
      await getRecentErrorsHandler(createMockReq({ query: { limit: 'abc' } }), res);
      expect(mock.limit).toHaveBeenCalledWith(20);
    });

    it('throws 500 when fetching fails', async () => {
      const mock = createSupabaseMock({ recentError: { message: 'boom' } });
      vi.mocked(getSupabaseAdmin).mockReturnValue(mock.admin as never);
      const res = createMockRes();

      await expect(
        getRecentErrorsHandler(createMockReq(), res),
      ).rejects.toMatchObject({ statusCode: 500 });
    });
  });
});
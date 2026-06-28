import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Response, type NextFunction } from 'express';
import {
  buildOwnershipMiddleware,
  requireGraphOwnership,
  requireTaskOwnership,
  requireQuizSetOwnership,
  requireTemplateOwnership,
  requireKnowledgePointOwnership,
} from '../../middleware/ownership';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { type AuthRequest } from '../../middleware/auth';

/**
 * 创建可链式调用的 supabase 查询 mock。
 *
 * 链路：from(table) → select(column) → eq('id', id) → single() → Promise<{ data, error }>
 */
interface SupabaseMock {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const createSupabaseMock = (
  singleResult: { data: unknown; error: unknown },
): SupabaseMock => {
  const chain: SupabaseMock = {
    from: vi.fn(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(singleResult),
  };
  chain.from.mockReturnValue(chain);
  return chain;
};

const createMockReq = (overrides: {
  params?: Record<string, string>;
  userId?: string;
  singleResult?: { data: unknown; error: unknown };
} = {}): { req: AuthRequest; supabaseMock: SupabaseMock } => {
  const supabaseMock = createSupabaseMock(
    overrides.singleResult ?? { data: null, error: null },
  );
  const req = {
    params: overrides.params ?? {},
    user: { id: overrides.userId ?? 'user-123' },
    supabase: supabaseMock,
  } as unknown as AuthRequest;
  return { req, supabaseMock };
};

const createMockRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;

type OwnerColumn = 'user_id' | 'owner_id';

/**
 * 为指定 ownership 中间件运行通用测试套件。
 *
 * 覆盖：成功路径（所有者）、资源不存在（404）、非所有者（403）、缺少 id（400）。
 * 注意：401 未认证由 requireAuth 前置中间件处理，ownership 中间件假设 req.user 已存在。
 */
const runOwnershipTests = (
  middlewareName: string,
  middleware: ReturnType<typeof buildOwnershipMiddleware>,
  ownerColumn: OwnerColumn,
) => {
  describe(`${middlewareName}`, () => {
    it('成功路径：所有者访问自己的资源 → 调用 next()', async () => {
      const { req, supabaseMock } = createMockReq({
        params: { id: 'resource-123' },
        userId: 'user-123',
        singleResult: {
          data: { [ownerColumn]: 'user-123' },
          error: null,
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(supabaseMock.from).toHaveBeenCalledTimes(1);
      expect(supabaseMock.select).toHaveBeenCalledWith(ownerColumn);
      expect(supabaseMock.eq).toHaveBeenCalledWith('id', 'resource-123');
      expect(supabaseMock.single).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('拒绝路径 1：资源不存在（含 error）→ 404 RESOURCE_NOT_FOUND', async () => {
      const { req } = createMockReq({
        params: { id: 'resource-123' },
        singleResult: {
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(middleware(req, res, next)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('拒绝路径 1b：资源不存在（data 为 null 无 error）→ 404 RESOURCE_NOT_FOUND', async () => {
      const { req } = createMockReq({
        params: { id: 'resource-123' },
        singleResult: { data: null, error: null },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(middleware(req, res, next)).rejects.toMatchObject({
        statusCode: 404,
        code: ErrorCodes.RESOURCE_NOT_FOUND,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('拒绝路径 2：非所有者访问 → 403 AUTH_FORBIDDEN', async () => {
      const { req } = createMockReq({
        params: { id: 'resource-123' },
        userId: 'user-123',
        singleResult: {
          data: { [ownerColumn]: 'user-456' },
          error: null,
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(middleware(req, res, next)).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.AUTH_FORBIDDEN,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('拒绝路径 2b：所有者字段为 null → 403 AUTH_FORBIDDEN', async () => {
      const { req } = createMockReq({
        params: { id: 'resource-123' },
        userId: 'user-123',
        singleResult: {
          data: { [ownerColumn]: null },
          error: null,
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(middleware(req, res, next)).rejects.toMatchObject({
        statusCode: 403,
        code: ErrorCodes.AUTH_FORBIDDEN,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('参数校验：缺少 :id 参数 → 400 VALIDATION_ERROR', async () => {
      const { req } = createMockReq({
        params: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      await expect(middleware(req, res, next)).rejects.toMatchObject({
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('抛出的错误应为 AppError 实例', async () => {
      const { req } = createMockReq({
        params: { id: 'resource-123' },
        singleResult: { data: null, error: { code: 'PGRST116' } },
      });
      const res = createMockRes();
      const next = createMockNext();

      try {
        await middleware(req, res, next);
        expect.fail('应抛出 AppError');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });
  });
};

describe('ownership middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 4 个新增中间件 + 1 个重构中间件的通用测试
  runOwnershipTests('requireGraphOwnership', requireGraphOwnership, 'user_id');
  runOwnershipTests('requireTaskOwnership', requireTaskOwnership, 'user_id');
  runOwnershipTests(
    'requireQuizSetOwnership',
    requireQuizSetOwnership,
    'user_id',
  );
  runOwnershipTests(
    'requireTemplateOwnership',
    requireTemplateOwnership,
    'user_id',
  );
  runOwnershipTests(
    'requireKnowledgePointOwnership',
    requireKnowledgePointOwnership,
    'owner_id',
  );

  describe('表与列配置', () => {
    it('requireGraphOwnership 查询 knowledge_graphs 表的 user_id 列', async () => {
      const { req, supabaseMock } = createMockReq({
        params: { id: 'graph-123' },
        userId: 'user-123',
        singleResult: { data: { user_id: 'user-123' }, error: null },
      });
      await requireGraphOwnership(req, createMockRes(), createMockNext());
      expect(supabaseMock.from).toHaveBeenCalledWith('knowledge_graphs');
      expect(supabaseMock.select).toHaveBeenCalledWith('user_id');
    });

    it('requireTaskOwnership 查询 system_tasks 表的 user_id 列', async () => {
      const { req, supabaseMock } = createMockReq({
        params: { id: 'task-123' },
        userId: 'user-123',
        singleResult: { data: { user_id: 'user-123' }, error: null },
      });
      await requireTaskOwnership(req, createMockRes(), createMockNext());
      expect(supabaseMock.from).toHaveBeenCalledWith('system_tasks');
      expect(supabaseMock.select).toHaveBeenCalledWith('user_id');
    });

    it('requireQuizSetOwnership 查询 quiz_sets 表的 user_id 列', async () => {
      const { req, supabaseMock } = createMockReq({
        params: { id: 'quiz-123' },
        userId: 'user-123',
        singleResult: { data: { user_id: 'user-123' }, error: null },
      });
      await requireQuizSetOwnership(req, createMockRes(), createMockNext());
      expect(supabaseMock.from).toHaveBeenCalledWith('quiz_sets');
      expect(supabaseMock.select).toHaveBeenCalledWith('user_id');
    });

    it('requireTemplateOwnership 查询 templates 表的 user_id 列', async () => {
      const { req, supabaseMock } = createMockReq({
        params: { id: 'template-123' },
        userId: 'user-123',
        singleResult: { data: { user_id: 'user-123' }, error: null },
      });
      await requireTemplateOwnership(req, createMockRes(), createMockNext());
      expect(supabaseMock.from).toHaveBeenCalledWith('templates');
      expect(supabaseMock.select).toHaveBeenCalledWith('user_id');
    });

    it('requireKnowledgePointOwnership 查询 knowledge_points 表的 owner_id 列', async () => {
      const { req, supabaseMock } = createMockReq({
        params: { id: 'kp-123' },
        userId: 'user-123',
        singleResult: { data: { owner_id: 'user-123' }, error: null },
      });
      await requireKnowledgePointOwnership(
        req,
        createMockRes(),
        createMockNext(),
      );
      expect(supabaseMock.from).toHaveBeenCalledWith('knowledge_points');
      expect(supabaseMock.select).toHaveBeenCalledWith('owner_id');
    });
  });

  describe('认证依赖', () => {
    // 401 未认证请求由 requireAuth 前置中间件处理。
    // ownership 中间件在 requireAuth 之后运行，假设 req.user 已存在（全局类型增强
    // 将 Request.user 声明为非可选）。此处验证中间件假设 req.user 已存在，
    // 不自行抛出 AUTH_UNAUTHORIZED。
    it('依赖 requireAuth 处理认证（中间件假设 req.user 已存在）', async () => {
      // 所有者访问成功证明中间件正常工作，认证由 requireAuth 保证
      const { req } = createMockReq({
        params: { id: 'resource-123' },
        userId: 'user-123',
        singleResult: { data: { user_id: 'user-123' }, error: null },
      });
      const next = createMockNext();

      await requireGraphOwnership(req, createMockRes(), next);

      // 成功调用 next()，证明中间件不包含认证逻辑（401 由 requireAuth 负责）
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildOwnershipMiddleware 高阶函数', () => {
    it('默认使用 user_id 作为所有者列', async () => {
      const middleware = buildOwnershipMiddleware('custom_table');
      const { req, supabaseMock } = createMockReq({
        params: { id: 'res-1' },
        userId: 'user-123',
        singleResult: { data: { user_id: 'user-123' }, error: null },
      });

      await middleware(req, createMockRes(), createMockNext());

      expect(supabaseMock.from).toHaveBeenCalledWith('custom_table');
      expect(supabaseMock.select).toHaveBeenCalledWith('user_id');
    });

    it('支持指定 owner_id 作为所有者列', async () => {
      const middleware = buildOwnershipMiddleware('custom_table', 'owner_id');
      const { req, supabaseMock } = createMockReq({
        params: { id: 'res-1' },
        userId: 'user-123',
        singleResult: { data: { owner_id: 'user-123' }, error: null },
      });
      const next = createMockNext();

      await middleware(req, createMockRes(), next);

      expect(supabaseMock.select).toHaveBeenCalledWith('owner_id');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

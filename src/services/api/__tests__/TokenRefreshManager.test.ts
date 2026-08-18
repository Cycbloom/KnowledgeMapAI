import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenRefreshManager } from '../TokenRefreshManager';
import { TokenExpiredError, AppError, SharedErrorCodes } from '../../../utils/errors';
import { authApi } from '../auth';

// --- Mocks ---

const { mockSetUser, mockGetState } = vi.hoisted(() => {
  const mockSetUser = vi.fn();
  const mockGetState = vi.fn(() => ({
    refreshToken: 'test-refresh-token',
    setUser: mockSetUser,
  }));
  return { mockSetUser, mockGetState };
});

vi.mock('../../../store/useStore', () => ({
  useStore: {
    getState: mockGetState,
  },
}));

vi.mock('../auth', () => ({
  authApi: {
    refreshToken: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// --- Tests ---

describe('TokenRefreshManager', () => {
  let manager: TokenRefreshManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = TokenRefreshManager.getInstance();
    manager.reset();
    // Reset mockGetState to default
    mockGetState.mockReturnValue({
      refreshToken: 'test-refresh-token',
      setUser: mockSetUser,
    });
  });

  // ============================================================
  // 1. 单例模式
  // ============================================================
  describe('单例模式', () => {
    it('多次调用 getInstance() 返回同一实例', () => {
      const instance1 = TokenRefreshManager.getInstance();
      const instance2 = TokenRefreshManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ============================================================
  // 2. shouldRefreshToken
  // ============================================================
  describe('shouldRefreshToken', () => {
    it('传入 TokenExpiredError 实例返回 true', () => {
      const error = new TokenExpiredError();
      expect(manager.shouldRefreshToken(error)).toBe(true);
    });

    it('传入带 AUTH_TOKEN_EXPIRED 错误码的 AppError 返回 true', () => {
      const error = new AppError('test', SharedErrorCodes.AUTH_TOKEN_EXPIRED, 401);
      expect(manager.shouldRefreshToken(error)).toBe(true);
    });

    it('传入带 AUTH_TOKEN_INVALID 错误码的 AppError 返回 false（不可恢复）', () => {
      const error = new AppError('test', SharedErrorCodes.AUTH_TOKEN_INVALID, 401);
      expect(manager.shouldRefreshToken(error)).toBe(false);
    });

    it('传入带 AUTH_UNAUTHORIZED 错误码的 AppError 返回 false（不可恢复）', () => {
      const error = new AppError('test', SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
      expect(manager.shouldRefreshToken(error)).toBe(false);
    });

    it('传入带 AUTH_TOKEN_REVOKED 错误码的 AppError 返回 false（不可恢复）', () => {
      const error = new AppError('test', SharedErrorCodes.AUTH_TOKEN_REVOKED, 401);
      expect(manager.shouldRefreshToken(error)).toBe(false);
    });

    it('传入普通 Error 返回 false', () => {
      const error = new Error('普通错误');
      expect(manager.shouldRefreshToken(error)).toBe(false);
    });

    it('传入其他错误码的 AppError 返回 false', () => {
      const error = new AppError('test', SharedErrorCodes.RESOURCE_NOT_FOUND, 404);
      expect(manager.shouldRefreshToken(error)).toBe(false);
    });
  });

  // ============================================================
  // 3. refreshAccessToken
  // ============================================================
  describe('refreshAccessToken', () => {
    it('成功刷新 token', async () => {
      const mockResponse = {
        error: null,
        session: { access_token: 'new-access-token', refresh_token: 'new-refresh-token' },
        user: { id: 'user-1', email: 'test@example.com' },
      };
      vi.mocked(authApi.refreshToken).mockResolvedValue(mockResponse as any);

      const token = await manager.refreshAccessToken();

      expect(authApi.refreshToken).toHaveBeenCalledWith('test-refresh-token');
      expect(token).toBe('new-access-token');
      expect(mockSetUser).toHaveBeenCalledWith(
        mockResponse.user,
        'new-access-token',
        'new-refresh-token',
      );
    });

    it('response 含 error 时抛出 TokenExpiredError', async () => {
      const mockResponse = {
        error: 'Refresh failed',
        session: null,
        user: null,
      };
      vi.mocked(authApi.refreshToken).mockResolvedValue(mockResponse as any);

      const promise = manager.refreshAccessToken();
      await expect(promise).rejects.toMatchObject({
        name: 'TokenExpiredError',
        code: SharedErrorCodes.AUTH_TOKEN_EXPIRED,
      });
      expect(mockSetUser).toHaveBeenCalledWith(null, null, null);
    });

    it('response 无 session 时抛出 TokenExpiredError', async () => {
      const mockResponse = {
        error: null,
        session: null,
        user: null,
      };
      vi.mocked(authApi.refreshToken).mockResolvedValue(mockResponse as any);

      const promise = manager.refreshAccessToken();
      await expect(promise).rejects.toMatchObject({
        name: 'TokenExpiredError',
        code: SharedErrorCodes.AUTH_TOKEN_EXPIRED,
      });
      expect(mockSetUser).toHaveBeenCalledWith(null, null, null);
    });

    it('无 refreshToken 时抛出错误并清除用户', async () => {
      mockGetState.mockReturnValue({
        refreshToken: null,
        setUser: mockSetUser,
      });

      const promise = manager.refreshAccessToken();
      await expect(promise).rejects.toMatchObject({
        name: 'TokenExpiredError',
        code: SharedErrorCodes.AUTH_TOKEN_EXPIRED,
      });
      expect(mockSetUser).toHaveBeenCalledWith(null, null, null);
    });
  });

  // ============================================================
  // 4. 并发请求队列
  // ============================================================
  describe('并发请求队列', () => {
    it('同时调用 refreshAccessToken 两次，只有一个实际刷新，另一个等待', async () => {
      let resolveDeferred: (value: unknown) => void;
      const deferred = new Promise((resolve) => {
        resolveDeferred = resolve;
      });
      vi.mocked(authApi.refreshToken).mockReturnValue(deferred);

      const promise1 = manager.refreshAccessToken();
      const promise2 = manager.refreshAccessToken();

      // 第二个请求应被队列化，只调用一次 authApi.refreshToken
      expect(authApi.refreshToken).toHaveBeenCalledTimes(1);

      // 解析第一个请求
      resolveDeferred!({
        error: null,
        session: { access_token: 'shared-token', refresh_token: 'shared-refresh' },
        user: { id: 'user-1' },
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('shared-token');
      expect(result2).toBe('shared-token');
      expect(mockSetUser).toHaveBeenCalledTimes(1);
    });

    it('刷新失败时，队列中的请求也被拒绝', async () => {
      let rejectDeferred: (error: unknown) => void;
      const deferred = new Promise((_resolve, reject) => {
        rejectDeferred = reject;
      });
      vi.mocked(authApi.refreshToken).mockReturnValue(deferred);

      const promise1 = manager.refreshAccessToken();
      const promise2 = manager.refreshAccessToken();

      expect(authApi.refreshToken).toHaveBeenCalledTimes(1);

      rejectDeferred!(new Error('Refresh failed'));

      await expect(promise1).rejects.toThrow('Refresh failed');
      await expect(promise2).rejects.toThrow('Refresh failed');
      expect(mockSetUser).toHaveBeenCalledWith(null, null, null);
    });
  });

  // ============================================================
  // 5. reset 方法
  // ============================================================
  describe('reset', () => {
    it('调用 reset 后 isRefreshing 为 false, failedQueue 为空', () => {
      // 先设置一些状态
      (manager as any).isRefreshing = true;
      (manager as any).failedQueue = [{ resolve: vi.fn(), reject: vi.fn() }];

      manager.reset();

      expect(manager.getRefreshingStatus()).toBe(false);
      expect((manager as any).failedQueue).toEqual([]);
    });
  });
});
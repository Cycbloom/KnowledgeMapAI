import { useStore } from '../../store/useStore';
import { TokenExpiredError, AppError, SharedErrorCodes } from '../../utils/errors';
import { authApi } from './auth';

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

export class TokenRefreshManager {
  private static instance: TokenRefreshManager | null = null;
  private isRefreshing: boolean = false;
  private failedQueue: QueueItem[] = [];

  private constructor() {}

  static getInstance(): TokenRefreshManager {
    if (!TokenRefreshManager.instance) {
      TokenRefreshManager.instance = new TokenRefreshManager();
    }
    return TokenRefreshManager.instance;
  }

  shouldRefreshToken(error: unknown): boolean {
    return error instanceof TokenExpiredError || 
      (error instanceof AppError && (
        error.code === SharedErrorCodes.AUTH_TOKEN_EXPIRED ||
        error.code === SharedErrorCodes.AUTH_TOKEN_INVALID ||
        error.code === SharedErrorCodes.AUTH_UNAUTHORIZED ||
        error.code === SharedErrorCodes.AUTH_TOKEN_REVOKED
      ));
  }

  async refreshAccessToken(): Promise<string> {
    const { refreshToken } = useStore.getState();

    console.log('[TokenRefreshManager] 尝试刷新 token, refreshToken 存在:', !!refreshToken);

    if (!refreshToken) {
      console.log('[TokenRefreshManager] 没有 refresh token，清除用户状态');
      useStore.getState().setUser(null, null, null);
      throw new TokenExpiredError('No refresh token available');
    }

    if (this.isRefreshing) {
      console.log('[TokenRefreshManager] 已有刷新正在进行中，加入队列');
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      console.log('[TokenRefreshManager] 调用 authApi.refreshToken');
      const data = await authApi.refreshToken(refreshToken);
      console.log('[TokenRefreshManager] refreshToken 响应:', { hasError: !!data.error, hasSession: !!data.session });

      if (data.error || !data.session) {
        throw new TokenExpiredError(data.error || 'Token refresh failed');
      }

      const { session, user } = data;
      
      useStore.getState().setUser(user, session.access_token, session.refresh_token);
      console.log('[TokenRefreshManager] Token 刷新成功');
      this.processQueue(null, session.access_token);
      
      return session.access_token;
    } catch (error) {
      console.error('[TokenRefreshManager] Token 刷新失败:', error);
      this.processQueue(error, null);
      useStore.getState().setUser(null, null, null);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach(prom => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token as string);
      }
    });
    this.failedQueue = [];
  }

  getRefreshingStatus(): boolean {
    return this.isRefreshing;
  }

  reset(): void {
    this.isRefreshing = false;
    this.failedQueue = [];
  }
}

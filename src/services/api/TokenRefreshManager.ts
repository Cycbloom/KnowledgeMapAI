import { useStore } from '@/store/useStore';
import { TokenExpiredError, AppError, SharedErrorCodes } from '@/utils/errors';
import { authApi } from './auth';
import type { User } from '@shared/types/user';
import { logger } from '@/utils/logger';

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

    if (!refreshToken) {
      useStore.getState().setUser(null, null, null);
      throw new TokenExpiredError('No refresh token available');
    }

    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      const data = await authApi.refreshToken(refreshToken);

      if (data.error || !data.session) {
        throw new TokenExpiredError(data.error || 'Token refresh failed');
      }

      const { session, user } = data;
      
      useStore.getState().setUser(user as User | null, session.access_token, session.refresh_token);
      this.processQueue(null, session.access_token);
      
      return session.access_token;
    } catch (error) {
      logger.error('[TokenRefreshManager] Token 刷新失败:', error);
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

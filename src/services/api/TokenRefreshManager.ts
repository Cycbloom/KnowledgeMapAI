import { useStore } from '../../store/useStore';
import { TokenExpiredError, AppError, SharedErrorCodes } from '../../utils/errors';

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
      useStore.getState().setUser(null, null);
      throw new TokenExpiredError('No refresh token available');
    }

    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) {
        throw new TokenExpiredError('Token refresh failed');
      }

      const data = await refreshRes.json();
      const { session, user } = data;
      
      useStore.getState().setUser(user, session.access_token, session.refresh_token);
      this.processQueue(null, session.access_token);
      
      return session.access_token;
    } catch (error) {
      this.processQueue(error, null);
      useStore.getState().setUser(null, null);
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

import { useRef, useCallback, useState } from "react";

import {
  isRetryableError,
  isAppError,
  isApiError,
  isNetworkError,
  RateLimitError,
} from "@/utils/errors";

import type { AppErrorBase } from "@shared/types/appError";

export interface UseRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  retryCondition?: (error: unknown) => boolean;
}

export interface UseRetryReturn {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  isRetrying: boolean;
  retryCount: number;
  reset: () => void;
}

/**
 * 为前端 API 请求提供统一的带退避重试机制。
 *
 * 重试策略（差异化）：
 * - 网络错误（离线）：无限等待，不消耗重试次数
 * - 5xx 服务端错误：指数退避重试，默认最多 3 次
 * - 429 限流：按 Retry-After 等待，最多重试 2 次
 * - 4xx 客户端错误：不重试，直接返回错误
 * - retryCondition 返回 false：不重试
 */
export function useRetry(options: UseRetryOptions = {}): UseRetryReturn {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    onRetry,
    retryCondition = isRetryableError,
  } = options;

  const retryCountRef = useRef(0);
  const isRetryingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const reset = useCallback(() => {
    retryCountRef.current = 0;
    isRetryingRef.current = false;
    setIsRetrying(false);
    setRetryCount(0);
  }, []);

  const getRetryDelay = useCallback(
    (error: unknown, attempt: number): number | null => {
      // 429 限流：按 Retry-After 响应头等待
      if (error instanceof RateLimitError && error.retryAfter !== undefined) {
        return error.retryAfter * 1000;
      }

      // 4xx 客户端错误（不包括 429 和 408）：不重试
      const status = isAppError(error)
        ? (error as AppErrorBase).statusCode
        : isApiError(error)
          ? error.status
          : undefined;
      if (
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        status !== 429 &&
        status !== 408
      ) {
        return null;
      }

      // 指数退避：initialDelay * 2^attempt
      return Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
    },
    [initialDelay, maxDelay],
  );

  const getEffectiveMaxRetries = useCallback(
    (error: unknown): number => {
      if (error instanceof RateLimitError) {
        return 2;
      }
      return maxRetries;
    },
    [maxRetries],
  );

  const execute = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      let attempt = 0;

      const executeAttempt = async (): Promise<T> => {
        try {
          return await fn();
        } catch (error) {
          const isNetworkErr = isNetworkError(error);

          // 网络错误：始终可重试（不受 retryCondition 限制）
          if (isNetworkErr && !navigator.onLine) {
            // 离线：无限等待，不消耗重试次数
            isRetryingRef.current = true;
            setIsRetrying(true);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return executeAttempt();
          }

          // 非网络错误且不满足重试条件，直接抛出
          if (!isNetworkErr && !retryCondition(error)) {
            throw error;
          }

          const delay = getRetryDelay(error, attempt);

          if (delay === null) {
            throw error;
          }

          const effectiveMaxRetries = getEffectiveMaxRetries(error);

          if (attempt >= effectiveMaxRetries) {
            throw error;
          }

          attempt++;
          retryCountRef.current = attempt;
          setRetryCount(attempt);

          isRetryingRef.current = true;
          setIsRetrying(true);

          if (onRetry) {
            onRetry(
              attempt,
              error instanceof Error ? error : new Error(String(error)),
            );
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
          return executeAttempt();
        }
      };

      try {
        return await executeAttempt();
      } finally {
        isRetryingRef.current = false;
        setIsRetrying(false);
      }
    },
    [getRetryDelay, getEffectiveMaxRetries, onRetry, retryCondition],
  );

  return {
    execute,
    isRetrying,
    retryCount,
    reset,
  };
}
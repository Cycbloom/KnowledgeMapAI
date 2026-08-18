import axios, {
  AxiosInstance,
  AxiosError,
  AxiosResponse,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { useStore } from "@/store/useStore";
import {
  createErrorFromResponse,
  isRetryableError,
  isNetworkError,
  SharedErrorCodes,
} from "@/utils/errors";

import type { AppErrorBase } from "@shared/types/appError";
import { TokenRefreshManager } from "./TokenRefreshManager";
import { isCapacitorMobile, getMobileApiBaseUrl } from "@/config/mobileApiConfig";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "@/config/electronConfig";
import { localQuery, isCloudOnlyResource } from "./localClient";
import { captureException } from "@/utils/errorReporter";
import { logger } from "@/utils/logger";

// 模块级常量幂等 HTTP 方法集合，替代重试判断中每次重建数组的 O(n) 扫描
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "PUT",
  "DELETE",
]);

/**
 * Shape of the error response body returned by the backend.
 * Matches the `data` field expected by `createErrorFromResponse`.
 */
interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
}

// Module augmentation for in-flight GET request deduplication
declare module "axios" {
  interface AxiosRequestConfig {
    _skipDedupe?: boolean;
  }
  interface InternalAxiosRequestConfig {
    _inflightKey?: string;
    _requestId?: string;
    _retryCount?: number;
  }
}

// Module-level Map storing in-flight GET request promises for deduplication
const inflightRequests = new Map<string, Promise<unknown>>();

// Generate a deduplication key from method + url + params
const getInflightKey = (config: AxiosRequestConfig): string => {
  const method = (config.method || "get").toLowerCase();
  const url = config.url || "";
  const params = JSON.stringify(config.params || {});
  return `${method}:${url}:${params}`;
};

const isMobileClient = (): boolean => {
  return isCapacitorMobile();
};

const isElectronClient = (): boolean => {
  return isElectronProduction();
};

export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
};

/**
 * 解码 JWT payload（仅前端本地检查，无需依赖库）。
 * 返回 null 表示 token 不是合法 JWT 格式。
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url → 标准 Base64 → 解码
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// 内存级 CSRF token 存储 —— cookie 已设为 httpOnly，前端无法通过 document.cookie 读取
let csrfTokenValue: string | null = null;

export const getCsrfToken = (): string | null => csrfTokenValue;

let csrfInitialized = false;

const initCsrf = async (): Promise<void> => {
  if (csrfInitialized) return;

  if (isElectronProduction()) {
    csrfInitialized = true;
    return;
  }

  try {
    let csrfUrl: string;
    if (isElectronProduction()) {
      const electronApiUrl = await getElectronApiUrl();
      csrfUrl = `${electronApiUrl}/csrf-token`;
    } else {
      csrfUrl = "/api/v1/csrf-token";
    }

    const response = await fetch(csrfUrl, {
      credentials: "include",
    });
    // 解析响应体中的 token 并存入内存
    const data = await response.json().catch(() => ({}));
    if (data?.csrfToken) {
      csrfTokenValue = data.csrfToken;
    }
    csrfInitialized = true;
  } catch (error) {
    logger.warn("Failed to initialize CSRF token", error);
  }
};

// Export for backward compatibility (client.ts re-exports it)
export { initCsrf };

/**
 * Axios adapter that implements Local-First strategy for Electron production.
 * Tries IPC → SQLite first; falls back to HTTP if local DB unavailable or resource is cloud-only.
 */
function localFirstAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

  // Only active in Electron production mode
  if (!isElectronProduction()) {
    return defaultAdapter(config);
  }

  const url = config.url ?? "";
  const method = config.method?.toUpperCase() || "GET";

  // Parse URL to extract resource and optional id
  const urlObj = new URL(url, "http://localhost");
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  if (pathParts.length === 0) {
    return defaultAdapter(config);
  }

  const resource = pathParts[0];

  // Skip cloud-only resources
  if (isCloudOnlyResource(resource)) {
    return defaultAdapter(config);
  }

  const id = pathParts.length > 1 ? pathParts[1] : undefined;

  let ipcMethod: string;
  let params: Record<string, unknown> = {};

  if (method === "GET") {
    if (id) {
      ipcMethod = "findById";
      params = { id };
    } else {
      ipcMethod = "findAll";
      const filters: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        filters[key] = value;
      });
      if (Object.keys(filters).length > 0) {
        params = { filters };
      }
    }
  } else if (method === "POST") {
    ipcMethod = "create";
    params = { data: config.data };
  } else if (method === "PUT" || method === "PATCH") {
    ipcMethod = "update";
    params = { id, data: config.data };
  } else if (method === "DELETE") {
    ipcMethod = "delete";
    params = { id };
  } else {
    return defaultAdapter(config);
  }

  return localQuery({ resource, method: ipcMethod, params })
    .then((localResult) => {
      if (localResult !== null) {
        // Return a response-like object that the response interceptor can handle
        // Since the response interceptor does `response.data`, we need to wrap it
        return {
          data: localResult,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }
      // Fallback to HTTP
      return defaultAdapter(config);
    })
    .catch(() => {
      // On any local query error, fallback to HTTP
      return defaultAdapter(config);
    });
}

export const createApiClient = (): AxiosInstance => {
  let initialBaseURL = "/api/v1";

  if (isMobileClient()) {
    initialBaseURL = getMobileApiBaseUrl();
  }

  const client = axios.create({
    baseURL: initialBaseURL,
    withCredentials: true,
  });

  if (isElectronProduction()) {
    client.defaults.adapter = localFirstAdapter;
  }

  let electronBaseURLInitialized = false;

  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (isElectronProduction() && !electronBaseURLInitialized) {
        const electronBaseURL = await getElectronApiUrl();
        client.defaults.baseURL = electronBaseURL;
        config.baseURL = electronBaseURL;
        electronBaseURLInitialized = true;
      }

      const token = useStore.getState().token;
      const csrfToken = csrfTokenValue;

      if (token) {
        // 检查 JWT 是否过期，避免带着过期 token 发出必然失败的请求
        const payload = decodeJwtPayload(token);
        if (payload) {
          const exp = payload.exp as number | undefined;
          if (exp && exp * 1000 < Date.now()) {
            // Token 已过期，尝试刷新
            try {
              const tokenRefreshManager = TokenRefreshManager.getInstance();
              const newToken = await tokenRefreshManager.refreshAccessToken();
              config.headers.Authorization = `Bearer ${newToken}`;
            } catch {
              // 刷新失败：清除 auth 并跳转登录页，跳过本次请求
              const currentPath = window.location.pathname;
              useStore.getState().clearAuth();
              if (currentPath !== '/login') {
                window.location.href = '/login';
              }
              return Promise.reject(new Error('Token expired, redirecting to login'));
            }
          } else {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      if (csrfToken) {
        config.headers["x-csrf-token"] = csrfToken;
      }

      if (isMobileClient()) {
        config.headers["x-mobile-client"] = "true";
      }

      if (isElectronClient()) {
        config.headers["x-electron-client"] = "true";
      }

      // Add request tracing headers
      const requestId = crypto.randomUUID();
      config.headers["X-Request-Id"] = requestId;
      config.headers["X-Client-Version"] = "1.0.1";
      config._requestId = requestId;

      // Mark request start for performance monitoring
      performance.mark(`request-start-${requestId}`);

      // Mark in-flight key for GET requests (unless explicitly skipped)
      const method = (config.method || "get").toLowerCase();
      if (method === "get" && !config._skipDedupe) {
        config._inflightKey = getInflightKey(config);
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  client.interceptors.response.use(
    (response) => {
      const key = response.config?._inflightKey;
      if (key) {
        inflightRequests.delete(key);
      }

      // Record request timing
      const requestId = response.config?._requestId;
      if (requestId) {
        performance.mark(`request-end-${requestId}`);
        performance.measure(`request-${requestId}`, `request-start-${requestId}`, `request-end-${requestId}`);
        const duration = performance.getEntriesByName(`request-${requestId}`)[0]?.duration;
        if (duration !== undefined) {
          logger.debug(`[API] ${response.config?.method?.toUpperCase()} ${response.config?.url} - ${duration.toFixed(0)}ms`);
        }
        performance.clearMarks(`request-start-${requestId}`);
        performance.clearMarks(`request-end-${requestId}`);
        performance.clearMeasures(`request-${requestId}`);
      }

      return response.data;
    },
    async (error: AxiosError) => {
      // Clean up in-flight entry on error
      const inflightKey = error.config?._inflightKey;
      if (inflightKey) {
        inflightRequests.delete(inflightKey);
      }

      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (!originalRequest) {
        return Promise.reject(error);
      }

      // Record request timing on error
      const requestId = originalRequest._requestId;
      if (requestId) {
        performance.mark(`request-end-${requestId}`);
        performance.measure(`request-${requestId}`, `request-start-${requestId}`, `request-end-${requestId}`);
        const duration = performance.getEntriesByName(`request-${requestId}`)[0]?.duration;
        if (duration !== undefined) {
          logger.debug(`[API] ${originalRequest.method?.toUpperCase()} ${originalRequest.url} - ${duration.toFixed(0)}ms - ERROR`);
        }
        performance.clearMarks(`request-start-${requestId}`);
        performance.clearMarks(`request-end-${requestId}`);
        performance.clearMeasures(`request-${requestId}`);
      }

      const appError = createErrorFromResponse({
        status: error.response?.status || 0,
        statusText: error.message,
        data: error.response?.data as ApiErrorResponse | undefined,
      });

      const tokenRefreshManager = TokenRefreshManager.getInstance();

      if (
        tokenRefreshManager.shouldRefreshToken(appError) &&
        !originalRequest._retry &&
        !originalRequest.url?.includes("/auth/login") &&
        !originalRequest.url?.includes("/auth/refresh")
      ) {
        originalRequest._retry = true;

        try {
          const newToken = await tokenRefreshManager.refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      // 通用重试逻辑：仅对可重试错误生效（与 useRetry 策略一致）
      const retryCount = originalRequest._retryCount ?? 0;
      const isNetworkErr = isNetworkError(appError);
      const isRetryable = isRetryableError(appError) || isNetworkErr;

      if (isRetryable) {
        const method = (originalRequest.method || "get").toUpperCase();
        const isIdempotentMethod = IDEMPOTENT_METHODS.has(method);
        // 非幂等方法（POST、PATCH）仅对网络错误、5xx 和 429 重试
        const appErrorStatus = (appError as AppErrorBase).statusCode;
        const isSafeError = isNetworkErr || appErrorStatus >= 500 || appErrorStatus === 429;

        if (isIdempotentMethod || isSafeError) {
          // 429 限流最多重试 2 次，其他可重试错误最多 3 次（与 useRetry 策略一致）
          const maxApiRetries = appErrorStatus === 429 ? 2 : 3;

          if (retryCount < maxApiRetries) {
            originalRequest._retryCount = retryCount + 1;

            let delayMs: number;

            if (isNetworkErr && !navigator.onLine) {
              // 网络错误且离线：每秒轮询
              delayMs = 1000;
            } else if (appErrorStatus === 429) {
              // 429 限流：优先使用 Retry-After 响应头
              const retryAfter = error.response?.headers?.["retry-after"];
              if (retryAfter !== undefined) {
                delayMs = parseInt(String(retryAfter), 10) * 1000;
              } else {
                delayMs = 5000;
              }
            } else {
              // 指数退避：1s → 2s → 4s
              delayMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return client(originalRequest);
          }
        }
      }

      // 不可恢复的鉴权错误：清除 auth 并跳转登录页
      const isUnrecoverableAuth = (appError as AppErrorBase).code === SharedErrorCodes.AUTH_TOKEN_INVALID
        || (appError as AppErrorBase).code === SharedErrorCodes.AUTH_TOKEN_REVOKED
        || (appError as AppErrorBase).code === SharedErrorCodes.AUTH_TOKEN_MISSING
        || (appError as AppErrorBase).code === SharedErrorCodes.AUTH_HEADER_MISSING
        || (appError as AppErrorBase).code === SharedErrorCodes.AUTH_UNAUTHORIZED;

      if (isUnrecoverableAuth) {
        logger.warn('[API] Unrecoverable auth error, clearing auth and redirecting to /login', {
          code: (appError as AppErrorBase).code,
          url: error.config?.url,
        });
        useStore.getState().clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(appError);
      }

      const appErrorStatus = (appError as AppErrorBase).statusCode;
      if (appErrorStatus >= 500 || !appErrorStatus) {
        captureException(appError as unknown as Error, { url: error.config?.url });
      }
      return Promise.reject(appError);
    },
  );

  initCsrf().catch((err) => { logger.error("Failed to initialize CSRF token", err); });

  // Wrap client.get to enable in-flight GET request deduplication.
  // Identical concurrent GET requests (same method + url + params) share a
  // single underlying Promise; subsequent callers receive the same response.
  const originalGet = client.get.bind(client);

  const dedupedGet = function <T = unknown, R = AxiosResponse<T>, D = unknown>(
    url: string,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    const mergedConfig: AxiosRequestConfig<D> = {
      ...config,
      method: "get",
      url,
    };
    if (mergedConfig._skipDedupe) {
      return originalGet<T, R, D>(url, config) as unknown as Promise<R>;
    }
    const key = getInflightKey(mergedConfig);
    const existing = inflightRequests.get(key);
    if (existing) {
      return existing as Promise<R>;
    }
    const promise = originalGet<T, R, D>(url, config);
    inflightRequests.set(key, promise as Promise<unknown>);
    // Entry is removed by the response interceptor on success or error.
    return promise as unknown as Promise<R>;
  };

  client.get = dedupedGet as typeof client.get;

  return client;
};

export const apiClient = createApiClient();

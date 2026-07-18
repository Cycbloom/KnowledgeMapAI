import axios, {
  AxiosInstance,
  AxiosError,
  AxiosResponse,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { useStore } from "@/store/useStore";
import { createErrorFromResponse } from "@/utils/errors";
import { TokenRefreshManager } from "./TokenRefreshManager";
import { isCapacitorMobile } from "@/config/mobileApiConfig";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "@/config/electronConfig";
import { getMobileApiBaseUrl } from "@/config/mobileApiConfig";
import { localQuery, isCloudOnlyResource } from "./localClient";
import { captureException } from "@/utils/errorReporter";
import { logger } from "@/utils/logger";

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

let csrfInitialized = false;

const initCsrf = async (): Promise<void> => {
  if (csrfInitialized) return;

  if (isElectronProduction()) {
    csrfInitialized = true;
    return;
  }

  const existingToken = getCookie("csrf-token");
  if (existingToken) {
    csrfInitialized = true;
    return;
  }

  try {
    let csrfUrl: string;
    if (isElectronProduction()) {
      const electronApiUrl = await getElectronApiUrl();
      csrfUrl = `${electronApiUrl}/csrf-token`;
    } else {
      csrfUrl = "/api/csrf-token";
    }

    await fetch(csrfUrl, {
      credentials: "include",
    });
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
  let initialBaseURL = "/api";

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
      const csrfToken = getCookie("csrf-token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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

      if (appError.statusCode >= 500 || !appError.statusCode) {
        captureException(appError, { url: error.config?.url });
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
      return originalGet<T, R, D>(url, config);
    }
    const key = getInflightKey(mergedConfig);
    const existing = inflightRequests.get(key);
    if (existing) {
      return existing as Promise<R>;
    }
    const promise = originalGet<T, R, D>(url, config);
    inflightRequests.set(key, promise as Promise<unknown>);
    // Entry is removed by the response interceptor on success or error.
    return promise;
  };

  client.get = dedupedGet as typeof client.get;

  return client;
};

export const apiClient = createApiClient();

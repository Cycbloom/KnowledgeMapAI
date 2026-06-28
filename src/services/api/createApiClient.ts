import axios, {
  AxiosInstance,
  AxiosError,
  AxiosResponse,
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
    console.warn("Failed to initialize CSRF token", error);
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

      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  client.interceptors.response.use(
    (response) => {
      return response.data;
    },
    async (error: AxiosError) => {
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

      return Promise.reject(appError);
    },
  );

  initCsrf().catch(() => {});

  return client;
};

export const apiClient = createApiClient();

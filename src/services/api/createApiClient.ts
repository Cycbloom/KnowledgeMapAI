import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { useStore } from "../../store/useStore";
import { createErrorFromResponse } from "../../utils/errors";
import { TokenRefreshManager } from "./TokenRefreshManager";
import { isCapacitorMobile } from "../../config/mobileApiConfig";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "../../config/electronConfig";

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

export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: "/api",
    withCredentials: true,
  });

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

      console.log('[createApiClient] 请求拦截器:', { 
        url: config.url, 
        hasToken: !!token, 
        hasCsrfToken: !!csrfToken,
        isElectron: isElectronClient()
      });

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[createApiClient] 已设置 Authorization header');
      } else {
        console.log('[createApiClient] ⚠️  没有 token，未设置 Authorization header');
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
        data: error.response?.data as any,
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

  return client;
};

export const apiClient = createApiClient();

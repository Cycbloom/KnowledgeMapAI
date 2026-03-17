import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useStore } from '../../store/useStore';
import { createErrorFromResponse } from '../../utils/errors';
import { TokenRefreshManager } from './TokenRefreshManager';
import { getMobileApiBaseUrl } from '../../config/mobileApiConfig';

export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

export const createApiClient = (): AxiosInstance => {
  const mobileBaseUrl = getMobileApiBaseUrl();
  const baseURL = mobileBaseUrl ? `${mobileBaseUrl}/api` : '/api';

  const client = axios.create({
    baseURL,
    withCredentials: true,
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = useStore.getState().token;
      const csrfToken = getCookie('csrf-token');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response) => {
      return response.data;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

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
        !originalRequest.url?.includes('/auth/login') &&
        !originalRequest.url?.includes('/auth/refresh')
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
    }
  );

  return client;
};

export const apiClient = createApiClient();

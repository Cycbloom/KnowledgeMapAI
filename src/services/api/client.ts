import { useStore } from '@/store/useStore';
import { createErrorFromResponse } from '@/utils/errors';
import { apiClient, getCsrfToken } from './createApiClient';
import { isElectronProduction, getElectronApiUrl } from '@/config/electronConfig';
import { getMobileApiBaseUrl } from '@/config/mobileApiConfig';
import type { Method } from 'axios';

export { initCsrf } from './createApiClient';
export { getCsrfToken };

export const getHeaders = () => {
  const token = useStore.getState().token;
  const csrfToken = !isElectronProduction() ? getCsrfToken() : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  
  if (isElectronProduction()) {
    headers['x-electron-client'] = 'true';
  }
  
  return headers;
};

export const handleResponse = async <T = unknown>(res: Response): Promise<T> => {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  
  if (!res.ok) {
    throw createErrorFromResponse({
      status: res.status,
      statusText: res.statusText,
      data: {
        message: data?.message,
        error: data?.error,
        code: data?.code,
        details: data?.details,
      },
    });
  }
  
  return data as T;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 10+ 调用方未指定泛型参数，unknown 会导致约 37 处级联类型错误，超出 R44 spec 单任务修改范围
export const request = async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
  const method = (options.method?.toUpperCase() || 'GET') as Method;
  const data = options.body ? JSON.parse(options.body as string) : undefined;

  return apiClient.request<T, T>({
    url,
    method,
    data,
  }) as unknown as T;
};

/**
 * Standard API response envelope returned by all backend endpoints.
 * Backend always returns `{ success, data, ...extra }` format.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  total?: number;
  message?: string;
}

/**
 * Like {@link request}, but unwraps the standard `{ success, data }` envelope
 * and returns the inner `data` payload directly. Use this for endpoints that
 * return the standard wrapped response (all scheduler endpoints do).
 */
export const requestData = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const res = await request<ApiResponse<T>>(url, options);
  return res.data;
};

export type AITaskType = 'text' | 'embedding' | 'reasoning';

export interface AIConfig {
  provider?: string;
  model?: string;
}

export const getAIConfig = (taskType: AITaskType = 'text') => {
  const { user } = useStore.getState();
  const config = user?.profile?.settings?.ai_config?.[taskType];
  return {
    provider: config?.provider,
    model: config?.model
  };
};

export const injectAIConfig = <T extends Record<string, unknown>>(
  payload: T,
  taskType: AITaskType = 'text'
): T & AIConfig => {
  const config = getAIConfig(taskType);
  return {
    ...payload,
    ...(config.provider && !payload.provider ? { provider: config.provider } : {}),
    ...(config.model && !payload.model ? { model: config.model } : {}),
  };
};

export const getApiUrl = async () => {
  if (isElectronProduction()) {
    return await getElectronApiUrl();
  }
  // 移动端 WebView 与后端不同源：流式/上传类请求必须与 apiClient 使用同一后端地址
  // （VITE_API_BASE_URL，见 createApiClient），Web 端仍返回相对路径 "/api/v1"。
  return getMobileApiBaseUrl();
};

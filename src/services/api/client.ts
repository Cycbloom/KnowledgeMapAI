import { useStore } from '@/store/useStore';
import { createErrorFromResponse } from '@/utils/errors';
import { apiClient, getCookie } from './createApiClient';
import { isElectronProduction, getElectronApiUrl } from '@/config/electronConfig';

const API_URL = '/api';

export { initCsrf } from './createApiClient';
export { getCookie };

export const getHeaders = () => {
  const token = useStore.getState().token;
  const csrfToken = !isElectronProduction() ? getCookie('csrf-token') : null;
  
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

export const handleResponse = async <T = any>(res: Response): Promise<T> => {
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

export const request = async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
  const method = (options.method?.toUpperCase() || 'GET') as any;
  const data = options.body ? JSON.parse(options.body as string) : undefined;

  return apiClient.request<T, T>({
    url,
    method,
    data,
  });
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

export const injectAIConfig = <T extends Record<string, any>>(
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
  return API_URL;
};

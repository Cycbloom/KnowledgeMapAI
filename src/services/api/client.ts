import { useStore } from '@/store/useStore';
import { createErrorFromResponse } from '@/utils/errors';
import { apiClient, getCookie } from './createApiClient';
import { isElectronProduction, getElectronApiUrl } from '@/config/electronConfig';
import { localQuery, isCloudOnlyResource } from './localClient';

const API_URL = '/api';

let csrfInitialized = false;

export { getCookie };

export const initCsrf = async (): Promise<void> => {
  if (csrfInitialized) return;
  
  if (isElectronProduction()) {
    csrfInitialized = true;
    return;
  }
  
  const existingToken = getCookie('csrf-token');
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
      csrfUrl = `${API_URL}/csrf-token`;
    }
    
    await fetch(csrfUrl, {
      credentials: 'include',
    });
    csrfInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize CSRF token', error);
  }
};

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

/**
 * Try to resolve an API request via local IPC → SQLite.
 * Returns null if local DB is not available, resource is cloud-only, or method is unsupported.
 */
async function tryLocalQuery<T>(url: string, options: RequestInit): Promise<T | null> {
  // Parse URL to extract resource and optional id
  const urlObj = new URL(url, 'http://localhost');
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  if (pathParts.length === 0) return null;

  const resource = pathParts[0];

  // Skip cloud-only resources
  if (isCloudOnlyResource(resource)) return null;

  const method = options.method?.toUpperCase() || 'GET';
  const id = pathParts.length > 1 ? pathParts[1] : undefined;

  let ipcMethod: string;
  let params: Record<string, unknown> = {};

  if (method === 'GET') {
    if (id) {
      ipcMethod = 'findById';
      params = { id };
    } else {
      ipcMethod = 'findAll';
      const filters: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        filters[key] = value;
      });
      if (Object.keys(filters).length > 0) {
        params = { filters };
      }
    }
  } else if (method === 'POST') {
    ipcMethod = 'create';
    const body = options.body ? JSON.parse(options.body as string) : {};
    params = { data: body };
  } else if (method === 'PUT' || method === 'PATCH') {
    ipcMethod = 'update';
    const body = options.body ? JSON.parse(options.body as string) : {};
    params = { id, data: body };
  } else if (method === 'DELETE') {
    ipcMethod = 'delete';
    params = { id };
  } else {
    return null; // Unsupported method for local
  }

  return localQuery<T>({ resource, method: ipcMethod, params });
}

export const request = async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
  // Local-First: Try IPC → SQLite for Electron production mode
  if (isElectronProduction()) {
    const localResult = await tryLocalQuery<T>(url, options);
    if (localResult !== null) {
      return localResult;
    }
  }

  const method = (options.method?.toUpperCase() || 'GET') as any;
  const data = options.body ? JSON.parse(options.body as string) : undefined;

  const headers: Record<string, string> = {};
  if (options.headers) {
    const headersObj = options.headers as Record<string, string>;
    Object.assign(headers, headersObj);
  }
  // 确保 JSON 请求有正确的 Content-Type（axios 默认会设置，但显式声明更可靠）
  if (data && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return apiClient.request<T, T>({
    url,
    method,
    data,
    headers,
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

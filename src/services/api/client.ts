import { useStore } from '../../store/useStore';
import {
  AppError,
  TokenExpiredError,
  createErrorFromResponse,
} from '../../utils/errors';

const API_URL = '/api';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];
let csrfInitialized = false;

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

export const initCsrf = async (): Promise<void> => {
  if (csrfInitialized) return;
  
  const existingToken = getCookie('csrf-token');
  if (existingToken) {
    csrfInitialized = true;
    return;
  }

  try {
    await fetch(`${API_URL}/csrf-token`, {
      credentials: 'include',
    });
    csrfInitialized = true;
  } catch {
    console.warn('Failed to initialize CSRF token');
  }
};

export const getHeaders = () => {
  const token = useStore.getState().token;
  const csrfToken = getCookie('csrf-token');
  
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
  };
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
  const doRequest = async (tokenOverride?: string): Promise<T> => {
    const headers: Record<string, string> = {
      ...getHeaders(),
      ...(options.headers as Record<string, string>),
    };
    
    if (tokenOverride) {
      headers['Authorization'] = `Bearer ${tokenOverride}`;
    }

    return fetch(`${API_URL}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    }).then(res => handleResponse<T>(res));
  };

  try {
    return await doRequest();
  } catch (error: unknown) {
    const isTokenExpired = error instanceof TokenExpiredError || 
      (error instanceof AppError && (error.code === 'TOKEN_EXPIRED' || error.code === 'AUTH_ERROR'));
    
    if (isTokenExpired && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
      const { refreshToken } = useStore.getState();

      if (!refreshToken) {
        useStore.getState().setUser(null, null);
        throw error;
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          return doRequest(token as string);
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
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
        processQueue(null, session.access_token);
        
        return await doRequest(session.access_token);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useStore.getState().setUser(null, null);
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
    
    throw error;
  }
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

export const getApiUrl = () => API_URL;

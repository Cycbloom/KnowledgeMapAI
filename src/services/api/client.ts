import { useStore } from '../../store/useStore';

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
    if (res.status === 401) {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      (error as any).code = 'UNAUTHORIZED';
      throw error;
    }
    if (res.status === 403) {
      const error = new Error(data?.message || 'Forbidden');
      (error as any).status = 403;
      (error as any).code = 'FORBIDDEN';
      throw error;
    }
    if (res.status === 404) {
      const error = new Error(data?.message || 'Not Found');
      (error as any).status = 404;
      (error as any).code = 'NOT_FOUND';
      throw error;
    }
    if (res.status >= 500) {
      const error = new Error(data?.message || 'Server Error');
      (error as any).status = res.status;
      (error as any).code = 'SERVER_ERROR';
      throw error;
    }
    const error = new Error((data && data.message) || (data && data.error) || res.statusText);
    (error as any).status = res.status;
    (error as any).code = data?.code || 'API_ERROR';
    throw error;
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
    const err = error as Error & { message: string };
    if (err.message === 'Unauthorized' && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
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
          throw new Error('Refresh failed');
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

export const getAIConfig = (taskType: 'text' | 'embedding' | 'reasoning' = 'text') => {
  const { user } = useStore.getState();
  const config = user?.profile?.settings?.ai_config?.[taskType];
  return {
    provider: config?.provider,
    model: config?.model
  };
};

export const getApiUrl = () => API_URL;

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export const fetchWithRetry = async <T>(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<T> => {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = response.statusText;
        try {
          const parsed = JSON.parse(errorData);
          errorMessage = parsed.error || parsed.message || response.statusText;
        } catch {
          // Use status text if not JSON
        }

        const error = new Error(errorMessage) as Error & { status?: number };
        error.status = response.status;

        if (
          attempt < finalConfig.maxRetries &&
          finalConfig.retryableStatuses.includes(response.status)
        ) {
          throw error;
        }

        throw error;
      }

      const text = await response.text();
      try {
        return text ? JSON.parse(text) : ({} as T);
      } catch {
        return text as unknown as T;
      }
    } catch (error: unknown) {
      lastError = error as Error;

      const isAbortError = (error as Error).name === 'AbortError';
      const isNetworkError =
        (error as Error).message.includes('Failed to fetch') ||
        (error as Error).message.includes('NetworkError');

      if (attempt < finalConfig.maxRetries && (isNetworkError || isAbortError || finalConfig.retryableStatuses.includes((error as Error & { status?: number }).status || 0))) {
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          finalConfig.maxDelay
        );

        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt + 1, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
};

export const createRetryableApi = <T>(
  endpoint: string,
  options: RequestInit = {},
  retryConfig?: Partial<RetryConfig>
): Promise<T> => {
  return fetchWithRetry<T>(`/api${endpoint}`, options, retryConfig);
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  if (error instanceof Error) {
    return (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.name === 'AbortError'
    );
  }
  return false;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

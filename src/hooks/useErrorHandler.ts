import { useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useMessageStore, MessageType } from '../store/useMessageStore';
import { useNavigate } from 'react-router-dom';

interface ApiError {
  success: boolean;
  code: string;
  error: string;
  details?: Array<{ field: string; message: string }>;
}

interface ErrorHandlerOptions {
  silent?: boolean;
  redirect?: string;
  context?: string;
  fallbackMessage?: string;
}

interface ErrorInfo {
  message: string;
  code: string;
  isAuthError: boolean;
  isNetworkError: boolean;
  isValidationError: boolean;
  details?: Array<{ field: string; message: string }>;
}

const parseError = (error: any): ErrorInfo => {
  let message = '操作失败，请稍后重试';
  let code = 'UNKNOWN_ERROR';
  let isAuthError = false;
  let isNetworkError = false;
  let isValidationError = false;
  let details: Array<{ field: string; message: string }> | undefined;

  if (!navigator.onLine || error?.name === 'TypeError' && error?.message === 'Failed to fetch') {
    message = '网络连接失败，请检查网络设置';
    code = 'NETWORK_ERROR';
    isNetworkError = true;
  } else if (error?.response?.data) {
    const data = error.response.data as ApiError;
    message = data.error || message;
    code = data.code || code;

    if (error.response.status === 401) {
      isAuthError = true;
      message = '登录已过期，请重新登录';
      code = 'AUTH_ERROR';
    }

    if (data.code === 'VALIDATION_ERROR' && data.details) {
      isValidationError = true;
      details = data.details;
      message = data.details.map(d => d.message).join('、');
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  return { message, code, isAuthError, isNetworkError, isValidationError, details };
};

export const useErrorHandler = () => {
  const navigate = useNavigate();
  const { addMessage } = useMessageStore();
  const { setUser } = useStore();

  const handleError = useCallback((error: any, options: ErrorHandlerOptions = {}) => {
    const { silent = false, redirect, context, fallbackMessage } = options;
    const errorInfo = parseError(error);

    const prefix = context ? `[${context}] ` : '';
    const logMessage = `${prefix}${errorInfo.message}`;
    console.error('[ErrorHandler]', logMessage, error);

    if (errorInfo.isAuthError) {
      setUser(null, null);
      if (!silent) {
        addMessage({ type: 'error', content: errorInfo.message, duration: 5000 });
      }
      navigate('/login');
      return errorInfo;
    }

    const displayMessage = fallbackMessage && errorInfo.code === 'UNKNOWN_ERROR' 
      ? fallbackMessage 
      : errorInfo.message;

    if (!silent) {
      addMessage({ type: 'error', content: displayMessage, duration: 5000 });
    }

    if (redirect) {
      navigate(redirect);
    }

    return errorInfo;
  }, [navigate, addMessage, setUser]);

  const withErrorHandling = useCallback(async <T,>(
    fn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  return { handleError, withErrorHandling, parseError };
};

export class ErrorHandlerService {
  private addMessage: (msg: { type: MessageType; content: string; duration?: number }) => void;

  constructor(addMessage: (msg: { type: MessageType; content: string; duration?: number }) => void) {
    this.addMessage = addMessage;
  }

  handle(error: unknown, context?: string): ErrorInfo {
    const errorInfo = parseError(error);
    const prefix = context ? `[${context}] ` : '';
    console.error(`${prefix}${errorInfo.message}`, error);
    this.addMessage({ type: 'error', content: errorInfo.message, duration: 5000 });
    return errorInfo;
  }

  parse(error: unknown): ErrorInfo {
    return parseError(error);
  }
}

export const useErrorHandlerService = () => {
  const { addMessage } = useMessageStore();
  const handler = useMemo(() => new ErrorHandlerService(addMessage), [addMessage]);
  return handler;
};

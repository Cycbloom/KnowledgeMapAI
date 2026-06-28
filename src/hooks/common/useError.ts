import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { message } from '../../utils/messageHelper';
import {
  AppError,
  ValidationError,
  wrapUnknownError,
  isAuthError,
  isNetworkError,
  isValidationError,
} from '../../utils/errors';

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

const parseError = (error: unknown): ErrorInfo => {
  const appError = wrapUnknownError(error);

  return {
    message: appError.message,
    code: appError.code,
    isAuthError: isAuthError(appError),
    isNetworkError: isNetworkError(appError),
    isValidationError: isValidationError(appError),
    details: appError instanceof ValidationError ? appError.details : undefined,
  };
};

export const useError = () => {
  const navigate = useNavigate();
  const { setUser } = useStore();

  const handleError = useCallback((error: unknown, options?: ErrorHandlerOptions | string): ErrorInfo | AppError => {
    const opts: ErrorHandlerOptions = typeof options === 'string' ? { context: options } : (options ?? {});
    const { silent = false, redirect, context, fallbackMessage } = opts;
    const errorInfo = parseError(error);
    const appError = wrapUnknownError(error);

    const prefix = context ? `[${context}] ` : '';
    console.error('[ErrorHandler]', prefix, {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
    });

    if (errorInfo.isAuthError) {
      setUser(null, null);
      if (!silent) {
        message.error(errorInfo.message, { duration: 5000 });
      }
      navigate('/login');
      return errorInfo;
    }

    const displayMessage = fallbackMessage && errorInfo.code === 'UNKNOWN_ERROR'
      ? fallbackMessage
      : errorInfo.message;

    if (!silent) {
      message.error(displayMessage, { duration: 5000 });
    }

    if (redirect) {
      navigate(redirect);
    }

    return errorInfo;
  }, [navigate, setUser]);

  const handleSilent = useCallback((error: unknown, context?: string): AppError => {
    const appError = wrapUnknownError(error);
    console.error(`[${context || 'App'}]`, appError);
    return appError;
  }, []);

  const handleAsync = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, context);
      return null;
    }
  }, [handleError]);

  const handleAsyncWithFallback = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    fallback: T,
    context?: string
  ): Promise<T> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, context);
      return fallback;
    }
  }, [handleError]);

  return {
    handleError,
    handleSilent,
    handleAsync,
    handleAsyncWithFallback,
    parseError,
  };
};

export type { ErrorHandlerOptions, ErrorInfo };

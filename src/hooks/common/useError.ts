import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { message } from '../../utils/messageHelper';
import type { MessageShowPayload } from '../../services/FrontendEventTypes';
import {
  AppError,
  ValidationError,
  wrapUnknownError,
  isAuthError,
  isNetworkError,
  isValidationError,
} from '../../utils/errors';

type MessageType = MessageShowPayload["type"];

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

  return {
    handleError,
    handleSilent,
    handleAsync,
    handleAsyncWithFallback,
    withErrorHandling,
    parseError,
  };
};

export class ErrorHandlerService {
  private publishMessage: (msg: { type: MessageType; content: string; duration?: number }) => void;

  constructor(publishMessage: (msg: { type: MessageType; content: string; duration?: number }) => void) {
    this.publishMessage = publishMessage;
  }

  handle(error: unknown, context?: string): ErrorInfo {
    const errorInfo = parseError(error);
    const prefix = context ? `[${context}] ` : '';
    console.error(`${prefix}${errorInfo.message}`, error);
    this.publishMessage({ type: 'error', content: errorInfo.message, duration: 5000 });
    return errorInfo;
  }

  parse(error: unknown): ErrorInfo {
    return parseError(error);
  }
}

export const useErrorHandlerService = () => {
  const publishMessage = useCallback((msg: { type: MessageType; content: string; duration?: number }) => {
    if (msg.type === 'success') {
      message.success(msg.content, { duration: msg.duration });
    } else if (msg.type === 'error') {
      message.error(msg.content, { duration: msg.duration });
    } else if (msg.type === 'info') {
      message.info(msg.content, { duration: msg.duration });
    } else if (msg.type === 'warning') {
      message.warning(msg.content, { duration: msg.duration });
    }
  }, []);
  const handler = useMemo(() => new ErrorHandlerService(publishMessage), [publishMessage]);
  return handler;
};

export type { ErrorHandlerOptions, ErrorInfo };

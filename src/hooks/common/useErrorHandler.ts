import { useCallback, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { frontendEventBus } from '../../services/timer/FrontendEventBus';
import type { MessageShowPayload } from '../../services/FrontendEventTypes';
import { useNavigate } from 'react-router-dom';
import {
  isAuthError,
  isNetworkError,
  isValidationError,
  wrapUnknownError,
  ValidationError,
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

export const useErrorHandler = () => {
  const navigate = useNavigate();
  const { setUser } = useStore();

  const handleError = useCallback((error: unknown, options: ErrorHandlerOptions = {}) => {
    const { silent = false, redirect, context, fallbackMessage } = options;
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
        frontendEventBus.publish("message_show", { type: 'error', content: errorInfo.message, duration: 5000 });
      }
      navigate('/login');
      return errorInfo;
    }

    const displayMessage = fallbackMessage && errorInfo.code === 'UNKNOWN_ERROR' 
      ? fallbackMessage 
      : errorInfo.message;

    if (!silent) {
      frontendEventBus.publish("message_show", { type: 'error', content: displayMessage, duration: 5000 });
    }

    if (redirect) {
      navigate(redirect);
    }

    return errorInfo;
  }, [navigate, setUser]);

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
    frontendEventBus.publish("message_show", msg);
  }, []);
  const handler = useMemo(() => new ErrorHandlerService(publishMessage), [publishMessage]);
  return handler;
};

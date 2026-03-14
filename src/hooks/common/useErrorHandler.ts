import { useCallback, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useMessageStore, MessageType } from '../../store/useMessageStore';
import { useNavigate } from 'react-router-dom';
import {
  isAuthError,
  isNetworkError,
  isValidationError,
  wrapUnknownError,
  ValidationError,
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

export const useErrorHandler = () => {
  const navigate = useNavigate();
  const { addMessage } = useMessageStore();
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

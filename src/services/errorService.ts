import { useMessageStore } from '../store/useMessageStore';

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

export class ErrorService {
  private static instance: ErrorService;
  
  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  handle(error: unknown, context?: string): AppError {
    const appError = this.normalizeError(error);
    
    console.error(`[${context || 'App'}]`, appError);
    
    const { addMessage } = useMessageStore.getState();
    
    const userMessage = this.getUserFriendlyMessage(appError);
    addMessage({
      type: 'error',
      content: userMessage,
    });
    
    return appError;
  }

  handleSilent(error: unknown, context?: string): AppError {
    const appError = this.normalizeError(error);
    console.error(`[${context || 'App'}]`, appError);
    return appError;
  }

  private normalizeError(error: unknown): AppError {
    if (this.isAppError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: this.getErrorCode(error),
        message: error.message,
        details: error.stack,
        timestamp: new Date(),
      };
    }

    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN',
        message: error,
        timestamp: new Date(),
      };
    }

    return {
      code: 'UNKNOWN',
      message: 'An unknown error occurred',
      details: error,
      timestamp: new Date(),
    };
  }

  private isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'timestamp' in error
    );
  }

  private getErrorCode(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return 'UNAUTHORIZED';
    }
    if (message.includes('forbidden') || message.includes('403')) {
      return 'FORBIDDEN';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (message.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    
    return 'UNKNOWN';
  }

  private getUserFriendlyMessage(error: AppError): string {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return '网络连接失败，请检查网络设置';
      case 'UNAUTHORIZED':
        return '登录已过期，请重新登录';
      case 'FORBIDDEN':
        return '没有权限执行此操作';
      case 'NOT_FOUND':
        return '请求的资源不存在';
      case 'TIMEOUT':
        return '请求超时，请稍后重试';
      case 'VALIDATION_ERROR':
        return '输入数据格式不正确';
      default:
        return error.message || '操作失败，请稍后重试';
    }
  }
}

export const errorService = ErrorService.getInstance();

export const handleError = (error: unknown, context?: string) => {
  return errorService.handle(error, context);
};

export const handleSilentError = (error: unknown, context?: string) => {
  return errorService.handleSilent(error, context);
};

export const createError = (code: string, message: string, details?: unknown): AppError => {
  return {
    code,
    message,
    details,
    timestamp: new Date(),
  };
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || message.includes('fetch') || message.includes('failed to fetch');
  }
  return false;
};

export const isAuthError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('unauthorized') || message.includes('401') || message.includes('forbidden');
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const appError = error as AppError;
    return appError.code === 'UNAUTHORIZED' || appError.code === 'FORBIDDEN';
  }
  return false;
};

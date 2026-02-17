import { useCallback } from 'react';
import { errorService, AppError } from '../services/errorService';

export const useError = () => {
  const handleError = useCallback((error: unknown, context?: string): AppError => {
    return errorService.handle(error, context);
  }, []);

  const handleSilent = useCallback((error: unknown, context?: string): AppError => {
    return errorService.handleSilent(error, context);
  }, []);

  const handleAsync = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      errorService.handle(error, context);
      return null;
    }
  }, []);

  const handleAsyncWithFallback = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    fallback: T,
    context?: string
  ): Promise<T> => {
    try {
      return await asyncFn();
    } catch (error) {
      errorService.handle(error, context);
      return fallback;
    }
  }, []);

  return {
    handleError,
    handleSilent,
    handleAsync,
    handleAsyncWithFallback,
  };
};

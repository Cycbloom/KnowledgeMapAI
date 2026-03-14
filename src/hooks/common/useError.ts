import { useCallback } from 'react';
import { useMessageStore } from '../../store/useMessageStore';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { AppError, wrapUnknownError, getUserFriendlyMessage, isAuthError } from '../../utils/errors';

export const useError = () => {
  const { addMessage } = useMessageStore();
  const navigate = useNavigate();
  const { setUser } = useStore();

  const handleError = useCallback((error: unknown, context?: string): AppError => {
    const appError = wrapUnknownError(error);
    
    console.error(`[${context || 'App'}]`, appError);
    
    const userMessage = getUserFriendlyMessage(appError);
    addMessage({
      type: 'error',
      content: userMessage,
    });
    
    if (isAuthError(appError)) {
      setUser(null, null);
      navigate('/login');
    }
    
    return appError;
  }, [addMessage, navigate, setUser]);

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
  };
};

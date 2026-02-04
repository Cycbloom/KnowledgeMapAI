import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { useNavigate } from 'react-router-dom';

interface ApiError {
  success: boolean;
  code: string;
  error: string;
  details?: Array<{ field: string; message: string }>;
}

interface ErrorHandlerOptions {
  silent?: boolean; // If true, only log error, don't show toast
  redirect?: string; // Redirect path after error
}

export const useErrorHandler = () => {
  const navigate = useNavigate();
  const { addMessage } = useMessageStore();
  const { setUser } = useStore();
  
  const handleError = useCallback((error: any, options: ErrorHandlerOptions = {}) => {
    const { silent = false, redirect } = options;

    console.error('[UnifiedErrorHandler]', error);

    let errorMessage = 'An unexpected error occurred';
    // let errorCode = 'INTERNAL_ERROR';

    if (error?.response?.data) {
      // Backend standardized error
      const data = error.response.data as ApiError;
      errorMessage = data.error || errorMessage;
      // errorCode = data.code || errorCode;

      // Handle specific codes
      if (error.response.status === 401) {
        // Auth error
        setUser(null, null); // Clear session
        if (!silent) {
            addMessage({ type: 'error', content: 'Session expired. Please login again.', duration: 5000 });
        }
        navigate('/login');
        return;
      }
      
      if (data.code === 'VALIDATION_ERROR' && data.details) {
         errorMessage = `Validation Error: ${data.details.map(d => d.message).join(', ')}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    if (!silent) {
      addMessage({ type: 'error', content: errorMessage, duration: 5000 });
    }

    if (redirect) {
      navigate(redirect);
    }
  }, [navigate, addMessage, setUser]);

  return { handleError };
};

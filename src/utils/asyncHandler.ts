import { frontendEventBus } from '../services/timer/FrontendEventBus';
import { isNetworkError } from './errors';

export interface AsyncOperationOptions<T = unknown> {
  loadingSetter?: (loading: boolean) => void;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  onFinally?: () => void;
}

export function createAsyncHandler() {
  return async <T>(
    operation: () => Promise<T>,
    options: AsyncOperationOptions<T> = {}
  ): Promise<T | null> => {
    const { loadingSetter, successMessage, errorMessage, onSuccess, onError, onFinally } = options;
    
    try {
      if (loadingSetter) loadingSetter(true);
      const result = await operation();
      if (successMessage) {
        frontendEventBus.publish("message_show", { type: 'success', content: successMessage });
      }
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      const error = err as Error;
      const msg = isNetworkError(error) 
        ? '网络连接失败，请检查网络' 
        : (errorMessage || error.message || '操作失败');
      frontendEventBus.publish("message_show", { type: 'error', content: msg });
      console.error(err);
      if (onError) onError(error);
      return null;
    } finally {
      if (loadingSetter) loadingSetter(false);
      if (onFinally) onFinally();
    }
  };
}

export function useAsyncOperation() {
  const handler = createAsyncHandler();
  return { execute: handler };
}

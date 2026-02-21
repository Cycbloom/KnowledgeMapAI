import { useMessageStore } from '../store/useMessageStore';
import { isNetworkError } from '../services/errorService';

export interface AsyncOperationOptions {
  loadingSetter?: (loading: boolean) => void;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onFinally?: () => void;
}

type AddMessageFunction = (message: { type: 'success' | 'error' | 'info' | 'warning'; content: string }) => string;

export function createAsyncHandler(addMessage: AddMessageFunction) {
  return async <T>(
    operation: () => Promise<T>,
    options: AsyncOperationOptions = {}
  ): Promise<T | null> => {
    const { loadingSetter, successMessage, errorMessage, onSuccess, onError, onFinally } = options;
    
    try {
      if (loadingSetter) loadingSetter(true);
      const result = await operation();
      if (successMessage) {
        addMessage({ type: 'success', content: successMessage });
      }
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      const error = err as Error;
      const msg = isNetworkError(error) 
        ? '网络连接失败，请检查网络' 
        : (errorMessage || error.message || '操作失败');
      addMessage({ type: 'error', content: msg });
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
  const { addMessage } = useMessageStore();
  const handler = createAsyncHandler(addMessage);
  return { execute: handler };
}

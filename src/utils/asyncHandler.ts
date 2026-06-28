import { message } from './messageHelper';
import { wrapUnknownError, getUserFriendlyMessage } from './errors';

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
        message.success(successMessage);
      }
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      const appError = wrapUnknownError(err);
      const msg = errorMessage || getUserFriendlyMessage(appError);
      message.error(msg);
      console.error(appError);
      if (onError) onError(appError);
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

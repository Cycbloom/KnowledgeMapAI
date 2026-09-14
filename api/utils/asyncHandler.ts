import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

/**
 * 包装异步路由处理器：将 async handler 的 rejection 传给 next(error)，
 * 由全局 errorHandler 统一处理，消除路由层重复的 try/catch + AppError 转换样板。
 *
 * - AppError 直接透传（保留状态码与错误码）
 * - 未知错误转换为 AppError(500, message)，保持与既有 catch 样板相同的
 *   对外语义（生产环境 errorHandler 会隐藏 500 的 message，包装后 message 不会泄漏）
 * - 同步抛出的错误同样被捕获
 */

/**
 * 从任意 thrown 值中提取可读的 message。
 *
 * - Error 实例 → error.message
 * - 普通对象（如 supabase-js 返回的 PostgREST 错误，非 Error 实例）→ 提取 .message 字段
 * - 其余（原始值/空对象）→ String(error) 兜底
 *
 * 避免非 Error 对象被 String() 序列化成 "[object Object]" 导致日志无法排障。
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    (error as { message: string }).message
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          if (error instanceof AppError) {
            next(error);
            return;
          }
          next(new AppError(toErrorMessage(error), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR));
        });
      }
    } catch (error: unknown) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError(toErrorMessage(error), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR));
    }
  };
}

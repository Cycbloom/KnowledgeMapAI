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
          const message = error instanceof Error ? error.message : String(error);
          next(new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR));
        });
      }
    } catch (error: unknown) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      next(new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR));
    }
  };
}

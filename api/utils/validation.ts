import { type Request, type Response, type NextFunction } from 'express';
import { type ZodSchema } from 'zod';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { AppError } from '../middleware/errorHandler';

/**
 * 验证中间件工厂函数
 * @param schema Zod 验证 schema
 * @param source 验证来源: 'body' | 'query' | 'params'，默认为 'body'
 *
 * 验证成功后，会用解析后的数据替换 req[source]
 * 验证失败时，返回 400 状态码并包含详细的错误信息
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errorMessages = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: '请求参数验证失败',
        details: errorMessages,
        statusCode: 400,
      });
    }

    // 用解析后的数据替换原始数据（可能经过 Zod 的 transform 转换）
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
};
import { type Request, type Response, type NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        // Use 400 Bad Request for validation errors
        res.status(400).json({
          error: '输入验证失败',
          details: errorMessages,
        });
      } else {
        next(error);
      }
    }
  };
};

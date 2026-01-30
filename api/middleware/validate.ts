import { type Request, type Response, type NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationSchemas = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export const validate = (schemaOrSchemas: ZodSchema | ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemaOrSchemas instanceof ZodSchema) {
        // Legacy mode: only validate body
        req.body = schemaOrSchemas.parse(req.body);
      } else {
        // Enhanced mode: validate specified parts
        const { body, query, params } = schemaOrSchemas;
        
        if (body) {
          req.body = body.parse(req.body);
        }
        if (query) {
          req.query = query.parse(req.query);
        }
        if (params) {
          req.params = params.parse(req.params);
        }
      }
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

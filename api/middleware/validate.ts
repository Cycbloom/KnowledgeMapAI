import { type Request, type Response, type NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { AppError } from './errorHandler';

type ValidationSchemas = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export const validate = (schemaOrSchemas: ZodSchema | ValidationSchemas) => {
  return (req: Request, _res: Response, next: NextFunction) => {
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
        
        throw new AppError(ErrorCodes.VALIDATION_ERROR, { details: errorMessages });
      } else {
        next(error);
      }
    }
  };
};

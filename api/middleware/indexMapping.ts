import type { Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { indexMappingService, type IndexContext } from '../services/indexMapping/IndexMappingService';

interface User {
  id: string;
  email?: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      indexContext?: IndexContext;
      supabase?: SupabaseClient;
      user?: User;
    }
  }
}

export const indexMappingMiddleware = async (
  req: import('express').Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  const supabase = req.supabase;

  if (!userId || !supabase) {
    next();
    return;
  }

  try {
    const graphIndexMap = await indexMappingService.buildGraphIndexMap(userId, supabase);

    req.indexContext = {
      graphIndexMap,
      resolveGraphId: (idxOrId) => indexMappingService.resolveGraphId(idxOrId, graphIndexMap),
    };

    next();
  } catch (error) {
    console.error('Failed to build index mapping:', error);
    next();
  }
};

export const indexMappingMiddlewareWithNodes = (graphIdParam: string = 'graphId') => {
  return async (
    req: import('express').Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = req.user?.id;
    const supabase = req.supabase;
    const graphId = req.params[graphIdParam] || req.body[graphIdParam];

    if (!userId || !supabase) {
      next();
      return;
    }

    try {
      const context = await indexMappingService.createIndexContext(
        userId,
        supabase,
        graphId
      );

      req.indexContext = context;
      next();
    } catch (error) {
      console.error('Failed to build index mapping:', error);
      next();
    }
  };
};

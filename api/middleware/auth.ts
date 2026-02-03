import { type Request, type Response, type NextFunction } from 'express';
import { supabaseAdmin, createClientWithToken } from '../supabase.js';
import { type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';

export interface AuthRequest extends Request {
  user?: any;
  supabase?: SupabaseClient;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Authorization header missing', 401, ErrorCodes.AUTH_HEADER_MISSING);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new AppError('Token missing', 401, ErrorCodes.TOKEN_MISSING);
  }

  // Use the admin client to verify the token first (stateless check or call auth api)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new AppError('Invalid token', 401, ErrorCodes.INVALID_TOKEN);
  }

  req.user = user;
  // Create a scoped client for this user to respect RLS policies
  req.supabase = createClientWithToken(token);
  
  next();
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.supabase = supabaseAdmin; // Use admin or anon client
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    req.supabase = supabaseAdmin;
    return next();
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && user) {
      req.user = user;
      req.supabase = createClientWithToken(token);
    } else {
      req.supabase = supabaseAdmin;
    }
  } catch (err) {
    req.supabase = supabaseAdmin;
  }
  
  next();
};

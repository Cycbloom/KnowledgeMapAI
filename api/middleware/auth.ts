import { type Request, type Response, type NextFunction } from 'express';
import { getSupabaseAdmin, getSupabaseAnon, createClientWithToken } from '../supabase';
import { type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errorHandler';
import { ErrorCodes, type ErrorCode } from '../../shared/types/errorCodes';

export interface AuthRequest extends Request {
  user?: any;
  supabase?: SupabaseClient;
}

interface TokenError {
  message: string;
  status: number;
  code: ErrorCode;
}

const parseTokenError = (error: { message?: string }): TokenError => {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('expired')) {
    return {
      message: 'Token has expired',
      status: 401,
      code: ErrorCodes.AUTH_TOKEN_EXPIRED,
    };
  }

  if (message.includes('invalid') || message.includes('malformed')) {
    return {
      message: 'Invalid token format',
      status: 401,
      code: ErrorCodes.AUTH_TOKEN_INVALID,
    };
  }

  if (message.includes('revoked') || message.includes('banned')) {
    return {
      message: 'Token has been revoked',
      status: 401,
      code: ErrorCodes.AUTH_TOKEN_REVOKED,
    };
  }

  return {
    message: 'Token verification failed',
    status: 401,
    code: ErrorCodes.AUTH_TOKEN_INVALID,
  };
};

export const requireAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Authorization header missing', 401, ErrorCodes.AUTH_HEADER_MISSING);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AppError('Invalid authorization header format', 401, ErrorCodes.AUTH_HEADER_MISSING);
  }

  const token = parts[1];

  if (!token) {
    throw new AppError('Token missing', 401, ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);

  if (error) {
    const tokenError = parseTokenError(error);
    throw new AppError(tokenError.message, tokenError.status, tokenError.code);
  }

  if (!user) {
    throw new AppError('User not found', 401, ErrorCodes.AUTH_TOKEN_INVALID);
  }

  req.user = user;
  req.supabase = createClientWithToken(token);
  
  next();
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.supabase = getSupabaseAnon();
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    req.supabase = getSupabaseAnon();
    return next();
  }

  const token = parts[1];

  if (!token) {
    req.supabase = getSupabaseAnon();
    return next();
  }

  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);

    if (!error && user) {
      req.user = user;
      req.supabase = createClientWithToken(token);
    } else {
      req.supabase = getSupabaseAnon();
    }
  } catch {
    req.supabase = getSupabaseAnon();
  }
  
  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    if (!req.user?.id) {
      throw new AppError('User not authenticated', 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { data: userRecord, error } = await getSupabaseAdmin()
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !userRecord) {
      throw new AppError('Failed to verify user role', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (userRecord.role === 'admin') {
      return next();
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    if (req.user.email && adminEmails.includes(req.user.email)) {
      return next();
    }
    
    throw new AppError('Admin access required', 403, ErrorCodes.AUTH_FORBIDDEN);
  });
};

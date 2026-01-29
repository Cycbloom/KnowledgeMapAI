import { type Request, type Response, type NextFunction } from 'express';
import { supabase, createClientWithToken } from '../supabase.js';
import { type SupabaseClient } from '@supabase/supabase-js';

export interface AuthRequest extends Request {
  user?: any;
  supabase?: SupabaseClient;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  // Use the global client to verify the token first
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  // Create a scoped client for this user to respect RLS policies
  req.supabase = createClientWithToken(token);
  
  next();
};

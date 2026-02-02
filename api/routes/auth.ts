import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';

const router = Router();

/**
 * User Register
 * POST /api/auth/register
 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    // Manual validation removed as it is handled by middleware

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
    });

    if (authError) {
      throw new AppError(authError.message, 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!authData.user) {
      throw new AppError('创建用户失败', 500, ErrorCodes.INTERNAL_ERROR);
    }

    // 2. Create user record in public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: email,
          password_hash: 'MANAGED_BY_SUPABASE_AUTH', // We don't store actual hash here
          name: name,
        },
      ]);

    if (dbError) {
      // Cleanup auth user if db insert fails (optional but good practice)
      // await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(500).json({ error: '创建用户资料失败: ' + dbError.message });
      return;
    }

    res.status(201).json({ user: authData.user, session: authData.session });
  } catch (error: any) {
    console.error('Register error:', error);
    throw new AppError(error.message || '内部服务器错误', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    // Manual validation removed as it is handled by middleware

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    // Auto-repair: Ensure public.users record exists
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      console.log(`[Auth] Repairing missing public profile for user ${data.user.id}`);
      await supabaseAdmin.from('users').insert([
        {
          id: data.user.id,
          email: email,
          name: data.user.user_metadata?.name || 'Restored User',
          password_hash: 'MANAGED_BY_SUPABASE_AUTH'
        }
      ]);
    }

    res.json({ user: data.user, session: data.session });
  } catch (error: any) {
    console.error('Login error:', error);
    next(error);
  }
});

/**
 * Refresh Token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token missing', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new AppError(error.message || 'Session refresh failed', 401, ErrorCodes.INVALID_TOKEN);
    }

    if (!data.session) {
       throw new AppError('Session refresh failed', 401, ErrorCodes.INVALID_TOKEN);
    }

    res.json({ session: data.session, user: data.user });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    next(error);
  }
});

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const { error } = await supabaseAdmin.auth.signOut();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: 'Logged out successfully' });
});

/**
 * Get Current User
 * GET /api/auth/user
 */
router.get('/user', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  // Fetch detailed profile from public.users
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ user: { ...req.user, profile: data } });
});

/**
 * Update Profile (Settings)
 * PUT /api/auth/profile
 */
router.put('/profile', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, settings } = req.body;
  const updates: any = {};
  
  if (name !== undefined) updates.name = name;
  if (settings !== undefined) updates.settings = settings;

  if (Object.keys(updates).length === 0) {
    res.json({ message: 'No updates provided' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    throw new AppError(error.message || '更新个人资料失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  res.json({ user: { ...req.user, profile: data } });
});

export default router;

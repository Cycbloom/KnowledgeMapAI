import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { authService } from '../services/core/authService.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../../shared/types/errorCodes.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response, _next: import('express').NextFunction): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password, name } = req.body;
    
    logger.info('Register attempt', {
      requestId,
      email: email?.substring(0, 3) + '***',
      hasName: !!name,
      passwordLength: password?.length || 0,
    });

    if (!email || !password || !name) {
      logger.warn('Register validation failed: missing fields', { requestId });
      throw new AppError('请填写所有必填字段', 400, ErrorCodes.VALIDATION_ERROR);
    }

    logger.info('Calling Supabase signUp', { requestId, email: email?.substring(0, 3) + '***' });
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (authError) {
      logger.error('Supabase signUp error', {
        requestId,
        error: authError,
        errorMessage: authError.message,
        errorCode: (authError as any).code,
        errorStatus: (authError as any).status,
      });
      
      const errorMap: Record<string, { message: string; status: number }> = {
        'user_already_exists': { message: '该邮箱已被注册', status: 409 },
        'email_address_invalid': { message: '邮箱格式不正确', status: 400 },
        'invalid_password': { message: '密码不符合要求，请确保密码至少8位，包含大小写字母和数字', status: 400 },
        'weak_password': { message: '密码强度不足，请使用更复杂的密码', status: 400 },
        'signup_disabled': { message: '注册功能已禁用，请联系管理员', status: 403 },
        'email_not_confirmed': { message: '请检查邮箱完成验证', status: 200 },
      };
      
      const errorCode = (authError as any).code || '';
      const mappedError = errorMap[errorCode];
      
      if (mappedError) {
        throw new AppError(mappedError.message, mappedError.status, ErrorCodes.VALIDATION_ERROR);
      }
      
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        throw new AppError('该邮箱已被注册', 409, ErrorCodes.VALIDATION_ERROR);
      }
      
      if (authError.message.includes('password')) {
        throw new AppError('密码不符合要求，请确保密码至少8位，包含大小写字母和数字', 400, ErrorCodes.VALIDATION_ERROR);
      }
      
      throw new AppError(authError.message, 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!authData.user) {
      logger.error('Supabase signUp returned no user', { requestId, authData });
      throw new AppError('创建用户失败，请稍后重试', 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info('User created successfully', {
      requestId,
      userId: authData.user.id,
      email: authData.user.email?.substring(0, 3) + '***',
      hasSession: !!authData.session,
    });

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          name,
          password_hash: 'MANAGED_BY_SUPABASE_AUTH',
        },
      ]);

    if (profileError) {
      logger.warn('Failed to create user profile, may already exist', {
        requestId,
        userId: authData.user.id,
        error: profileError,
      });
    }

    let session = authData.session;
    if (!session) {
      logger.info('No session returned, attempting to sign in', { requestId });
      
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        logger.error('Auto sign-in after registration failed', {
          requestId,
          error: signInError,
          errorMessage: signInError.message,
        });
        res.status(201).json({ 
          user: authData.user, 
          session: null,
          message: '注册成功，请登录' 
        });
        return;
      }

      session = signInData.session;
      logger.info('Auto sign-in successful', { requestId, hasSession: !!session });
    }

    res.status(201).json({ user: authData.user, session });
  } catch (error: unknown) {
    logger.error('Register error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : '内部服务器错误';
    throw new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: import('express').NextFunction): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password } = req.body;
    
    logger.info('Login attempt', {
      requestId,
      email: email?.substring(0, 3) + '***',
      hasPassword: !!password,
    });

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error('Supabase signIn error', {
        requestId,
        error: error,
        errorMessage: error.message,
        errorCode: (error as any).code,
        errorStatus: (error as any).status,
      });
      res.status(401).json({ error: error.message });
      return;
    }

    logger.info('Login successful', {
      requestId,
      userId: data.user.id,
      email: data.user.email?.substring(0, 3) + '***',
    });

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      logger.info('Repairing missing public profile for user', { requestId, userId: data.user.id });
      await supabaseAdmin.from('users').insert([
        {
          id: data.user.id,
          email,
          name: data.user.user_metadata?.name || 'Restored User',
          password_hash: 'MANAGED_BY_SUPABASE_AUTH'
        }
      ]);
    }

    res.json({ user: data.user, session: data.session });
  } catch (error: unknown) {
    logger.error('Login error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
});

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
  } catch (error: unknown) {
    logger.error('Refresh token error:', error);
    next(error);
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const { error } = await supabaseAdmin.auth.admin.signOut(req.user.id);

    if (error) {
      throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/user', requireAuth, async (req: AuthRequest, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.json({ user: { ...req.user, profile } });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const { name, settings } = req.body;
    const profile = await authService.updateProfile(req.user.id, { name, settings });
    res.json({ user: { ...req.user, profile } });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../supabase';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { authService } from '../services/core/authService';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes, type ErrorCode } from '../../shared/types/errorCodes';
import { logger } from '../utils/logger';

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
    
    const { data: authData, error: authError } = await getSupabaseAdmin().auth.signUp({
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
      
      const errorMap: Record<string, ErrorCode> = {
        'user_already_exists': ErrorCodes.EMAIL_ALREADY_EXISTS,
        'email_address_invalid': ErrorCodes.INVALID_EMAIL,
        'invalid_password': ErrorCodes.PASSWORD_REQUIREMENTS,
        'weak_password': ErrorCodes.WEAK_PASSWORD,
        'signup_disabled': ErrorCodes.SIGNUP_DISABLED,
      };
      
      const supabaseErrorCode = (authError as any).code || '';
      const errorCode = errorMap[supabaseErrorCode];
      
      if (errorCode) {
        throw new AppError(errorCode);
      }
      
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        throw new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS);
      }
      
      if (authError.message.includes('password')) {
        throw new AppError(ErrorCodes.PASSWORD_REQUIREMENTS);
      }
      
      throw new AppError(ErrorCodes.REGISTER_FAILED);
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

    const { error: profileError } = await getSupabaseAdmin()
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
      
      const { data: signInData, error: signInError } = await getSupabaseAdmin().auth.signInWithPassword({
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

    const { data, error } = await getSupabaseAdmin().auth.signInWithPassword({
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
      
      const errorMap: Record<string, ErrorCode> = {
        'invalid_credentials': ErrorCodes.INVALID_CREDENTIALS,
        'invalid_login_credentials': ErrorCodes.INVALID_CREDENTIALS,
        'email_not_confirmed': ErrorCodes.EMAIL_NOT_CONFIRMED,
        'too_many_requests': ErrorCodes.TOO_MANY_REQUESTS,
        'user_not_found': ErrorCodes.USER_NOT_FOUND,
        'invalid_password': ErrorCodes.INVALID_CREDENTIALS,
        'sign_in_not_allowed': ErrorCodes.AUTH_FORBIDDEN,
      };
      
      const supabaseErrorCode = (error as any).code || '';
      const errorCode = errorMap[supabaseErrorCode] || ErrorCodes.LOGIN_FAILED;
      
      throw new AppError(errorCode);
    }

    logger.info('Login successful', {
      requestId,
      userId: data.user.id,
      email: data.user.email?.substring(0, 3) + '***',
    });

    const { data: existingProfile } = await getSupabaseAdmin()
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      logger.info('Repairing missing public profile for user', { requestId, userId: data.user.id });
      await getSupabaseAdmin().from('users').insert([
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
      throw new AppError(ErrorCodes.MISSING_REFRESH_TOKEN);
    }

    const { data, error } = await getSupabaseAdmin().auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new AppError(ErrorCodes.TOKEN_REFRESH_EXPIRED);
    }

    if (!data.session) {
       throw new AppError(ErrorCodes.SESSION_REFRESH_FAILED);
    }

    res.json({ session: data.session, user: data.user });
  } catch (error: unknown) {
    logger.error('Refresh token error:', error);
    next(error);
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    const { error } = await getSupabaseAdmin().auth.admin.signOut(req.user.id);

    if (error) {
      throw new AppError(ErrorCodes.LOGOUT_FAILED);
    }

    res.json({ message: '退出登录成功' });
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

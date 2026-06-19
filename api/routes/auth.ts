import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../supabase';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { authService, authRouteService } from '../services/core';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
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

    const admin = getSupabaseAdmin();
    const result = await authRouteService.signUp(admin, email, password, name);

    logger.info('User created successfully', {
      requestId,
      userId: result.user?.id,
      hasSession: !!result.session,
    });

    await authRouteService.createUserProfile(admin, result.user!.id, email, name);

    let session = result.session;
    if (!session) {
      logger.info('No session returned, attempting to sign in', { requestId });
      
      try {
        const signInResult = await authRouteService.signInWithPassword(admin, email, password);
        session = signInResult.session;
        logger.info('Auto sign-in successful', { requestId, hasSession: !!session });
      } catch {
        logger.error('Auto sign-in after registration failed', { requestId });
        res.status(201).json({ 
          user: result.user, 
          session: null,
          message: '注册成功，请登录' 
        });
        return;
      }
    }

    res.status(201).json({ user: result.user, session });
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

    const admin = getSupabaseAdmin();
    const result = await authRouteService.signInWithPassword(admin, email, password);

    logger.info('Login successful', {
      requestId,
      userId: result.user.id,
      email: result.user.email?.substring(0, 3) + '***',
    });

    await authRouteService.ensureUserProfile(
      admin,
      result.user.id,
      email,
      result.user.user_metadata?.name as string || 'Restored User',
    );

    res.json({ user: result.user, session: result.session });
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

    const result = await authRouteService.refreshSession(getSupabaseAdmin(), refreshToken);

    res.json({ session: result.session, user: result.user });
  } catch (error: unknown) {
    logger.error('Refresh token error:', error);
    next(error);
  }
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response, next: import('express').NextFunction): Promise<void> => {
  try {
    await authRouteService.signOut(getSupabaseAdmin(), req.user.id);

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

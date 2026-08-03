import { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../../supabase';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import { authService, authRouteService } from '../../services/core';
import { validate } from '../../middleware/validate';
import { validate as validateInput } from '../../utils/validation';
import * as v2Schemas from '../../utils/schemas';
import { registerSchema, loginSchema, updateProfileSchema } from '../../schemas/index';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { validatePassword } from '../../../shared/utils/passwordPolicy';
import { logger } from '../../utils/logger';
import { logSecurityEvent, createSecurityEvent } from '../../services/audit/auditService';

const router = Router();

/** 密码复杂度校验中间件 */
function validatePasswordMiddleware(req: Request, _res: Response, next: () => void): void {
  const { password } = req.body;
  if (password) {
    const result = validatePassword(password);
    if (!result.valid) {
      throw new AppError('密码不符合复杂度要求', 400, ErrorCodes.PASSWORD_REQUIREMENTS);
    }
  }
  next();
}

router.post('/register', validateInput(v2Schemas.registerUserSchema), validate(registerSchema), validatePasswordMiddleware, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  const { email, password, name } = req.body;

  logger.info('Register attempt', {
    requestId,
    email: `${email?.substring(0, 3)  }***`,
    hasName: !!name,
    passwordLength: password?.length || 0,
  });

  if (!email || !password || !name) {
    logger.warn('Register validation failed: missing fields', { requestId });
    throw new AppError('请填写所有必填字段', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // admin client: 注册流程无已认证会话，无 req.supabase 可用，需使用 admin client 创建用户与档案
  const admin = getSupabaseAdmin();
  const result = await authRouteService.signUp(admin, email, password, name);

  logger.info('User created successfully', {
    requestId,
    userId: result.user?.id,
    hasSession: !!result.session,
  });

  if (!result.user) {
    throw new AppError('用户创建失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  await authRouteService.createUserProfile(admin, result.user.id, email, name);

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
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  const { email, password } = req.body;

  logger.info('Login attempt', {
    requestId,
    email: `${email?.substring(0, 3)  }***`,
    hasPassword: !!password,
  });

  try {
    // admin client: 登录流程无已认证会话，无 req.supabase 可用，需使用 admin client 验证凭据并补建档案
    const admin = getSupabaseAdmin();
    const result = await authRouteService.signInWithPassword(admin, email, password);

    logger.info('Login successful', {
      requestId,
      userId: result.user.id,
      email: `${result.user.email?.substring(0, 3)  }***`,
    });

    await logSecurityEvent(createSecurityEvent('LOGIN_SUCCESS', req, {
      email: email?.substring(0, 3) ? `${email.substring(0, 3)}***` : undefined,
    }));

    await authRouteService.ensureUserProfile(
      admin,
      result.user.id,
      email,
      result.user.user_metadata?.name as string || 'Restored User',
    );

    res.json({ user: result.user, session: result.session });
  } catch (error) {
    await logSecurityEvent(createSecurityEvent('LOGIN_FAILURE', req, {
      email: email?.substring(0, 3) ? `${email.substring(0, 3)}***` : undefined,
      error: error instanceof AppError ? error.message : 'Unknown error',
    }));
    throw error;
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError(ErrorCodes.MISSING_REFRESH_TOKEN);
  }

  // admin client: 需跨用户验证 refresh token，无已认证会话，必须使用 admin client
  const result = await authRouteService.refreshSession(getSupabaseAdmin(), refreshToken);

  res.json({ session: result.session, user: result.user });
});

router.post('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  // admin client: 注销需撤销用户会话（session 管理），需 service role 权限，不能使用 user-scoped client
  await authRouteService.signOut(getSupabaseAdmin(), req.user.id);

  await logSecurityEvent(createSecurityEvent('LOGOUT', req));

  res.json({ message: '退出登录成功' });
});

router.get('/user', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await authService.getProfile(req.user.id);
  res.json({ user: { ...req.user, profile } });
});

router.put('/profile', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, settings } = req.body;
  const profile = await authService.updateProfile(req.user.id, { name, settings });
  res.json({ user: { ...req.user, profile } });
});

export default router;

import { Router, type Request, type Response } from 'express';
import { passwordService, jwtService, localUserService } from '../services/auth/index.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';
import { excludePassword } from '../models/user.js';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password, name } = req.body;

    logger.info('Local register attempt', {
      requestId,
      email: email?.substring(0, 3) + '***',
      hasName: !!name,
    });

    const existingUser = await localUserService.findByEmail(email);
    if (existingUser) {
      throw new AppError('该邮箱已被注册', 409, ErrorCodes.VALIDATION_ERROR);
    }

    const hashedPassword = await passwordService.hashPassword(password);
    const user = await localUserService.create({ email, password, name }, hashedPassword);

    const tokens = jwtService.generateToken(excludePassword(user));

    logger.info('Local user registered successfully', {
      requestId,
      userId: user.id,
      email: user.email?.substring(0, 3) + '***',
    });

    res.status(201).json({
      user: excludePassword(user),
      session: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: tokens.expiresIn,
        token_type: 'bearer',
      },
    });
  } catch (error: unknown) {
    logger.error('Local register error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('注册失败，请稍后重试', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const { email, password } = req.body;

    logger.info('Local login attempt', {
      requestId,
      email: email?.substring(0, 3) + '***',
    });

    const user = await localUserService.findByEmail(email);
    if (!user) {
      throw new AppError('邮箱或密码错误', 401, ErrorCodes.UNAUTHORIZED);
    }

    const isValidPassword = await passwordService.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('邮箱或密码错误', 401, ErrorCodes.UNAUTHORIZED);
    }

    const tokens = jwtService.generateToken(excludePassword(user));

    logger.info('Local login successful', {
      requestId,
      userId: user.id,
      email: user.email?.substring(0, 3) + '***',
    });

    res.json({
      user: excludePassword(user),
      session: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: tokens.expiresIn,
        token_type: 'bearer',
      },
    });
  } catch (error: unknown) {
    logger.error('Local login error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('登录失败，请稍后重试', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/logout', (_req: Request, res: Response): Promise<void> => {
  res.json({ message: '登出成功' });
  return Promise.resolve();
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError('缺少认证头', 401, ErrorCodes.AUTH_HEADER_MISSING);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new AppError('无效的认证头格式', 401, ErrorCodes.AUTH_HEADER_MISSING);
    }

    const token = parts[1];
    const payload = jwtService.verifyToken(token);

    if (!payload) {
      throw new AppError('无效或过期的令牌', 401, ErrorCodes.INVALID_TOKEN);
    }

    const user = await localUserService.findById(payload.userId);
    if (!user) {
      throw new AppError('用户不存在', 404, ErrorCodes.RESOURCE_USER_NOT_FOUND);
    }

    res.json({ user: excludePassword(user) });
  } catch (error: unknown) {
    logger.error('Get current user error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('获取用户信息失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('缺少刷新令牌', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const tokens = jwtService.refreshAccessToken(refreshToken);
    if (!tokens) {
      throw new AppError('无效或过期的刷新令牌', 401, ErrorCodes.INVALID_TOKEN);
    }

    res.json({
      session: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: tokens.expiresIn,
        token_type: 'bearer',
      },
    });
  } catch (error: unknown) {
    logger.error('Refresh token error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('刷新令牌失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'unknown';
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError('缺少认证头', 401, ErrorCodes.AUTH_HEADER_MISSING);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new AppError('无效的认证头格式', 401, ErrorCodes.AUTH_HEADER_MISSING);
    }

    const token = parts[1];
    const payload = jwtService.verifyToken(token);

    if (!payload) {
      throw new AppError('无效或过期的令牌', 401, ErrorCodes.INVALID_TOKEN);
    }

    const { name, settings } = req.body;
    const user = await localUserService.update(payload.userId, { name, settings });

    logger.info('Profile updated', {
      requestId,
      userId: user.id,
    });

    res.json({ user: excludePassword(user) });
  } catch (error: unknown) {
    logger.error('Update profile error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('更新资料失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;

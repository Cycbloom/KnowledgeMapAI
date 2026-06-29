import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../utils/logger';
import { createRateLimitStore, type RateLimitStore } from './rateLimitStore';

const isRateLimitDisabled = () => {
  return process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test';
};

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
  skipFailedRequests?: boolean;
}

const rateLimitStore: RateLimitStore = createRateLimitStore();

export const destroyRateLimiter = (): void => {
  rateLimitStore.destroy();
};

export const createRateLimiter = (config: RateLimitConfig) => {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    message = '请求过于频繁，请稍后再试',
    skipFailedRequests = false,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (isRateLimitDisabled()) {
      logger.info('Rate limit disabled for testing');
      return next();
    }

    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = userId ? `${keyPrefix}:user:${userId}` : `${keyPrefix}:ip:${ip}`;

    const now = Date.now();

    try {
      const entry = await rateLimitStore.increment(key, windowMs);
      const count = entry.count;
      const resetTime = entry.resetTime;

      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', retryAfter.toString());

        return res.status(429).json({
          success: false,
          error: message,
          retryAfter,
        });
      }

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(windowMs / 1000).toString());

      if (skipFailedRequests) {
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            rateLimitStore
              .decrement(key)
              .catch((err) => logger.error('Rate limit decrement error:', err));
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      next();
    }
  };
};

export const rateLimiters = {
  general: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'rl:general',
    message: '请求过于频繁，请稍后再试',
  }),

  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'rl:auth',
    message: '登录尝试次数过多，请15分钟后再试',
    skipFailedRequests: false,
  }),

  ai: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'rl:ai',
    message: 'AI 请求过于频繁，请稍后再试',
  }),

  aiHeavy: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 1000,
    keyPrefix: 'rl:ai:heavy',
    message: 'AI 生成请求达到上限，请1小时后再试',
  }),

  write: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'rl:write',
    message: '写入操作过于频繁，请稍后再试',
  }),
};

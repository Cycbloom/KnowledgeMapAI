import { type Request, type Response, type NextFunction } from 'express';
import redisClient from '../utils/redis.js';
import { logger } from '../utils/logger.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
  skipFailedRequests?: boolean;
}

const localStore = new Map<string, { count: number; resetTime: number }>();

const cleanupLocalStore = () => {
  const now = Date.now();
  for (const [key, value] of localStore.entries()) {
    if (value.resetTime < now) {
      localStore.delete(key);
    }
  }
};

setInterval(cleanupLocalStore, 60000);

export const createRateLimiter = (config: RateLimitConfig) => {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    message = '请求过于频繁，请稍后再试',
    skipFailedRequests = false,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = userId ? `${keyPrefix}:user:${userId}` : `${keyPrefix}:ip:${ip}`;

    const now = Date.now();
    const resetTime = now + windowMs;

    try {
      if (redisClient) {
        const current = await redisClient.get(key);
        let count = current ? parseInt(current, 10) : 0;

        if (count === 0) {
          await redisClient.setex(key, Math.ceil(windowMs / 1000), '1');
          count = 1;
        } else if (count >= maxRequests) {
          const ttl = await redisClient.ttl(key);
          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', ttl.toString());
          
          logger.warn(`Rate limit exceeded for ${key}`, { count, maxRequests });
          return res.status(429).json({
            success: false,
            error: message,
            retryAfter: ttl,
          });
        } else {
          await redisClient.incr(key);
          count++;
        }

        const ttl = await redisClient.ttl(key);
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
        res.setHeader('X-RateLimit-Reset', ttl.toString());
      } else {
        const stored = localStore.get(key);
        let count = 1;

        if (stored && stored.resetTime > now) {
          count = stored.count + 1;
          if (count > maxRequests) {
            const retryAfter = Math.ceil((stored.resetTime - now) / 1000);
            res.setHeader('X-RateLimit-Limit', maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', retryAfter.toString());
            
            return res.status(429).json({
              success: false,
              error: message,
              retryAfter,
            });
          }
          stored.count = count;
        } else {
          localStore.set(key, { count: 1, resetTime });
        }

        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(windowMs / 1000).toString());
      }

      if (skipFailedRequests) {
        res.on('finish', () => {
          if (res.statusCode >= 400 && redisClient) {
            redisClient.decr(key).catch(() => {});
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
    maxRequests: 50,
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

import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import redisClient from '../utils/redis.js';

interface RequestLog {
  method: string;
  path: string;
  status: number;
  duration: number;
  userId?: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
}

const LOG_BUFFER: RequestLog[] = [];
const FLUSH_INTERVAL = 5000;
const MAX_BUFFER_SIZE = 100;

const shouldSkip = (path: string): boolean => {
  const skipPatterns = [
    '/health',
    '/api-docs',
    '/favicon',
    '/assets',
    '/__vite',
  ];
  return skipPatterns.some(pattern => path.startsWith(pattern));
};

const sanitizePath = (path: string): string => {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
};

const flushLogs = async () => {
  if (LOG_BUFFER.length === 0) return;

  const logs = [...LOG_BUFFER];
  LOG_BUFFER.length = 0;

  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline();
      const now = Date.now();
      
      logs.forEach(log => {
        const key = `logs:${log.method}:${sanitizePath(log.path)}:${now}`;
        pipeline.setex(key, 86400, JSON.stringify(log));
      });

      await pipeline.exec();
    } catch (error) {
      logger.error('Failed to flush logs to Redis:', error);
    }
  }
};

setInterval(flushLogs, FLUSH_INTERVAL);

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (shouldSkip(req.path)) {
    return next();
  }

  const startTime = Date.now();
  const originalEnd = res.end;

  (res as any).end = function (this: Response, ...args: unknown[]): void {
    const duration = Date.now() - startTime;
    const userId = (req as any).user?.id;

    const log: RequestLog = {
      method: req.method,
      path: sanitizePath(req.path),
      status: res.statusCode,
      duration,
      userId,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };

    if (LOG_BUFFER.length >= MAX_BUFFER_SIZE) {
      flushLogs().catch(() => {});
    }

    LOG_BUFFER.push(log);

    if (process.env.NODE_ENV === 'development' || res.statusCode >= 400) {
      const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel](`${req.method} ${req.path}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        userId,
      });
    }

    (originalEnd as (...args: unknown[]) => void).apply(this, args);
  };

  next();
};

export const getRequestStats = async (minutes: number = 60): Promise<{
  total: number;
  byEndpoint: Record<string, number>;
  byStatus: Record<number, number>;
  avgDuration: number;
  errorRate: number;
}> => {
  const now = Date.now();
  const since = now - minutes * 60 * 1000;

  const stats = {
    total: 0,
    byEndpoint: {} as Record<string, number>,
    byStatus: {} as Record<number, number>,
    avgDuration: 0,
    errorRate: 0,
  };

  if (redisClient) {
    try {
      const keys = await redisClient.keys('logs:*');
      let totalDuration = 0;
      let errorCount = 0;

      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const log: RequestLog = JSON.parse(data);
          if (new Date(log.timestamp).getTime() >= since) {
            stats.total++;
            totalDuration += log.duration;
            
            if (log.status >= 400) {
              errorCount++;
            }

            const endpoint = `${log.method} ${log.path}`;
            stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] || 0) + 1;
            stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
          }
        }
      }

      stats.avgDuration = stats.total > 0 ? Math.round(totalDuration / stats.total) : 0;
      stats.errorRate = stats.total > 0 ? Math.round((errorCount / stats.total) * 100) : 0;
    } catch (error) {
      logger.error('Failed to get request stats:', error);
    }
  }

  return stats;
};

export const slowRequestLogger = (thresholdMs: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (duration > thresholdMs) {
        logger.warn(`Slow request: ${req.method} ${req.path}`, {
          duration: `${duration}ms`,
          status: res.statusCode,
          userId: (req as any).user?.id,
        });
      }
    });

    next();
  };
};

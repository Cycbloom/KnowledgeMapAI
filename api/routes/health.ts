import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';
import { healthService } from '../services/healthService.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

router.get('/overview', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const overview = await healthService.getOverview(supabase, req.user.id);
    res.json(overview);
  } catch (error: any) {
    logger.error('Health Overview Error:', error);
    throw new AppError(error.message || '获取健康概览失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/heatmap', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const heatmap = await healthService.getHeatmap(supabase, req.user.id);
    res.json({ heatmap });
  } catch (error: any) {
    logger.error('Heatmap Error:', error);
    throw new AppError(error.message || '获取热力图失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/weak-points', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const weakPoints = await healthService.getWeakPoints(supabase, req.user.id);
    res.json({ weakPoints });
  } catch (error: any) {
    logger.error('Weak Points Error:', error);
    throw new AppError(error.message || '获取薄弱点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/weekly-activity', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const days = parseInt(req.query.days as string) || 7;
    const activity = await healthService.getActivity(supabase, req.user.id, days);
    res.json({ activity });
  } catch (error: any) {
    logger.error('Weekly Activity Error:', error);
    throw new AppError(error.message || '获取活动数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/predictions', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const predictions = await healthService.getPredictions(supabase, req.user.id);
    res.json({ predictions });
  } catch (error: any) {
    logger.error('Predictions Error:', error);
    throw new AppError(error.message || '获取预测数据失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/system', async (req, res) => {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latency?: number; message?: string }> = {};

  const dbStart = Date.now();
  try {
    const { error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (error) {
      checks.database = { status: 'error', message: error.message };
    } else {
      checks.database = { status: 'ok', latency: Date.now() - dbStart };
    }
  } catch (e) {
    checks.database = { status: 'error', message: String(e) };
  }

  const redisStart = Date.now();
  try {
    const { default: redisClient } = await import('../utils/redis.js');
    if (redisClient) {
      await redisClient.ping();
      checks.redis = { status: 'ok', latency: Date.now() - redisStart };
    } else {
      checks.redis = { status: 'ok', message: 'Not configured (using in-memory fallback)' };
    }
  } catch (e) {
    checks.redis = { status: 'error', message: String(e) };
  }

  checks.memory = {
    status: 'ok',
    message: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
  };

  checks.uptime = {
    status: 'ok',
    message: `${Math.floor(process.uptime())}s`,
  };

  const allOk = Object.values(checks).every(c => c.status === 'ok');
  const responseTime = Date.now() - startTime;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
  });
});

export default router;

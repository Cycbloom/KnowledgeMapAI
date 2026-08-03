import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { logger } from '../../utils/logger';
import { healthService } from "../../services/core";

const router = Router();

router.get('/overview', requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;

  try {
    const overview = await healthService.getOverview(supabase, req.user.id);
    res.json(overview);
  } catch (error) {
    logger.error('Health Overview Error:', error);
    throw new AppError((error as Error).message || '获取健康概览失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/heatmap', requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;

  try {
    const heatmap = await healthService.getHeatmap(supabase, req.user.id);
    res.json({ heatmap });
  } catch (error) {
    logger.error('Heatmap Error:', error);
    throw new AppError((error as Error).message || '获取热力图失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/weak-points', requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;

  try {
    const weakPoints = await healthService.getWeakPoints(supabase, req.user.id);
    res.json({ weakPoints });
  } catch (error) {
    logger.error('Weak Points Error:', error);
    throw new AppError((error as Error).message || '获取薄弱点失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/weekly-activity', requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;

  try {
    const days = parseInt(req.query.days as string) || 7;
    const activity = await healthService.getActivity(supabase, req.user.id, days);
    res.json({ activity });
  } catch (error) {
    logger.error('Weekly Activity Error:', error);
    throw new AppError((error as Error).message || '获取活动数据失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/predictions', requireAuth, async (req: AuthedRequest, res: Response) => {
  const supabase = req.supabase;

  try {
    const predictions = await healthService.getPredictions(supabase, req.user.id);
    res.json({ predictions });
  } catch (error) {
    logger.error('Predictions Error:', error);
    throw new AppError((error as Error).message || '获取预测数据失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/system', async (_req, res) => {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latency?: number; message?: string }> = {};

  const dbCheck = await healthService.checkDatabaseHealth();
  checks.database = dbCheck;

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

router.get('/env', async (_req, res) => {
  const envChecks: Record<string, { configured: boolean; source?: string; note?: string }> = {};

  const requiredEnvVars = [
    { key: 'VITE_SUPABASE_URL', description: 'Supabase项目URL' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase服务角色密钥' },
    { key: 'VITE_SUPABASE_ANON_KEY', description: 'Supabase匿名密钥' },
  ];

  const optionalEnvVars = [
    { key: 'DEEPSEEK_API_KEY', description: 'DeepSeek API密钥' },
    { key: 'VOLCENGINE_API_KEY', description: '火山引擎API密钥' },
    { key: 'ALIYUN_API_KEY', description: '阿里云API密钥' },
    { key: 'FRONTEND_URL', description: '前端URL (CORS)' },
    { key: 'NODE_ENV', description: '运行环境' },
  ];

  for (const { key, description } of requiredEnvVars) {
    const value = process.env[key];
    envChecks[key] = {
      configured: !!value && value.length > 0,
      note: description,
    };
  }

  for (const { key, description } of optionalEnvVars) {
    const value = process.env[key];
    envChecks[key] = {
      configured: !!value && value.length > 0,
      note: description,
    };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  let supabaseKeyCheck = { valid: false, type: 'unknown', error: '' };
  if (anonKey) {
    try {
      const parts = anonKey.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        supabaseKeyCheck = {
          valid: true,
          type: payload.role || 'unknown',
          error: payload.role === 'service_role' 
            ? 'WARNING: Using service_role key as anon key - this is insecure!' 
            : '',
        };
      }
    } catch (_e) {
      supabaseKeyCheck = { valid: false, type: 'parse_error', error: 'Invalid JWT format' };
    }
  }

  const missingRequired = requiredEnvVars
    .filter(({ key }) => !process.env[key])
    .map(({ key }) => key);

  res.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    envVars: envChecks,
    supabase: {
      urlConfigured: !!supabaseUrl,
      urlValid: supabaseUrl ? supabaseUrl.startsWith('https://') : false,
      anonKeyConfigured: !!anonKey,
      anonKeyType: supabaseKeyCheck.type,
      anonKeyWarning: supabaseKeyCheck.error,
    },
    missingRequired,
    status: missingRequired.length === 0 ? 'ok' : 'error',
    message: missingRequired.length > 0 
      ? `缺少必需的环境变量: ${missingRequired.join(', ')}` 
      : '所有必需环境变量已配置',
  });
});

export default router;

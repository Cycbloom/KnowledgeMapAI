import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { performanceMonitor } from '../../services/ai';
import type { GetPerformanceLogsQuery } from '@shared/types';

const router = Router();

// AI 用量/成本日志与数据库统计属于敏感监控数据，要求已认证访问
router.use(requireAuth);

router.get('/logs', async (req, res) => {
  const query: GetPerformanceLogsQuery = {
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    operation: req.query.operation as string,
    provider: req.query.provider as GetPerformanceLogsQuery['provider'],
    success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
    startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
  };

  const result = await performanceMonitor.getLogs(query);
  res.json(result);
});

router.get('/historical-logs', async (req, res) => {
  const query: GetPerformanceLogsQuery & { days?: number } = {
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    operation: req.query.operation as string,
    provider: req.query.provider as GetPerformanceLogsQuery['provider'],
    success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
    days: req.query.days ? parseInt(req.query.days as string) : undefined,
  };

  const result = await performanceMonitor.getHistoricalLogs(query);
  res.json(result);
});

router.get('/database-stats', async (_req, res) => {
  const stats = await performanceMonitor.getDatabaseStats();
  res.json(stats);
});

router.get('/stats', async (req, res) => {
  const query: GetPerformanceLogsQuery = {
    startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
  };

  const stats = await performanceMonitor.getStats(query);
  res.json(stats);
});

router.delete('/logs', async (req, res) => {
  const beforeTimestamp = req.query.beforeTimestamp
    ? parseInt(req.query.beforeTimestamp as string)
    : undefined;

  const deletedCount = await performanceMonitor.clearLogs(beforeTimestamp);
  
  // 返回数据库统计信息
  let dbStats = null;
  try {
    dbStats = await performanceMonitor.getDatabaseStats();
  } catch (_error) {
    // 忽略错误
  }
  
  res.json({ 
    deleted: deletedCount,
    databaseStats: dbStats
  });
});

export default router;

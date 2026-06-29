import { Router } from 'express';
import { performanceMonitor } from '../../services/ai';
import type { GetPerformanceLogsQuery } from '@shared/types';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

const router = Router();

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
  try {
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
  } catch (error) {
    throw new AppError('Failed to fetch historical logs', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/database-stats', async (_req, res) => {
  try {
    const stats = await performanceMonitor.getDatabaseStats();
    res.json(stats);
  } catch (error) {
    throw new AppError('Failed to fetch database stats', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
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
  } catch (error) {
    // 忽略错误
  }
  
  res.json({ 
    deleted: deletedCount,
    databaseStats: dbStats
  });
});

export default router;

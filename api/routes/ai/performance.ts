import { Router } from 'express';
import { performanceMonitor } from '../../services/ai/performanceMonitor';
import type { GetPerformanceLogsQuery } from '@shared/types';

const router = Router();

router.get('/logs', (req, res) => {
  const query: GetPerformanceLogsQuery = {
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    operation: req.query.operation as string,
    provider: req.query.provider as GetPerformanceLogsQuery['provider'],
    success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
    startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
  };
  
  const result = performanceMonitor.getLogs(query);
  res.json(result);
});

router.get('/stats', (req, res) => {
  const query: GetPerformanceLogsQuery = {
    startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
  };
  
  const stats = performanceMonitor.getStats(query);
  res.json(stats);
});

router.delete('/logs', (req, res) => {
  const beforeTimestamp = req.query.beforeTimestamp 
    ? parseInt(req.query.beforeTimestamp as string) 
    : undefined;
  
  const deletedCount = performanceMonitor.clearLogs(beforeTimestamp);
  res.json({ deleted: deletedCount });
});

export default router;

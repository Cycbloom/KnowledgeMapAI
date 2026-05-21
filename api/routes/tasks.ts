import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { asyncTaskService } from '../services/asyncTaskService';
import { getSupabaseAdmin } from '../supabase';
import { sseService } from '../services/core/sseService';
import { logger } from '../utils/logger';

const router = Router();

router.get('/events', requireAuth, (req: AuthRequest, res: Response) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  };
  
  res.writeHead(200, headers);
  res.flushHeaders();

  const userId = req.user.id;
  logger.debug(`[SSE] New connection request from user: ${userId}`);

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (error) {
      logger.error('[SSE] Keep-alive failed:', error);
      clearInterval(keepAliveInterval);
    }
  }, 30000);

  res.on('close', () => {
    logger.debug(`[SSE] Connection closed for user: ${userId}`);
    clearInterval(keepAliveInterval);
  });

  sseService.addClient(userId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { type, payload, name } = req.body;
  
  try {
    const task = await asyncTaskService.createTask(req.user.id, type, payload, name);
    res.json(task);
  } catch (error: any) {
    logger.error('Create Task Error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { tasks, total } = await asyncTaskService.getTasks(getSupabaseAdmin(), req.user.id, status, { limit, offset });
    res.json({ tasks, total });
  } catch (error: any) {
    logger.error('Get Tasks Error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/:id/retry', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const task = await asyncTaskService.retryTask(getSupabaseAdmin(), req.params.id, req.user.id);
    res.json(task);
  } catch (error: any) {
    logger.error('Retry Task Error:', error);
    res.status(500).json({ error: error.message || 'Failed to retry task' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await asyncTaskService.deleteTask(getSupabaseAdmin(), req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete Task Error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;

import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { requireTaskOwnership } from '../middleware/ownership';
import { asyncTaskService } from '../services/asyncTaskService';
import { sseService } from '../services/core';
import { logger } from '../utils/logger';

const router = Router();

router.get('/events', requireAuth, (req: AuthedRequest, res: Response) => {
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

  const added = sseService.addClient(userId, res);
  if (!added) {
    clearInterval(keepAliveInterval);
    res.status(429).json({ type: 'error', message: 'Too many SSE connections' });
    return;
  }

  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  };
  res.writeHead(200, headers);
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);
});

router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { type, payload, name } = req.body;

  const task = await asyncTaskService.createTask(req.user.id, type, payload, name);
  res.json(task);
});

router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const status = req.query.status as string;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  const { tasks, total } = await asyncTaskService.getTasks(req.supabase, req.user.id, status, { limit, offset });
  res.json({ tasks, total });
});

router.post('/:id/retry', requireAuth, async (req: AuthedRequest, res: Response) => {
  const task = await asyncTaskService.retryTask(req.supabase, req.params.id, req.user.id);
  res.json(task);
});

router.post('/:id/pause', requireAuth, requireTaskOwnership, async (req: AuthedRequest, res: Response) => {
  const result = await asyncTaskService.pauseTask(req.params.id, req.user.id);
  res.json(result);
});

router.post('/:id/resume', requireAuth, requireTaskOwnership, async (req: AuthedRequest, res: Response) => {
  const result = await asyncTaskService.resumeTask(req.params.id, req.user.id);
  res.json(result);
});

router.post('/:id/cancel', requireAuth, requireTaskOwnership, async (req: AuthedRequest, res: Response) => {
  const result = await asyncTaskService.cancelTask(req.params.id, req.user.id);
  res.json(result);
});

router.delete('/:id', requireAuth, requireTaskOwnership, async (req: AuthedRequest, res: Response) => {
  await asyncTaskService.deleteTask(req.supabase, req.params.id, req.user.id);
  res.json({ success: true });
});

export default router;

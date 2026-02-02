
import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { taskService } from '../services/taskService.js';
import { supabaseAdmin } from '../supabase.js';
import { sseService } from '../services/sseService.js';

const router = Router();

// SSE Endpoint for real-time task updates
router.get('/events', requireAuth, (req: AuthRequest, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Register client
  sseService.addClient(req.user.id, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);
});

// Create a new task
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { type, payload, name } = req.body;
  
  try {
    const task = await taskService.createTask(req.user.id, type, payload, name);
    res.json(task);
  } catch (error: any) {
    console.error('Create Task Error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get user's tasks
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string;
    const tasks = await taskService.getTasks(supabaseAdmin, req.user.id, status);
    res.json(tasks);
  } catch (error: any) {
    console.error('Get Tasks Error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Retry a failed task
router.post('/:id/retry', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const task = await taskService.retryTask(supabaseAdmin, req.params.id, req.user.id);
    res.json(task);
  } catch (error: any) {
    console.error('Retry Task Error:', error);
    res.status(500).json({ error: error.message || 'Failed to retry task' });
  }
});

// Delete a task
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await taskService.deleteTask(supabaseAdmin, req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete Task Error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;

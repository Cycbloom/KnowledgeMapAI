
import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { taskService } from '../services/taskService.js';
import { supabaseAdmin } from '../supabase.js';

const router = Router();

// Create a new task
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { type, payload } = req.body;
  
  try {
    const task = await taskService.createTask(supabaseAdmin, req.user.id, type, payload);
    res.json(task);
  } catch (error: any) {
    console.error('Create Task Error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get user's tasks
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await taskService.getTasks(supabaseAdmin, req.user.id);
    res.json(tasks);
  } catch (error: any) {
    console.error('Get Tasks Error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

export default router;

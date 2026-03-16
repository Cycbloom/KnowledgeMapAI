import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { taskService } from '../services/taskService.js';
import { supabaseAdmin } from '../supabase.js';
import { sseService } from '../services/core/sseService.js';
import { logger } from '../utils/logger.js';
const router = Router();
router.get('/events', requireAuth, (req, res) => {
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
        }
        catch (error) {
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
router.post('/', requireAuth, async (req, res) => {
    const { type, payload, name } = req.body;
    try {
        const task = await taskService.createTask(req.user.id, type, payload, name);
        res.json(task);
    }
    catch (error) {
        logger.error('Create Task Error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});
router.get('/', requireAuth, async (req, res) => {
    try {
        const status = req.query.status;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const { tasks, total } = await taskService.getTasks(supabaseAdmin, req.user.id, status, { limit, offset });
        res.json({ tasks, total });
    }
    catch (error) {
        logger.error('Get Tasks Error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
router.post('/:id/retry', requireAuth, async (req, res) => {
    try {
        const task = await taskService.retryTask(supabaseAdmin, req.params.id, req.user.id);
        res.json(task);
    }
    catch (error) {
        logger.error('Retry Task Error:', error);
        res.status(500).json({ error: error.message || 'Failed to retry task' });
    }
});
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await taskService.deleteTask(supabaseAdmin, req.params.id, req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Delete Task Error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});
export default router;
//# sourceMappingURL=tasks.js.map
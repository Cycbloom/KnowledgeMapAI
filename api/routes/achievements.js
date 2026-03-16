import { Router } from 'express';
import { achievementService } from '../services/achievementService.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
const router = Router();
// Get all achievements
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const achievements = await achievementService.getAchievements(userId);
        res.json(achievements);
    }
    catch (error) {
        throw new AppError(error.message, 500);
    }
});
// Check triggers (manual trigger for now, can be automated later)
router.post('/check', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, value } = req.body;
        if (!type || value === undefined) {
            throw new AppError('Missing type or value', 400);
        }
        const newUnlocks = await achievementService.checkAndUnlock(userId, type, value);
        res.json({ newUnlocks });
    }
    catch (error) {
        throw new AppError(error.message, 500);
    }
});
// Get daily tasks
router.get('/daily-tasks', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const tasks = await achievementService.getDailyTasks(userId);
        res.json(tasks);
    }
    catch (error) {
        throw new AppError(error.message, 500);
    }
});
// Daily Check-in
router.post('/daily-tasks/check-in', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        // Initialize tasks if they don't exist
        await achievementService.initDailyTasks(userId);
        // Mark login task
        await achievementService.updateDailyTask(userId, 'login', 1);
        res.json({ success: true });
    }
    catch (error) {
        throw new AppError(error.message, 500);
    }
});
export default router;
//# sourceMappingURL=achievements.js.map
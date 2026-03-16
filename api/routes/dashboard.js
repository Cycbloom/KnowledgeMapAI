import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { dashboardService } from '../services/common/dashboardService.js';
const router = Router();
router.get('/stats', requireAuth, async (req, res) => {
    const userId = req.user.id;
    try {
        const dashboardStats = await dashboardService.getDashboard(req.supabase, userId);
        res.json(dashboardStats);
    }
    catch (error) {
        throw new AppError('获取仪表盘数据失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
export default router;
//# sourceMappingURL=dashboard.js.map
import { Router } from 'express';
import { logger } from '../utils/logger.js';
import redisClient from '../utils/redis.js';
const router = Router();
const ANALYTICS_TTL = 86400 * 7;
router.post('/performance', async (req, res) => {
    try {
        const report = req.body;
        const { metrics, url, userAgent, timestamp } = report;
        if (!metrics || typeof metrics !== 'object') {
            res.status(400).json({ error: 'Invalid metrics data' });
            return;
        }
        const date = new Date().toISOString().split('T')[0];
        const key = `analytics:performance:${date}`;
        if (redisClient) {
            await redisClient.lpush(key, JSON.stringify({
                metrics,
                url,
                userAgent,
                timestamp,
                ip: req.ip,
            }));
            await redisClient.expire(key, ANALYTICS_TTL);
        }
        logger.info('Performance report received', {
            metrics,
            url: url.substring(0, 100),
        });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Performance report error:', error);
        res.status(500).json({ error: 'Failed to process performance report' });
    }
});
router.post('/errors', async (req, res) => {
    try {
        const { errors } = req.body;
        if (!Array.isArray(errors) || errors.length === 0) {
            res.status(400).json({ error: 'Invalid error data' });
            return;
        }
        const date = new Date().toISOString().split('T')[0];
        const key = `analytics:errors:${date}`;
        for (const error of errors) {
            const { message, stack, url, userId, timestamp } = error;
            logger.error('Frontend error reported', {
                message: message.substring(0, 200),
                url: url.substring(0, 100),
                userId,
            });
            if (redisClient) {
                await redisClient.lpush(key, JSON.stringify({
                    message: message.substring(0, 500),
                    stack: stack?.substring(0, 2000),
                    url,
                    userId,
                    timestamp,
                    ip: req.ip,
                }));
                await redisClient.expire(key, ANALYTICS_TTL);
            }
        }
        res.json({ success: true, count: errors.length });
    }
    catch (error) {
        logger.error('Error report processing failed:', error);
        res.status(500).json({ error: 'Failed to process error report' });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = {
            performance: {
                total: 0,
                avgLCP: 0,
                avgFID: 0,
                avgCLS: 0,
            },
            errors: {
                total: 0,
                byType: {},
            },
        };
        if (redisClient) {
            const dates = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                dates.push(date);
            }
            let totalLCP = 0;
            let totalFID = 0;
            let totalCLS = 0;
            let lcpCount = 0;
            let fidCount = 0;
            let clsCount = 0;
            for (const date of dates) {
                const perfKey = `analytics:performance:${date}`;
                const errorKey = `analytics:errors:${date}`;
                const perfData = await redisClient.lrange(perfKey, 0, -1);
                stats.performance.total += perfData.length;
                for (const item of perfData) {
                    try {
                        const report = JSON.parse(item);
                        if (report.metrics?.LCP) {
                            totalLCP += report.metrics.LCP;
                            lcpCount++;
                        }
                        if (report.metrics?.FID) {
                            totalFID += report.metrics.FID;
                            fidCount++;
                        }
                        if (report.metrics?.CLS) {
                            totalCLS += report.metrics.CLS;
                            clsCount++;
                        }
                    }
                    catch {
                        // Skip invalid entries
                    }
                }
                const errorData = await redisClient.lrange(errorKey, 0, -1);
                stats.errors.total += errorData.length;
                for (const item of errorData) {
                    try {
                        const error = JSON.parse(item);
                        const type = error.message?.split(':')[0] || 'unknown';
                        stats.errors.byType[type] = (stats.errors.byType[type] || 0) + 1;
                    }
                    catch {
                        // Skip invalid entries
                    }
                }
            }
            stats.performance.avgLCP = lcpCount > 0 ? Math.round(totalLCP / lcpCount) : 0;
            stats.performance.avgFID = fidCount > 0 ? Math.round(totalFID / fidCount) : 0;
            stats.performance.avgCLS = clsCount > 0 ? Math.round(totalCLS / clsCount * 1000) / 1000 : 0;
        }
        res.json(stats);
    }
    catch (error) {
        logger.error('Analytics stats error:', error);
        res.status(500).json({ error: 'Failed to get analytics stats' });
    }
});
router.get('/performance/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const date = new Date().toISOString().split('T')[0];
        const key = `analytics:performance:${date}`;
        let data = [];
        if (redisClient) {
            data = await redisClient.lrange(key, 0, limit - 1);
        }
        const reports = data.map(item => {
            try {
                return JSON.parse(item);
            }
            catch {
                return null;
            }
        }).filter(Boolean);
        res.json({ reports, count: reports.length });
    }
    catch (error) {
        logger.error('Recent performance error:', error);
        res.status(500).json({ error: 'Failed to get recent performance data' });
    }
});
router.get('/errors/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const date = new Date().toISOString().split('T')[0];
        const key = `analytics:errors:${date}`;
        let data = [];
        if (redisClient) {
            data = await redisClient.lrange(key, 0, limit - 1);
        }
        const errors = data.map(item => {
            try {
                return JSON.parse(item);
            }
            catch {
                return null;
            }
        }).filter(Boolean);
        res.json({ errors, count: errors.length });
    }
    catch (error) {
        logger.error('Recent errors fetch failed:', error);
        res.status(500).json({ error: 'Failed to get recent errors' });
    }
});
export default router;
//# sourceMappingURL=analytics.js.map
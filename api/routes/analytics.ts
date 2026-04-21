import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface PerformanceReport {
  metrics: Record<string, number>;
  url: string;
  userAgent: string;
  timestamp: string;
}

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: string;
  userAgent: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

router.post('/performance', async (req, res): Promise<void> => {
  try {
    const report: PerformanceReport = req.body;
    const { metrics, url } = report;

    if (!metrics || typeof metrics !== 'object') {
      res.status(400).json({ error: 'Invalid metrics data' });
      return;
    }

    logger.info('Performance report received', {
      metrics,
      url: url.substring(0, 100),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Performance report error:', error);
    res.status(500).json({ error: 'Failed to process performance report' });
  }
});

router.post('/errors', async (req, res): Promise<void> => {
  try {
    const { errors }: { errors: ErrorReport[] } = req.body;

    if (!Array.isArray(errors) || errors.length === 0) {
      res.status(400).json({ error: 'Invalid error data' });
      return;
    }

    for (const error of errors) {
      const { message, url, userId } = error;

      logger.error('Frontend error reported', {
        message: message.substring(0, 200),
        url: url.substring(0, 100),
        userId,
      });
    }

    res.json({ success: true, count: errors.length });
  } catch (error) {
    logger.error('Error report processing failed:', error);
    res.status(500).json({ error: 'Failed to process error report' });
  }
});

router.get('/stats', async (_req, res): Promise<void> => {
  try {
    const stats = {
      performance: {
        total: 0,
        avgLCP: 0,
        avgFID: 0,
        avgCLS: 0,
      },
      errors: {
        total: 0,
        byType: {} as Record<string, number>,
      },
    };

    res.json(stats);
  } catch (error) {
    logger.error('Analytics stats error:', error);
    res.status(500).json({ error: 'Failed to get analytics stats' });
  }
});

router.get('/performance/recent', async (_req, res): Promise<void> => {
  try {
    const reports: unknown[] = [];
    res.json({ reports, count: reports.length });
  } catch (error) {
    logger.error('Recent performance error:', error);
    res.status(500).json({ error: 'Failed to get recent performance data' });
  }
});

router.get('/errors/recent', async (_req, res): Promise<void> => {
  try {
    const errors: unknown[] = [];
    res.json({ errors, count: errors.length });
  } catch (error) {
    logger.error('Recent errors fetch failed:', error);
    res.status(500).json({ error: 'Failed to get recent errors' });
  }
});

export default router;

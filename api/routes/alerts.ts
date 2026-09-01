import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { alertManager, type AlertRule } from '../utils/alertManager';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// 告警规则与告警记录属于系统级数据，要求已认证访问
router.use(requireAuth);

router.get('/rules', (_req, res) => {
  const rules = alertManager.getRules();
  res.json({ rules });
});

router.post('/rules', asyncHandler((req, res) => {
  const rule = req.body as Omit<AlertRule, 'id'>;
  const newRule = alertManager.addRule(rule);
  res.status(201).json({ rule: newRule });
}));

router.put('/rules/:id', asyncHandler((req, res) => {
  const { id } = req.params;
  const updates = req.body as Partial<AlertRule>;
  const rule = alertManager.updateRule(id, updates);

  if (!rule) {
    throw new AppError('Rule not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  res.json({ rule });
}));

router.delete('/rules/:id', asyncHandler((req, res) => {
  const { id } = req.params;
  const deleted = alertManager.deleteRule(id);

  if (!deleted) {
    throw new AppError('Rule not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  res.json({ success: true });
}));

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = alertManager.getAlerts(limit);
  res.json({ alerts });
});

router.get('/stats', (_req, res) => {
  const stats = alertManager.getStats();
  res.json(stats);
});

router.post('/:id/acknowledge', asyncHandler((req, res) => {
  const { id } = req.params;
  const { acknowledgedBy } = req.body;

  const alert = alertManager.acknowledgeAlert(id, acknowledgedBy || 'system');

  if (!alert) {
    throw new AppError('Alert not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  res.json({ alert });
}));

router.post('/check', asyncHandler((req, res) => {
  const { metric, value } = req.body;

  if (!metric || typeof value !== 'number') {
    throw new AppError('Invalid metric or value', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const triggeredAlerts = alertManager.checkMetric(metric, value);
  res.json({ triggered: triggeredAlerts });
}));

router.delete('/', (_req, res) => {
  alertManager.clearAlerts();
  res.json({ success: true });
});

export default router;

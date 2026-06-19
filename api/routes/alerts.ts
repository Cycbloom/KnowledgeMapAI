import { Router } from 'express';
import { alertManager, type AlertRule } from '../utils/alertManager';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

router.get('/rules', (_req, res) => {
  const rules = alertManager.getRules();
  res.json({ rules });
});

router.post('/rules', (req, res) => {
  try {
    const rule = req.body as Omit<AlertRule, 'id'>;
    const newRule = alertManager.addRule(rule);
    res.status(201).json({ rule: newRule });
  } catch (error) {
    logger.error('Failed to add alert rule:', error);
    throw new AppError('Failed to add alert rule', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.put('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<AlertRule>;
    const rule = alertManager.updateRule(id, updates);
    
    if (!rule) {
      throw new AppError('Rule not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    
    res.json({ rule });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to update alert rule:', error);
    throw new AppError('Failed to update alert rule', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.delete('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = alertManager.deleteRule(id);
    
    if (!deleted) {
      throw new AppError('Rule not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to delete alert rule:', error);
    throw new AppError('Failed to delete alert rule', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = alertManager.getAlerts(limit);
  res.json({ alerts });
});

router.get('/stats', (_req, res) => {
  const stats = alertManager.getStats();
  res.json(stats);
});

router.post('/:id/acknowledge', (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;
    
    const alert = alertManager.acknowledgeAlert(id, acknowledgedBy || 'system');
    
    if (!alert) {
      throw new AppError('Alert not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    
    res.json({ alert });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to acknowledge alert:', error);
    throw new AppError('Failed to acknowledge alert', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/check', (req, res) => {
  try {
    const { metric, value } = req.body;
    
    if (!metric || typeof value !== 'number') {
      throw new AppError('Invalid metric or value', 400, ErrorCodes.VALIDATION_ERROR);
    }
    
    const triggeredAlerts = alertManager.checkMetric(metric, value);
    res.json({ triggered: triggeredAlerts });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to check metric:', error);
    throw new AppError('Failed to check metric', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.delete('/', (_req, res) => {
  alertManager.clearAlerts();
  res.json({ success: true });
});

export default router;

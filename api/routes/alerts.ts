import { Router } from 'express';
import { alertManager, type AlertRule } from '../utils/alertManager.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/rules', (req, res) => {
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
    res.status(500).json({ error: 'Failed to add alert rule' });
  }
});

router.put('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<AlertRule>;
    const rule = alertManager.updateRule(id, updates);
    
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    
    res.json({ rule });
  } catch (error) {
    logger.error('Failed to update alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

router.delete('/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = alertManager.deleteRule(id);
    
    if (!deleted) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = alertManager.getAlerts(limit);
  res.json({ alerts });
});

router.get('/stats', (req, res) => {
  const stats = alertManager.getStats();
  res.json(stats);
});

router.post('/:id/acknowledge', (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;
    
    const alert = alertManager.acknowledgeAlert(id, acknowledgedBy || 'system');
    
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    
    res.json({ alert });
  } catch (error) {
    logger.error('Failed to acknowledge alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

router.post('/check', (req, res) => {
  try {
    const { metric, value } = req.body;
    
    if (!metric || typeof value !== 'number') {
      res.status(400).json({ error: 'Invalid metric or value' });
      return;
    }
    
    const triggeredAlerts = alertManager.checkMetric(metric, value);
    res.json({ triggered: triggeredAlerts });
  } catch (error) {
    logger.error('Failed to check metric:', error);
    res.status(500).json({ error: 'Failed to check metric' });
  }
});

router.delete('/', (req, res) => {
  alertManager.clearAlerts();
  res.json({ success: true });
});

export default router;

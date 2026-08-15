import { logger } from './logger';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
type AlertChannel = 'email' | 'webhook' | 'in-app';

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  comparison: 'gt' | 'lt' | 'eq';
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  cooldownMinutes: number;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface AlertConfig {
  email?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    from: string;
    to: string[];
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'lcp-warning',
    name: 'LCP 性能警告',
    metric: 'LCP',
    threshold: 2500,
    comparison: 'gt',
    severity: 'warning',
    channels: ['in-app'],
    enabled: true,
    cooldownMinutes: 30,
  },
  {
    id: 'lcp-critical',
    name: 'LCP 性能严重',
    metric: 'LCP',
    threshold: 4000,
    comparison: 'gt',
    severity: 'critical',
    channels: ['in-app', 'email'],
    enabled: true,
    cooldownMinutes: 15,
  },
  {
    id: 'error-rate-warning',
    name: '错误率警告',
    metric: 'error_rate',
    threshold: 5,
    comparison: 'gt',
    severity: 'warning',
    channels: ['in-app'],
    enabled: true,
    cooldownMinutes: 30,
  },
  {
    id: 'error-rate-critical',
    name: '错误率严重',
    metric: 'error_rate',
    threshold: 10,
    comparison: 'gt',
    severity: 'critical',
    channels: ['in-app', 'email'],
    enabled: true,
    cooldownMinutes: 15,
  },
  {
    id: 'api-latency-warning',
    name: 'API 延迟警告',
    metric: 'api_latency',
    threshold: 3000,
    comparison: 'gt',
    severity: 'warning',
    channels: ['in-app'],
    enabled: true,
    cooldownMinutes: 30,
  },
];

class AlertManager {
  private rules: AlertRule[] = DEFAULT_RULES;
  private alerts: Alert[] = [];
  private lastTriggered: Map<string, Date> = new Map();
  private config: AlertConfig = {};

  setConfig(config: AlertConfig): void {
    this.config = config;
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  getAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(0, limit);
  }

  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    this.rules.push(newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    this.rules[index] = { ...this.rules[index], ...updates };
    return this.rules[index];
  }

  deleteRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.rules.splice(index, 1);
    return true;
  }

  checkMetric(metric: string, value: number): Alert[] {
    const triggeredAlerts: Alert[] = [];
    const now = new Date();

    for (const rule of this.rules) {
      if (!rule.enabled || rule.metric !== metric) continue;

      const lastTrigger = this.lastTriggered.get(rule.id);
      if (lastTrigger) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (now.getTime() - lastTrigger.getTime() < cooldownMs) continue;
      }

      let shouldTrigger = false;
      switch (rule.comparison) {
        case 'gt':
          shouldTrigger = value > rule.threshold;
          break;
        case 'lt':
          shouldTrigger = value < rule.threshold;
          break;
        case 'eq':
          shouldTrigger = value === rule.threshold;
          break;
      }

      if (shouldTrigger) {
        const alert: Alert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `${rule.name}: ${metric}=${value} (阈值: ${rule.threshold})`,
          value,
          threshold: rule.threshold,
          timestamp: now,
          acknowledged: false,
        };

        this.alerts.unshift(alert);
        this.lastTriggered.set(rule.id, now);
        triggeredAlerts.push(alert);

        logger.warn(`Alert triggered: ${alert.message}`);

        this.sendNotification(alert, rule.channels);
      }
    }

    return triggeredAlerts;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    return alert;
  }

  private async sendNotification(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmail(alert);
            break;
          case 'webhook':
            await this.sendWebhook(alert);
            break;
          case 'in-app':
            await this.sendInApp(alert);
            break;
        }
      } catch (error) {
        logger.error(`Failed to send alert via ${channel}:`, error);
      }
    }
  }

  private async sendEmail(alert: Alert): Promise<void> {
    if (!this.config.email) return;

    logger.info(`[Alert] Email notification for: ${alert.message}`);
  }

  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhook) return;

    try {
      await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers,
        },
        body: JSON.stringify({
          alert,
          timestamp: alert.timestamp.toISOString(),
        }),
      });
    } catch (error) {
      logger.error('Webhook notification failed:', error);
    }
  }

  private async sendInApp(alert: Alert): Promise<void> {
    logger.info(`[Alert] In-app notification: ${alert.message}`);
  }

  getStats(): {
    totalAlerts: number;
    unacknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const bySeverity: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    // 在单趟遍历中同时累计未确认数，替代额外的 this.alerts.filter 扫描
    let unacknowledged = 0;
    this.alerts.forEach(alert => {
      bySeverity[alert.severity]++;
      if (!alert.acknowledged) unacknowledged++;
    });

    return {
      totalAlerts: this.alerts.length,
      unacknowledged,
      bySeverity,
    };
  }

  clearAlerts(): void {
    this.alerts = [];
    this.lastTriggered.clear();
  }
}

export const alertManager = new AlertManager();
export type { AlertRule, Alert, AlertSeverity, AlertChannel, AlertConfig };

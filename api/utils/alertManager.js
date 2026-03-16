import { logger } from './logger.js';
const DEFAULT_RULES = [
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
    rules = DEFAULT_RULES;
    alerts = [];
    lastTriggered = new Map();
    config = {};
    setConfig(config) {
        this.config = config;
    }
    getRules() {
        return [...this.rules];
    }
    getAlerts(limit = 50) {
        return this.alerts.slice(0, limit);
    }
    addRule(rule) {
        const newRule = {
            ...rule,
            id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        this.rules.push(newRule);
        return newRule;
    }
    updateRule(id, updates) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1)
            return null;
        this.rules[index] = { ...this.rules[index], ...updates };
        return this.rules[index];
    }
    deleteRule(id) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1)
            return false;
        this.rules.splice(index, 1);
        return true;
    }
    checkMetric(metric, value) {
        const triggeredAlerts = [];
        const now = new Date();
        for (const rule of this.rules) {
            if (!rule.enabled || rule.metric !== metric)
                continue;
            const lastTrigger = this.lastTriggered.get(rule.id);
            if (lastTrigger) {
                const cooldownMs = rule.cooldownMinutes * 60 * 1000;
                if (now.getTime() - lastTrigger.getTime() < cooldownMs)
                    continue;
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
                const alert = {
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
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert)
            return null;
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date();
        return alert;
    }
    async sendNotification(alert, channels) {
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
            }
            catch (error) {
                logger.error(`Failed to send alert via ${channel}:`, error);
            }
        }
    }
    async sendEmail(alert) {
        if (!this.config.email)
            return;
        logger.info(`[Alert] Email notification for: ${alert.message}`);
    }
    async sendWebhook(alert) {
        if (!this.config.webhook)
            return;
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
        }
        catch (error) {
            logger.error('Webhook notification failed:', error);
        }
    }
    async sendInApp(alert) {
        logger.info(`[Alert] In-app notification: ${alert.message}`);
    }
    getStats() {
        const bySeverity = {
            info: 0,
            warning: 0,
            error: 0,
            critical: 0,
        };
        this.alerts.forEach(alert => {
            bySeverity[alert.severity]++;
        });
        return {
            totalAlerts: this.alerts.length,
            unacknowledged: this.alerts.filter(a => !a.acknowledged).length,
            bySeverity,
        };
    }
    clearAlerts() {
        this.alerts = [];
        this.lastTriggered.clear();
    }
}
export const alertManager = new AlertManager();
//# sourceMappingURL=alertManager.js.map
import type { AIPerformanceLog, AIPerformanceStats, GetPerformanceLogsQuery, AIProviderType } from '@shared/types';
import { pricingService } from './pricingService';

const MAX_LOGS = 1000;

class PerformanceMonitor {
  private logs: AIPerformanceLog[] = [];

  recordLog(log: Omit<AIPerformanceLog, 'id' | 'timestamp' | 'totalTokens' | 'estimatedCost'> & {
    provider: AIProviderType;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): void {
    const totalTokens = log.inputTokens + log.outputTokens;
    const estimatedCost = pricingService.calculateCost(log.provider, log.model, log.inputTokens, log.outputTokens);
    
    const fullLog: AIPerformanceLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      totalTokens,
      estimatedCost,
    };
    
    this.logs.unshift(fullLog);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }
  }

  getLogs(query: GetPerformanceLogsQuery = {}): { logs: AIPerformanceLog[]; total: number } {
    let filtered = [...this.logs];
    
    if (query.operation) {
      filtered = filtered.filter(l => l.operation === query.operation);
    }
    if (query.provider) {
      filtered = filtered.filter(l => l.provider === query.provider);
    }
    if (query.success !== undefined) {
      filtered = filtered.filter(l => l.success === query.success);
    }
    if (query.startTime) {
      filtered = filtered.filter(l => l.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filtered = filtered.filter(l => l.timestamp <= query.endTime!);
    }
    
    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    
    return {
      logs: filtered.slice(offset, offset + limit),
      total,
    };
  }

  getStats(query: GetPerformanceLogsQuery = {}): AIPerformanceStats {
    const { logs } = this.getLogs({ ...query, limit: MAX_LOGS });
    
    const stats: AIPerformanceStats = {
      totalRequests: logs.length,
      successRequests: logs.filter(l => l.success).length,
      failedRequests: logs.filter(l => !l.success).length,
      totalInputTokens: logs.reduce((sum, l) => sum + l.inputTokens, 0),
      totalOutputTokens: logs.reduce((sum, l) => sum + l.outputTokens, 0),
      totalTokens: logs.reduce((sum, l) => sum + l.totalTokens, 0),
      totalCost: logs.reduce((sum, l) => sum + l.estimatedCost, 0),
      avgDuration: logs.length > 0 ? logs.reduce((sum, l) => sum + l.duration, 0) / logs.length : 0,
      byOperation: {},
      byModel: {},
    };
    
    for (const log of logs) {
      if (!stats.byOperation[log.operation]) {
        stats.byOperation[log.operation] = { count: 0, tokens: 0, cost: 0 };
      }
      stats.byOperation[log.operation].count++;
      stats.byOperation[log.operation].tokens += log.totalTokens;
      stats.byOperation[log.operation].cost += log.estimatedCost;
      
      const modelKey = `${log.provider}/${log.model}`;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = { count: 0, tokens: 0, cost: 0 };
      }
      stats.byModel[modelKey].count++;
      stats.byModel[modelKey].tokens += log.totalTokens;
      stats.byModel[modelKey].cost += log.estimatedCost;
    }
    
    return stats;
  }

  clearLogs(beforeTimestamp?: number): number {
    if (beforeTimestamp) {
      const beforeCount = this.logs.length;
      this.logs = this.logs.filter(l => l.timestamp >= beforeTimestamp);
      return beforeCount - this.logs.length;
    }
    const count = this.logs.length;
    this.logs = [];
    return count;
  }
}

export const performanceMonitor = new PerformanceMonitor();

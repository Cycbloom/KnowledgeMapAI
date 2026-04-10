import type { AIPerformanceLog, AIPerformanceStats, GetPerformanceLogsQuery } from '@shared/types';
import { pricingService } from './pricingService';
import { supabaseAdmin } from '../../supabase';
import { logger } from '../../utils/logger';

const MAX_LOGS = 1000;

interface DatabaseLogRow {
  id: string;
  timestamp: number;
  operation: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens?: number | null;
  uncached_input_tokens?: number | null;
  reasoning_tokens?: number | null;
  cache_hit_rate?: number | null;
  estimated_cost: number | string;
  duration: number;
  success: boolean;
  error_message?: string | null;
  cost_breakdown?: object | null;
  metadata?: object | null;
}

class PerformanceMonitor {
  private logs: AIPerformanceLog[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.loadFromDatabase();
      this.initialized = true;
      logger.info(`[PerformanceMonitor] Loaded ${this.logs.length} logs from database`);
    } catch (error) {
      logger.error('[PerformanceMonitor] Failed to load logs from database:', error);
      this.initialized = true;
    }
  }

  private async loadFromDatabase(): Promise<void> {
    const { data, error } = await supabaseAdmin
      .from('ai_performance_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(MAX_LOGS);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      this.logs = (data as DatabaseLogRow[]).map((row: DatabaseLogRow) => ({
        id: row.id,
        timestamp: row.timestamp,
        operation: row.operation,
        model: row.model,
        provider: row.provider as AIPerformanceLog['provider'],
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: row.total_tokens,
        estimatedCost: parseFloat(String(row.estimated_cost)),
        duration: row.duration,
        success: row.success,
        errorMessage: row.error_message || undefined,
        cachedInputTokens: row.cached_input_tokens || undefined,
        uncachedInputTokens: row.uncached_input_tokens || undefined,
        reasoningTokens: row.reasoning_tokens || undefined,
        cacheHitRate: row.cache_hit_rate ? parseFloat(String(row.cache_hit_rate)) : undefined,
        costBreakdown: row.cost_breakdown as AIPerformanceLog['costBreakdown'],
        metadata: row.metadata as AIPerformanceLog['metadata'],
      }));
    }
  }

  async recordLog(log: Omit<AIPerformanceLog, 'id' | 'timestamp'>): Promise<void> {
    const totalTokens = (log.totalTokens || log.inputTokens + log.outputTokens);
    const estimatedCost = log.estimatedCost || pricingService.calculateCost(
      log.provider,
      log.model,
      log.inputTokens,
      log.outputTokens,
      log.cachedInputTokens
    );
    
    const fullLog: AIPerformanceLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      totalTokens,
      estimatedCost,
    };
    
    // 内存存储（用于快速查询）
    this.logs.unshift(fullLog);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    // 异步持久化到数据库（不阻塞主流程）
    this.persistToDatabase(fullLog).catch((err: Error) => {
      logger.warn('[PerformanceMonitor] Failed to persist log to database:', err);
    });
  }

  private async persistToDatabase(log: AIPerformanceLog): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('ai_performance_logs')
        .insert({
          id: log.id,
          timestamp: log.timestamp,
          operation: log.operation,
          model: log.model,
          provider: log.provider,
          input_tokens: log.inputTokens,
          output_tokens: log.outputTokens,
          total_tokens: log.totalTokens,
          cached_input_tokens: log.cachedInputTokens || null,
          uncached_input_tokens: log.uncachedInputTokens || null,
          reasoning_tokens: log.reasoningTokens || null,
          cache_hit_rate: log.cacheHitRate || null,
          estimated_cost: log.estimatedCost,
          duration: log.duration,
          success: log.success,
          error_message: log.errorMessage || null,
          cost_breakdown: log.costBreakdown || null,
          metadata: log.metadata || {},
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('[PerformanceMonitor] Database persist error:', error);
      throw error;
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

  async getHistoricalLogs(
    query: GetPerformanceLogsQuery & { days?: number } = {}
  ): Promise<{ logs: AIPerformanceLog[]; total: number }> {
    let dbQuery = supabaseAdmin
      .from('ai_performance_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    if (query.days) {
      const startTime = Date.now() - (query.days * 24 * 60 * 60 * 1000);
      dbQuery = dbQuery.gte('timestamp', startTime);
    }
    if (query.operation) {
      dbQuery = dbQuery.eq('operation', query.operation);
    }
    if (query.provider) {
      dbQuery = dbQuery.eq('provider', query.provider);
    }
    if (query.success !== undefined) {
      dbQuery = dbQuery.eq('success', query.success);
    }

    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 50, 1000);

    const { data, count, error } = await dbQuery
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[PerformanceMonitor] Failed to fetch historical logs:', error);
      return { logs: [], total: 0 };
    }

    const logs: AIPerformanceLog[] = ((data || []) as DatabaseLogRow[]).map((row: DatabaseLogRow) => ({
      id: row.id,
      timestamp: row.timestamp,
      operation: row.operation,
      model: row.model,
      provider: row.provider as AIPerformanceLog['provider'],
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      estimatedCost: parseFloat(String(row.estimated_cost)),
      duration: row.duration,
      success: row.success,
      errorMessage: row.error_message || undefined,
      cachedInputTokens: row.cached_input_tokens || undefined,
      uncachedInputTokens: row.uncached_input_tokens || undefined,
      reasoningTokens: row.reasoning_tokens || undefined,
      cacheHitRate: row.cache_hit_rate ? parseFloat(String(row.cache_hit_rate)) : undefined,
      costBreakdown: row.cost_breakdown as AIPerformanceLog['costBreakdown'],
      metadata: row.metadata as AIPerformanceLog['metadata'],
    }));

    return {
      logs,
      total: count || 0,
    };
  }

  getStats(query: GetPerformanceLogsQuery = {}): AIPerformanceStats {
    const { logs } = this.getLogs({ ...query, limit: MAX_LOGS });
    
    const totalCachedInputTokens = logs.reduce((sum: number, l: AIPerformanceLog) => sum + (l.cachedInputTokens || 0), 0);
    const totalUncachedInputTokens = logs.reduce((sum: number, l: AIPerformanceLog) => sum + (l.uncachedInputTokens || 0), 0);
    const totalSavedByCache = logs.reduce((sum: number, l: AIPerformanceLog) => sum + (l.costBreakdown?.savedByCache || 0), 0);
    
    const stats: AIPerformanceStats = {
      totalRequests: logs.length,
      successRequests: logs.filter(l => l.success).length,
      failedRequests: logs.filter(l => !l.success).length,
      totalInputTokens: logs.reduce((sum: number, l: AIPerformanceLog) => sum + l.inputTokens, 0),
      totalOutputTokens: logs.reduce((sum: number, l: AIPerformanceLog) => sum + l.outputTokens, 0),
      totalCachedInputTokens,
      totalUncachedInputTokens,
      totalTokens: logs.reduce((sum: number, l: AIPerformanceLog) => sum + l.totalTokens, 0),
      totalCost: logs.reduce((sum: number, l: AIPerformanceLog) => sum + l.estimatedCost, 0),
      totalSavedByCache,
      avgDuration: logs.length > 0 ? logs.reduce((sum: number, l: AIPerformanceLog) => sum + l.duration, 0) / logs.length : 0,
      avgCacheHitRate: logs.length > 0 
        ? logs.reduce((sum: number, l: AIPerformanceLog) => sum + (l.cacheHitRate || 0), 0) / logs.length 
        : 0,
      byOperation: {},
      byModel: {},
    };
    
    for (const log of logs) {
      if (!stats.byOperation[log.operation]) {
        stats.byOperation[log.operation] = { count: 0, tokens: 0, cost: 0, cachedTokens: 0, savedCost: 0 };
      }
      stats.byOperation[log.operation].count++;
      stats.byOperation[log.operation].tokens += log.totalTokens;
      stats.byOperation[log.operation].cost += log.estimatedCost;
      stats.byOperation[log.operation].cachedTokens += log.cachedInputTokens || 0;
      stats.byOperation[log.operation].savedCost += log.costBreakdown?.savedByCache || 0;
      
      const modelKey = `${log.provider}/${log.model}`;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = { count: 0, tokens: 0, cost: 0, cachedTokens: 0, savedCost: 0 };
      }
      stats.byModel[modelKey].count++;
      stats.byModel[modelKey].tokens += log.totalTokens;
      stats.byModel[modelKey].cost += log.estimatedCost;
      stats.byModel[modelKey].cachedTokens += log.cachedInputTokens || 0;
      stats.byModel[modelKey].savedCost += log.costBreakdown?.savedByCache || 0;
    }
    
    return stats;
  }

  clearLogs(beforeTimestamp?: number): number {
    if (beforeTimestamp) {
      const beforeCount = this.logs.length;
      this.logs = this.logs.filter(l => l.timestamp >= beforeTimestamp);
      
      // 异步清理数据库
      supabaseAdmin
        .from('ai_performance_logs')
        .delete()
        .lt('timestamp', beforeTimestamp)
        .then(() => logger.info(`[PerformanceMonitor] Cleared database logs before ${new Date(beforeTimestamp).toISOString()}`))
        .catch((error: Error) => logger.error('[PerformanceMonitor] Failed to clear database logs:', error));
      
      return beforeCount - this.logs.length;
    }
    const count = this.logs.length;
    this.logs = [];

    // 清理所有数据库记录（可选：只清理30天前的）
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    supabaseAdmin
      .from('ai_performance_logs')
      .delete()
      .lt('timestamp', thirtyDaysAgo)
      .then(({ count: deletedCount }: { count: number | null }) => {
        logger.info(`[PerformanceMonitor] Cleared ${deletedCount} old logs from database (kept last 30 days)`);
      })
      .catch((error: Error) => logger.error('[PerformanceMonitor] Failed to clear old database logs:', error));
    
    return count;
  }

  async getDatabaseStats(): Promise<{
    totalRecords: number;
    oldestRecord: string | null;
    newestRecord: string | null;
    totalCost: number;
    totalTokens: number;
  }> {
    const { count: totalRecords } = await supabaseAdmin
      .from('ai_performance_logs')
      .select('*', { count: 'exact', head: true });

    const { data: oldest } = await supabaseAdmin
      .from('ai_performance_logs')
      .select('timestamp')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    const { data: newest } = await supabaseAdmin
      .from('ai_performance_logs')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const { data: aggData } = await supabaseAdmin
      .from('ai_performance_logs')
      .select('total_tokens, estimated_cost');

    const totalTokens = (aggData || []).reduce((sum: number, row: DatabaseLogRow) => sum + (row.total_tokens || 0), 0);
    const totalCost = (aggData || []).reduce((sum: number, row: DatabaseLogRow) => sum + parseFloat(String(row.estimated_cost || 0)), 0);

    return {
      totalRecords: totalRecords || 0,
      oldestRecord: oldest ? new Date(oldest.timestamp).toISOString() : null,
      newestRecord: newest ? new Date(newest.timestamp).toISOString() : null,
      totalCost,
      totalTokens,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

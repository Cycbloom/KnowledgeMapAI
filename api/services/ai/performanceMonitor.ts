import type {
  AIProviderType,
  AIPerformanceLog,
  AIPerformanceStats,
  GetPerformanceLogsQuery,
} from "@shared/types";
import { pricingService } from "./pricingService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";

const MAX_LOGS = 1000;

interface DatabaseLogRow {
  id: string;
  timestamp: number;
  operation: string;
  session_id?: string | null;
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
      logger.info(
        `[PerformanceMonitor] Loaded ${this.logs.length} logs from database`,
      );
    } catch (error) {
      logger.error(
        "[PerformanceMonitor] Failed to load logs from database:",
        error,
      );
      this.initialized = true;
    }
  }

  private async loadFromDatabase(): Promise<void> {
    const { data, error } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(MAX_LOGS);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      this.logs = (data as DatabaseLogRow[]).map((row: DatabaseLogRow) => ({
        id: row.id,
        timestamp: row.timestamp,
        operation: row.operation,
        sessionId: row.session_id || undefined,
        model: row.model,
        provider: row.provider as AIPerformanceLog["provider"],
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
        cacheHitRate: row.cache_hit_rate
          ? parseFloat(String(row.cache_hit_rate))
          : undefined,
        costBreakdown: row.cost_breakdown as AIPerformanceLog["costBreakdown"],
        metadata: row.metadata as AIPerformanceLog["metadata"],
      }));
    }
  }

  async recordLog(
    log: Omit<AIPerformanceLog, "id" | "timestamp">,
  ): Promise<void> {
    const totalTokens = log.totalTokens || log.inputTokens + log.outputTokens;
    const estimatedCost =
      log.estimatedCost ||
      pricingService.calculateCost(
        log.provider,
        log.model,
        log.inputTokens,
        log.outputTokens,
        log.cachedInputTokens,
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
      logger.warn(
        "[PerformanceMonitor] Failed to persist log to database:",
        err,
      );
    });
  }

  private async persistToDatabase(log: AIPerformanceLog): Promise<void> {
    try {
      const { error } = await getSupabaseAdmin().from("ai_performance_logs").insert({
        id: log.id,
        timestamp: log.timestamp,
        operation: log.operation,
        session_id: log.sessionId || null,
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
      logger.error("[PerformanceMonitor] Database persist error:", error);
      throw error;
    }
  }

  getLogs(query: GetPerformanceLogsQuery = {}): {
    logs: AIPerformanceLog[];
    total: number;
  } {
    let filtered = [...this.logs];

    if (query.operation) {
      filtered = filtered.filter((l) => l.operation === query.operation);
    }
    if (query.provider) {
      filtered = filtered.filter((l) => l.provider === query.provider);
    }
    if (query.success !== undefined) {
      filtered = filtered.filter((l) => l.success === query.success);
    }
    if (query.startTime) {
      filtered = filtered.filter((l) => l.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filtered = filtered.filter((l) => l.timestamp <= query.endTime!);
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
    query: GetPerformanceLogsQuery & { days?: number; sessionId?: string } = {},
  ): Promise<{ logs: AIPerformanceLog[]; total: number }> {
    let dbQuery = getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false });

    if (query.days) {
      const startTime = Date.now() - query.days * 24 * 60 * 60 * 1000;
      dbQuery = dbQuery.gte("timestamp", startTime);
    }
    if (query.operation) {
      dbQuery = dbQuery.eq("operation", query.operation);
    }
    if (query.provider) {
      dbQuery = dbQuery.eq("provider", query.provider);
    }
    if (query.success !== undefined) {
      dbQuery = dbQuery.eq("success", query.success);
    }
    if (query.sessionId) {
      dbQuery = dbQuery.eq("session_id", query.sessionId);
    }

    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 50, 1000);

    const { data, count, error } = await dbQuery.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      logger.error(
        "[PerformanceMonitor] Failed to fetch historical logs:",
        error,
      );
      return { logs: [], total: 0 };
    }

    const logs: AIPerformanceLog[] = ((data || []) as DatabaseLogRow[]).map(
      (row: DatabaseLogRow) => ({
        id: row.id,
        timestamp: row.timestamp,
        operation: row.operation,
        sessionId: row.session_id || undefined,
        model: row.model,
        provider: row.provider as AIPerformanceLog["provider"],
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
        cacheHitRate: row.cache_hit_rate
          ? parseFloat(String(row.cache_hit_rate))
          : undefined,
        costBreakdown: row.cost_breakdown as AIPerformanceLog["costBreakdown"],
        metadata: row.metadata as AIPerformanceLog["metadata"],
      }),
    );

    return {
      logs,
      total: count || 0,
    };
  }

  getStats(query: GetPerformanceLogsQuery = {}): AIPerformanceStats {
    const { logs } = this.getLogs({ ...query, limit: MAX_LOGS });

    const totalCachedInputTokens = logs.reduce(
      (sum: number, l: AIPerformanceLog) => sum + (l.cachedInputTokens || 0),
      0,
    );
    const totalUncachedInputTokens = logs.reduce(
      (sum: number, l: AIPerformanceLog) => sum + (l.uncachedInputTokens || 0),
      0,
    );
    const totalSavedByCache = logs.reduce(
      (sum: number, l: AIPerformanceLog) =>
        sum + (l.costBreakdown?.savedByCache || 0),
      0,
    );

    const embeddingOperations = [
      "generate_embedding",
      "generate_embedding_batch",
    ];
    const nonEmbeddingLogs = logs.filter(
      (l) => !embeddingOperations.includes(l.operation),
    );

    const stats: AIPerformanceStats = {
      totalRequests: logs.length,
      successRequests: logs.filter((l) => l.success).length,
      failedRequests: logs.filter((l) => !l.success).length,
      totalInputTokens: logs.reduce(
        (sum: number, l: AIPerformanceLog) => sum + l.inputTokens,
        0,
      ),
      totalOutputTokens: logs.reduce(
        (sum: number, l: AIPerformanceLog) => sum + l.outputTokens,
        0,
      ),
      totalCachedInputTokens,
      totalUncachedInputTokens,
      totalTokens: logs.reduce(
        (sum: number, l: AIPerformanceLog) => sum + l.totalTokens,
        0,
      ),
      totalCost: logs.reduce(
        (sum: number, l: AIPerformanceLog) => sum + l.estimatedCost,
        0,
      ),
      totalSavedByCache,
      avgDuration:
        nonEmbeddingLogs.length > 0
          ? nonEmbeddingLogs.reduce(
              (sum: number, l: AIPerformanceLog) => sum + l.duration,
              0,
            ) / nonEmbeddingLogs.length
          : 0,
      avgCacheHitRate:
        logs.length > 0
          ? logs.reduce(
              (sum: number, l: AIPerformanceLog) => sum + (l.cacheHitRate || 0),
              0,
            ) / logs.length
          : 0,
      byOperation: {},
      byModel: {},
    };

    for (const log of logs) {
      if (!stats.byOperation[log.operation]) {
        stats.byOperation[log.operation] = {
          count: 0,
          tokens: 0,
          cost: 0,
          cachedTokens: 0,
          savedCost: 0,
        };
      }
      stats.byOperation[log.operation].count++;
      stats.byOperation[log.operation].tokens += log.totalTokens;
      stats.byOperation[log.operation].cost += log.estimatedCost;
      stats.byOperation[log.operation].cachedTokens +=
        log.cachedInputTokens || 0;
      stats.byOperation[log.operation].savedCost +=
        log.costBreakdown?.savedByCache || 0;

      const modelKey = `${log.provider}/${log.model}`;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = {
          count: 0,
          tokens: 0,
          cost: 0,
          cachedTokens: 0,
          savedCost: 0,
        };
      }
      stats.byModel[modelKey].count++;
      stats.byModel[modelKey].tokens += log.totalTokens;
      stats.byModel[modelKey].cost += log.estimatedCost;
      stats.byModel[modelKey].cachedTokens += log.cachedInputTokens || 0;
      stats.byModel[modelKey].savedCost += log.costBreakdown?.savedByCache || 0;
    }

    return stats;
  }

  getLogsBySession(sessionId: string): AIPerformanceLog[] {
    return this.logs.filter((l) => l.sessionId === sessionId);
  }

  async getSessionStats(sessionId: string): Promise<{
    logs: AIPerformanceLog[];
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    totalDuration: number;
    successCount: number;
    failedCount: number;
  }> {
    const { logs } = await this.getHistoricalLogs({ sessionId, limit: 100 });

    return {
      logs,
      totalRequests: logs.length,
      totalTokens: logs.reduce((sum, l) => sum + l.totalTokens, 0),
      totalCost: logs.reduce((sum, l) => sum + l.estimatedCost, 0),
      totalDuration: logs.reduce((sum, l) => sum + l.duration, 0),
      successCount: logs.filter((l) => l.success).length,
      failedCount: logs.filter((l) => !l.success).length,
    };
  }

  clearLogs(beforeTimestamp?: number): number {
    if (beforeTimestamp) {
      const beforeCount = this.logs.length;
      this.logs = this.logs.filter((l) => l.timestamp >= beforeTimestamp);

      // 异步清理数据库
      (async () => {
        try {
          await getSupabaseAdmin()
            .from("ai_performance_logs")
            .delete()
            .lt("timestamp", beforeTimestamp);
          logger.info(
            `[PerformanceMonitor] Cleared database logs before ${new Date(beforeTimestamp).toISOString()}`,
          );
        } catch (error) {
          logger.error(
            "[PerformanceMonitor] Failed to clear database logs:",
            error,
          );
        }
      })();

      return beforeCount - this.logs.length;
    }
    const count = this.logs.length;
    this.logs = [];

    // 清理所有数据库记录（可选：只清理30天前的）
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    (async () => {
      try {
        await getSupabaseAdmin()
          .from("ai_performance_logs")
          .delete()
          .lt("timestamp", thirtyDaysAgo);
        logger.info(
          `[PerformanceMonitor] Cleared old logs from database (kept last 30 days)`,
        );
      } catch (error) {
        logger.error(
          "[PerformanceMonitor] Failed to clear old database logs:",
          error,
        );
      }
    })();

    return count;
  }

  async withAutoGraphTracking<T>(
    operation: string,
    providerType: AIProviderType,
    model: string,
    fn: () => Promise<{
      result: T;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: {
          cached_tokens?: number;
          audio_tokens?: number;
        };
        completion_tokens_details?: {
          reasoning_tokens?: number;
          audio_tokens?: number;
        };
      };
    }>,
    metadata?: {
      graphId?: string;
      graphTitle?: string;
      userId?: string;
      userName?: string;
      topic?: string;
      nodeTitle?: string;
      nodeId?: string;
      nodeLevel?: string;
      style?: string;
    },
    sessionId?: string,
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedInputTokens = 0;
    let uncachedInputTokens = 0;
    let reasoningTokens = 0;

    try {
      const { result, usage } = await fn();
      inputTokens = usage?.prompt_tokens || 0;
      outputTokens = usage?.completion_tokens || 0;

      cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
      uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
      reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;

      return result;
    } catch (error: unknown) {
      success = false;
      const err = error as Error;
      errorMessage = err.message;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      const totalTokens = inputTokens + outputTokens;
      const cacheHitRate =
        inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;

      const costBreakdown = pricingService.calculateDetailedCost(
        providerType,
        model,
        inputTokens,
        outputTokens,
        cachedInputTokens,
      );

      this.recordLog({
        operation,
        provider: providerType,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: costBreakdown.totalCost,
        duration,
        success,
        errorMessage,
        metadata,
        sessionId,

        cachedInputTokens,
        uncachedInputTokens,
        reasoningTokens,
        cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
        costBreakdown,
      });
    }
  }

  async getDatabaseStats(): Promise<{
    totalRecords: number;
    oldestRecord: string | null;
    newestRecord: string | null;
    totalCost: number;
    totalTokens: number;
  }> {
    const { count: totalRecords } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("*", { count: "exact", head: true });

    const { data: oldest } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("timestamp")
      .order("timestamp", { ascending: true })
      .limit(1)
      .single();

    const { data: newest } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("timestamp")
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    const { data: aggData } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("total_tokens, estimated_cost");

    const totalTokens = (aggData || []).reduce(
      (sum: number, row: { total_tokens?: number; estimated_cost?: number }) =>
        sum + (row.total_tokens || 0),
      0,
    );
    const totalCost = (aggData || []).reduce(
      (sum: number, row: { total_tokens?: number; estimated_cost?: number }) =>
        sum + parseFloat(String(row.estimated_cost || 0)),
      0,
    );

    return {
      totalRecords: totalRecords || 0,
      oldestRecord: oldest
        ? new Date((oldest as { timestamp: number }).timestamp).toISOString()
        : null,
      newestRecord: newest
        ? new Date((newest as { timestamp: number }).timestamp).toISOString()
        : null,
      totalCost,
      totalTokens,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

export interface EnrichedMetadata {
  graphId?: string;
  graphTitle?: string;
  graphDescription?: string;
  userId?: string;
  userName?: string;
  nodeId?: string;
  nodeTitle?: string;
  nodeLevel?: string;
  topic?: string;
  style?: string;
  depth?: number;
  documentName?: string;
  actionName?: string;
}

async function getGraphInfo(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  graphId: string,
): Promise<{ id: string; title: string; description?: string | null } | null> {
  const { data } = await supabase
    .from("knowledge_graphs")
    .select("id, title, description")
    .eq("id", graphId)
    .maybeSingle();
  return data;
}

async function getUserInfo(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<{ id: string; name?: string | null } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export async function enrichMetadata(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  baseMetadata: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
    topic?: string;
    nodeTitle?: string;
    nodeLevel?: string;
    style?: string;
    depth?: number;
    documentName?: string;
    actionName?: string;
  },
): Promise<EnrichedMetadata> {
  const [graphInfo, userInfo] = await Promise.all([
    baseMetadata.graphId ? getGraphInfo(supabase, baseMetadata.graphId) : null,
    baseMetadata.userId ? getUserInfo(supabase, baseMetadata.userId) : null,
  ]);

  return {
    ...baseMetadata,
    graphTitle: graphInfo?.title ?? undefined,
    graphDescription: graphInfo?.description ?? undefined,
    userName: userInfo?.name ?? undefined,
  };
}

import type {
  AIPerformanceLog,
  AIPerformanceStats,
  GetPerformanceLogsQuery,
} from "@shared/types";
import { pricingService } from "./pricingService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { cacheService, CacheTTL } from "../common/cacheService";

const MAX_LOGS = 1000;

interface DatabaseLogRow {
  id: string;
  created_at: string;
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

/**
 * 将数据库行映射为 AIPerformanceLog。
 * 抽出此 helper 以避免 getLogs / getHistoricalLogs / getLogsBySession 重复实现。
 */
const mapRowToLog = (row: DatabaseLogRow): AIPerformanceLog => ({
  id: row.id,
  timestamp: new Date(row.created_at).getTime(),
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
});

class PerformanceMonitor {
  private initialized = false;

  /**
   * 多实例化改造后不再预加载内存 buffer。
   * 此方法保留为生命周期钩子，仅做最小化初始化标记，
   * 所有读取操作改为按需查询 DB（避免多实例间内存状态不一致）。
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    logger.info("[PerformanceMonitor] Initialized (DB-backed, no in-memory buffer)");
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

    // 同步持久化到数据库（多实例下 DB 为唯一真实状态）
    try {
      await this.persistToDatabase(fullLog);
    } catch (err: unknown) {
      logger.warn(
        "[PerformanceMonitor] Failed to persist log to database:",
        err,
      );
    }
  }

  private async persistToDatabase(log: AIPerformanceLog): Promise<void> {
    try {
      const userId = log.metadata?.userId ?? null;
      const { error } = await getSupabaseAdmin().from("ai_performance_logs").insert({
        id: log.id,
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
        user_id: userId,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error("[PerformanceMonitor] Database persist error:", error);
      throw error;
    }
  }

  /**
   * 直接查 DB（多实例化改造：原内存 buffer 已移除）。
   * 应用 operation / provider / success / startTime / endTime 过滤，
   * 按 timestamp DESC 排序，limit/offset 分页。
   */
  async getLogs(query: GetPerformanceLogsQuery = {}): Promise<{
    logs: AIPerformanceLog[];
    total: number;
  }> {
    let dbQuery = getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (query.operation) {
      dbQuery = dbQuery.eq("operation", query.operation);
    }
    if (query.provider) {
      dbQuery = dbQuery.eq("provider", query.provider);
    }
    if (query.success !== undefined) {
      dbQuery = dbQuery.eq("success", query.success);
    }
    if (query.startTime !== undefined) {
      dbQuery = dbQuery.gte("created_at", new Date(query.startTime).toISOString());
    }
    if (query.endTime !== undefined) {
      dbQuery = dbQuery.lte("created_at", new Date(query.endTime).toISOString());
    }

    const offset = query.offset || 0;
    const limit = query.limit || 50;

    const { data, count, error } = await dbQuery.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      logger.error("[PerformanceMonitor] Failed to fetch logs from DB:", error);
      return { logs: [], total: 0 };
    }

    const logs: AIPerformanceLog[] = ((data || []) as DatabaseLogRow[]).map(
      mapRowToLog,
    );

    return {
      logs,
      total: count || 0,
    };
  }

  async getHistoricalLogs(
    query: GetPerformanceLogsQuery & { days?: number; sessionId?: string } = {},
  ): Promise<{ logs: AIPerformanceLog[]; total: number }> {
    let dbQuery = getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (query.days) {
      const startTime = Date.now() - query.days * 24 * 60 * 60 * 1000;
      dbQuery = dbQuery.gte("created_at", new Date(startTime).toISOString());
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
      mapRowToLog,
    );

    return {
      logs,
      total: count || 0,
    };
  }

  /**
   * 聚合统计：从 DB 拉取匹配行（限制 MAX_LOGS），内存计算 stats。
   * 数据源由原内存 buffer 改为 DB 查询，保证多实例一致性。
   */
  async getStats(query: GetPerformanceLogsQuery = {}): Promise<AIPerformanceStats> {
    const { logs } = await this.getLogs({ ...query, limit: MAX_LOGS });

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

  /**
   * 按 sessionId 查询日志（多实例化改造：改为 DB 查询）。
   */
  async getLogsBySession(sessionId: string): Promise<AIPerformanceLog[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(MAX_LOGS);

    if (error) {
      logger.error(
        "[PerformanceMonitor] Failed to fetch logs by session:",
        error,
      );
      return [];
    }

    return ((data || []) as DatabaseLogRow[]).map(mapRowToLog);
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

  /**
   * 清理日志（多实例化改造：内存 buffer 已移除，直接基于 DB 删除并返回删除条数）。
   * - 传 beforeTimestamp：删除该时间戳之前的日志
   * - 不传：删除 30 天前的日志（保留最近 30 天）
   */
  async clearLogs(beforeTimestamp?: number): Promise<number> {
    const cutoff =
      beforeTimestamp ?? Date.now() - 30 * 24 * 60 * 60 * 1000;

    try {
      const { data, error } = await getSupabaseAdmin()
        .from("ai_performance_logs")
        .delete()
        .lt("created_at", new Date(cutoff).toISOString())
        .select("id");

      if (error) {
        logger.error(
          "[PerformanceMonitor] Failed to clear database logs:",
          error,
        );
        return 0;
      }

      const deletedCount = (data || []).length;
      logger.info(
        `[PerformanceMonitor] Cleared ${deletedCount} logs before ${new Date(cutoff).toISOString()}`,
      );
      return deletedCount;
    } catch (error) {
      logger.error(
        "[PerformanceMonitor] Failed to clear database logs:",
        error,
      );
      return 0;
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
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const { data: newest } = await getSupabaseAdmin()
      .from("ai_performance_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
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
        ? (oldest as { created_at: string }).created_at
        : null,
      newestRecord: newest
        ? (newest as { created_at: string }).created_at
        : null,
      totalCost,
      totalTokens,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

export interface EnrichedMetadata {
  [key: string]: unknown;
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
    .from("users")
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
  const graphId = baseMetadata.graphId;
  const userId = baseMetadata.userId;

  const [graphInfo, userInfo] = await Promise.all([
    graphId
      ? cacheService.getOrSet(
          `enrich:graph:${graphId}`,
          () => getGraphInfo(supabase, graphId),
          CacheTTL.DYNAMIC,
          ["enrich", `graph:${graphId}`],
        )
      : Promise.resolve(null),
    userId
      ? cacheService.getOrSet(
          `enrich:user:${userId}`,
          () => getUserInfo(supabase, userId),
          CacheTTL.DYNAMIC,
          ["enrich", `user:${userId}`],
        )
      : Promise.resolve(null),
  ]);

  return {
    ...baseMetadata,
    graphTitle: graphInfo?.title ?? undefined,
    graphDescription: graphInfo?.description ?? undefined,
    userName: userInfo?.name ?? undefined,
  };
}

/**
 * @schedule decision - 跨图图谱学习时长估算（P4 参数化）。
 *
 * 跨图路径的图谱级节点可能对应空图谱（宽度拓展时未生成知识点），此时无法精确
 * 知道知识点数量，只能按「目标拓展规模」统一估算；图谱已有实际节点（深度拓展后）
 * 则按实际节点数计算。
 *
 * 估算公式（task_settings 持久化，可调）：
 *   图谱分钟 = 实际节点数(>0 用实际，否则目标估算数) × node_learning_minutes × (1 + graph_extra_time_ratio)
 *   默认 30 × 40 × 1.25 = 1500 分钟 ≈ 25 小时/图谱
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

export interface GraphTimeEstimateSettings {
  /** 每张图谱按深度拓展后的目标估算知识点数（仅空图谱时兜底使用） */
  nodeCount: number;
  /** 每个知识点预计学习分钟（覆盖学习/上课主体时间） */
  learningMinutes: number;
  /** 额外缓冲比例（练习/复习/测验/生成等） */
  extraTimeRatio: number;
}

export const DEFAULT_GRAPH_ESTIMATED_NODE_COUNT = 30;
export const DEFAULT_NODE_LEARNING_MINUTES = 40;
export const DEFAULT_GRAPH_EXTRA_TIME_RATIO = 0.25;
/** 图谱估算时长下限（分钟）：避免参数被调成极端值后排课退化 */
const MIN_GRAPH_MINUTES = 30;

/**
 * 估算单张图谱学习时长（分钟）：节点数 × 每节点分钟 × (1 + 缓冲比例)。
 * 有实际节点数（actualNodeCount > 0）时用实际，否则回退到目标估算数。
 */
export function estimateGraphMinutes(
  s: GraphTimeEstimateSettings,
  actualNodeCount?: number,
): number {
  const nodeCount =
    actualNodeCount && actualNodeCount > 0 ? actualNodeCount : s.nodeCount;
  return Math.max(
    MIN_GRAPH_MINUTES,
    Math.ceil(nodeCount * s.learningMinutes * (1 + s.extraTimeRatio)),
  );
}

class GraphTimeEstimatorService {
  /** 读取用户级估算参数；task_settings 缺失或非法时回退默认值 */
  async getSettings(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<GraphTimeEstimateSettings> {
    const fallback: GraphTimeEstimateSettings = {
      nodeCount: DEFAULT_GRAPH_ESTIMATED_NODE_COUNT,
      learningMinutes: DEFAULT_NODE_LEARNING_MINUTES,
      extraTimeRatio: DEFAULT_GRAPH_EXTRA_TIME_RATIO,
    };
    try {
      const { data, error } = await supabase
        .from("task_settings")
        .select(
          "graph_estimated_node_count, node_learning_minutes, graph_extra_time_ratio",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return fallback;
      const nodeCount = Number(data.graph_estimated_node_count);
      const learningMinutes = Number(data.node_learning_minutes);
      const ratio = Number(data.graph_extra_time_ratio);
      return {
        nodeCount:
          Number.isFinite(nodeCount) && nodeCount > 0
            ? Math.floor(nodeCount)
            : fallback.nodeCount,
        learningMinutes:
          Number.isFinite(learningMinutes) && learningMinutes > 0
            ? Math.floor(learningMinutes)
            : fallback.learningMinutes,
        extraTimeRatio:
          Number.isFinite(ratio) && ratio >= 0 && ratio <= 5
            ? ratio
            : fallback.extraTimeRatio,
      };
    } catch (err) {
      logger.warn(
        "[GraphTimeEstimator] read task_settings failed, use defaults",
        { userId, err },
      );
      return fallback;
    }
  }

  /** 查询多张图谱的实际节点数（graph_nodes 行数），返回 graph_id -> count */
  async getActualNodeCounts(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const unique = [...new Set(graphIds)].filter((g): g is string => !!g);
    if (unique.length === 0) return counts;
    try {
      const { data, error } = await supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", unique);
      if (error || !data) return counts;
      for (const row of data as Array<{ graph_id?: string | null }>) {
        if (!row.graph_id) continue;
        counts.set(row.graph_id, (counts.get(row.graph_id) ?? 0) + 1);
      }
    } catch (err) {
      logger.warn("[GraphTimeEstimator] fetch actual node counts failed", {
        userId,
        err,
      });
    }
    return counts;
  }

  /**
   * 便捷方法：返回该用户单张图谱的估算分钟。
   * actualNodeCount > 0 时按实际节点数，否则按目标估算数。
   */
  async estimateGraphMinutesForUser(
    supabase: SupabaseClient,
    userId: string,
    actualNodeCount?: number,
  ): Promise<number> {
    const settings = await this.getSettings(supabase, userId);
    return estimateGraphMinutes(settings, actualNodeCount);
  }
}

export const graphTimeEstimatorService = new GraphTimeEstimatorService();
export { GraphTimeEstimatorService };

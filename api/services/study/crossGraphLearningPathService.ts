/**
 * 跨图谱学习路径服务（大调度核心）。
 *
 * 职责：
 * 1. 基于图谱地图（图谱 + graph_relations 前置/扩展/相关 + 领域）生成一条「图谱级」学习顺序
 *    （learning_paths.path_type = 'cross_graph'，节点以 graph_id 为单位）；
 * 2. 供大循环调度使用：返回跨图路径中「下一个该学的图谱」及其 graph_learning 大任务。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { graphCrudService } from "../graph/graphCrudService";
import { learningPathService } from "./learningPathService";
import { stageWindowPlannerService } from "../scheduler/planning/stageWindowPlannerService";
import {
  generateCrossGraphRulePath,
  generateCrossGraphAIPath,
  CROSS_GRAPH_COMPLETION_THRESHOLD,
  type CrossGraphNodeInput,
  type CrossGraphRelationInput,
  type CrossGraphStage,
} from "./crossGraphPathAlgorithms";
import type { GraphRelationType } from "../graph/graphRelationService";

/** 跨图路径默认标题（可读中文文案，落库直接用） */
const DEFAULT_CROSS_GRAPH_PATH_TITLE = "跨图谱学习路径";

export interface CrossGraphPathResult {
  pathId: string;
  pathTitle?: string;
  totalGraphs: number;
  pendingGraphs: number;
  completedGraphs: number;
  stages: CrossGraphStage[];
  suggestions: string[];
  pathReused: boolean;
}

export interface NextGraphInPath {
  graphId: string;
  graphTitle: string;
  order: number;
  completion: number;
  nodeCount: number;
}

/** 跨图路径概览（供首页「下一步」/学习路径面板展示） */
export interface CrossGraphSummary {
  pathId: string;
  pathTitle?: string;
  totalGraphs: number;
  completedGraphs: number;
  pendingGraphs: number;
  /** 路径中下一个待学图谱（全部完成则为 null） */
  nextGraph: NextGraphInPath | null;
  /** 按顺序排列的图谱级阶段（含完成态），供图谱地图叠加学习顺序 */
  stages: Array<{
    graphId: string;
    graphTitle: string;
    order: number;
    completion: number;
    isCompleted: boolean;
  }>;
}

class CrossGraphLearningPathService {
  /**
   * 生成并保存跨图谱学习路径（path_type = cross_graph）。
   * 若已存在 active 跨图路径且未强制重建，则直接复用。
   */
  async generateCrossGraphPath(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      dailyMinutes?: number;
      title?: string;
      force?: boolean;
      /** 自然语言学习目标：提供时走 AI 目标驱动生成，否则用规则算法 */
      targetGoal?: string;
    },
  ): Promise<CrossGraphPathResult> {
    if (!options?.force) {
      const existing = await this.findActiveCrossGraphPath(supabase, userId);
      if (existing) {
        const existingResult = await this.buildResultFromPath(
          supabase,
          userId,
          existing,
          true,
        );
        return existingResult;
      }
    }

    // 1. 拉取图谱地图（图谱 + 关系）
    const mapData = await graphCrudService.getGraphMap(supabase, userId);
    const graphsRaw = mapData.graphs ?? [];
    const relationsRaw = mapData.relations ?? [];

    if (graphsRaw.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "图谱地图为空，无法生成跨图谱学习路径",
      });
    }

    const graphIds = graphsRaw.map((g) => (g as { id: string }).id);
    const completionMap = await this.computeGraphCompletions(
      supabase,
      userId,
      graphIds,
    );

    const graphs: CrossGraphNodeInput[] = graphsRaw.map((g) => {
      const raw = g as {
        id: string;
        title?: string;
        description?: string;
        node_count?: number;
        nodes_count?: number;
        domainIds?: string[];
        domain_ids?: string[];
      };
      return {
        graphId: raw.id,
        title: raw.title ?? raw.id,
        description: raw.description ?? undefined,
        nodeCount: raw.node_count ?? raw.nodes_count ?? 0,
        completion: completionMap.get(raw.id) ?? 0,
        domainIds: raw.domainIds ?? raw.domain_ids ?? [],
      };
    });

    const relations: CrossGraphRelationInput[] = relationsRaw.map((r) => {
      const raw = r as {
        source_graph_id: string;
        target_graph_id: string;
        relation_type: string;
      };
      return {
        sourceGraphId: raw.source_graph_id,
        targetGraphId: raw.target_graph_id,
        relationType: (raw.relation_type ?? "related") as GraphRelationType,
      };
    });

    // 2. 生成图谱级顺序：提供学习目标时走 AI 目标驱动，否则用规则算法
    const targetGoal = options?.targetGoal?.trim();
    const { stages, suggestions } = targetGoal
      ? await generateCrossGraphAIPath(
          supabase,
          userId,
          graphs,
          relations,
          targetGoal,
          options?.dailyMinutes ?? 30,
        )
      : generateCrossGraphRulePath(graphs, relations);

    const title = options?.title ?? DEFAULT_CROSS_GRAPH_PATH_TITLE;
    const dailyMinutes = options?.dailyMinutes ?? 30;

    // 3. 落库为 cross_graph 学习路径（节点以 graph_id 为单位）
    const savedPath = await learningPathService.createLearningPath(
      supabase,
      userId,
      {
        title,
        description: `跨图谱学习路径 · 共 ${stages.length} 张图谱`,
        path_type: "cross_graph",
        daily_minutes_target: dailyMinutes,
        ai_generated: !!targetGoal,
        nodes: stages.map((stage) => ({
          graph_id: stage.graphId,
          order_index: stage.order,
          title: stage.graphTitle,
          description: stage.reason,
          estimated_time: 30,
          is_milestone: stage.priority === "high",
          prerequisites: stage.prerequisites,
        })),
      },
    );

    logger.info("[CrossGraphPath] generated cross-graph path", {
      userId,
      pathId: savedPath.id,
      totalGraphs: stages.length,
      pendingGraphs: stages.filter((s) => !s.isCompleted).length,
    });

    // P2 两级排课：大路径生成后自动排周窗口（失败不阻塞生成）
    stageWindowPlannerService
      .planStageWindows(supabase, userId, savedPath.id)
      .catch((err: unknown) => {
        logger.warn("[CrossGraphPath] plan stage windows failed", {
          pathId: savedPath.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return {
      pathId: savedPath.id,
      pathTitle: savedPath.title,
      totalGraphs: stages.length,
      pendingGraphs: stages.filter((s) => !s.isCompleted).length,
      completedGraphs: stages.filter((s) => s.isCompleted).length,
      stages,
      suggestions,
      pathReused: false,
    };
  }

  /** 查找当前用户 active 的跨图谱学习路径 */
  async findActiveCrossGraphPath(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<{ id: string; title?: string } | null> {
    const { data, error } = await supabase
      .from("learning_paths")
      .select("id, title")
      .eq("user_id", userId)
      .eq("path_type", "cross_graph")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("[CrossGraphPath] findActiveCrossGraphPath error", {
        error: error.message,
      });
      return null;
    }
    return data ?? null;
  }

  /**
   * 大调度核心：返回跨图路径中「下一个该学的图谱」。
   * 按 order_index 遍历，动态计算每张图谱完成度，取第一个未完成（completion < 阈值）的图谱。
   * 若路径全部完成或不存在路径，返回 null。
   */
  async getNextGraphInPath(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<NextGraphInPath | null> {
    const path = await this.findActiveCrossGraphPath(supabase, userId);
    if (!path) return null;

    const { data: nodes, error } = await supabase
      .from("learning_path_nodes")
      .select("id, graph_id, title, order_index, status")
      .eq("path_id", path.id)
      .order("order_index", { ascending: true });

    if (error || !nodes || nodes.length === 0) {
      logger.warn("[CrossGraphPath] getNextGraphInPath no nodes", {
        pathId: path.id,
        error: error?.message,
      });
      return null;
    }

    const graphIds = nodes
      .map((n) => n.graph_id)
      .filter((g): g is string => !!g);
    if (graphIds.length === 0) return null;

    const completionMap = await this.computeGraphCompletions(
      supabase,
      userId,
      graphIds,
    );

    for (const node of nodes) {
      if (!node.graph_id) continue;
      // 路径节点显式完成 或 动态完成度达阈值 → 视为已完成，跳到下一个
      if (node.status === "completed") continue;
      const completion = completionMap.get(node.graph_id) ?? 0;
      if (completion >= CROSS_GRAPH_COMPLETION_THRESHOLD) continue;
      return {
        graphId: node.graph_id,
        graphTitle: (node.title as string) ?? node.graph_id,
        order: node.order_index,
        completion,
        nodeCount: 0,
      };
    }

    return null;
  }

  /**
   * 跨图路径概览：返回 active 跨图路径的总览（完成/待学数 + 下一个待学图谱）。
   * 供首页「下一步」/学习路径面板展示；无路径返回 null。
   */
  async getCrossGraphSummary(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<CrossGraphSummary | null> {
    const path = await this.findActiveCrossGraphPath(supabase, userId);
    if (!path) return null;

    const full = await learningPathService.getLearningPath(
      supabase,
      path.id,
      userId,
    );
    const nodes = (full?.nodes ?? []).sort(
      (a, b) => a.order_index - b.order_index,
    );
    if (nodes.length === 0) return null;

    const graphIds = nodes
      .map((n) => n.graph_id)
      .filter((g): g is string => !!g);
    const completionMap =
      graphIds.length > 0
        ? await this.computeGraphCompletions(supabase, userId, graphIds)
        : new Map<string, number>();

    const stages = nodes.map((n) => {
      const completion = n.graph_id
        ? (completionMap.get(n.graph_id) ?? 0)
        : 0;
      const isCompleted =
        n.status === "completed" ||
        completion >= CROSS_GRAPH_COMPLETION_THRESHOLD;
      return {
        graphId: n.graph_id ?? n.id,
        graphTitle: n.title,
        order: n.order_index,
        completion,
        isCompleted,
      };
    });

    const pending = stages.filter((s) => !s.isCompleted);
    const next = pending[0] ?? null;

    return {
      pathId: path.id,
      pathTitle: path.title,
      totalGraphs: stages.length,
      completedGraphs: stages.length - pending.length,
      pendingGraphs: pending.length,
      nextGraph: next
        ? {
            graphId: next.graphId,
            graphTitle: next.graphTitle,
            order: next.order,
            completion: next.completion,
            nodeCount: 0,
          }
        : null,
      stages: stages.map((s) => ({
        graphId: s.graphId,
        graphTitle: s.graphTitle,
        order: s.order,
        completion: s.completion,
        isCompleted: s.isCompleted,
      })),
    };
  }

  /**
   * 计算每张图谱的学习完成度（0..1）。
   * 依据：graph_learning 大任务下子任务完成率；无任务视为 0。
   */
  async computeGraphCompletions(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ): Promise<Map<string, number>> {
    const completion = new Map<string, number>(graphIds.map((id) => [id, 0]));
    if (graphIds.length === 0) return completion;

    const CHUNK_SIZE = 50;
    const chunks: string[][] = [];
    for (let i = 0; i < graphIds.length; i += CHUNK_SIZE) {
      chunks.push(graphIds.slice(i, i + CHUNK_SIZE));
    }

    const taskResults = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from("user_tasks")
          .select("id, graph_id")
          .eq("user_id", userId)
          .eq("task_type", "graph_learning")
          .in("graph_id", chunk),
      ),
    );

    const taskIdToGraph = new Map<string, string>();
    const taskIds: string[] = [];
    taskResults.forEach((res) => {
      (res.data ?? []).forEach((t) => {
        if (!t.graph_id) return;
        taskIdToGraph.set(t.id, t.graph_id);
        taskIds.push(t.id);
      });
    });

    if (taskIds.length > 0) {
      const taskChunks: string[][] = [];
      for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
        taskChunks.push(taskIds.slice(i, i + CHUNK_SIZE));
      }
      const subtaskResults = await Promise.all(
        taskChunks.map((chunk) =>
          supabase
            .from("task_subtasks")
            .select("task_id, status")
            .in("task_id", chunk),
        ),
      );

      const stat = new Map<
        string,
        { total: number; completed: number }
      >();
      subtaskResults.forEach((res) => {
        (res.data ?? []).forEach((s) => {
          const graphId = taskIdToGraph.get(s.task_id);
          if (!graphId) return;
          const entry = stat.get(graphId) ?? { total: 0, completed: 0 };
          entry.total++;
          if (s.status === "completed") entry.completed++;
          stat.set(graphId, entry);
        });
      });

      stat.forEach((value, graphId) => {
        completion.set(
          graphId,
          value.total > 0 ? value.completed / value.total : 0,
        );
      });
    }

    return completion;
  }

  private async buildResultFromPath(
    supabase: SupabaseClient,
    userId: string,
    path: { id: string; title?: string },
    pathReused: boolean,
  ): Promise<CrossGraphPathResult> {
    const full = await learningPathService.getLearningPath(
      supabase,
      path.id,
      userId,
    );
    const nodes = full?.nodes ?? [];
    const graphIds = nodes
      .map((n) => n.graph_id)
      .filter((g): g is string => !!g);
    const completionMap = await this.computeGraphCompletions(
      supabase,
      userId,
      graphIds,
    );

    const stages: CrossGraphStage[] = nodes
      .sort((a, b) => a.order_index - b.order_index)
      .map((n) => {
        const completion = n.graph_id ? completionMap.get(n.graph_id) ?? 0 : 0;
        const isCompleted =
          n.status === "completed" || completion >= CROSS_GRAPH_COMPLETION_THRESHOLD;
        return {
          graphId: n.graph_id ?? n.id,
          graphTitle: n.title,
          order: n.order_index,
          priority: isCompleted
            ? ("low" as const)
            : completion < 0.6
              ? ("high" as const)
              : ("medium" as const),
          reason: n.description ?? "",
          isCompleted,
          completion,
          prerequisites: n.prerequisites ?? [],
        };
      });

    return {
      pathId: path.id,
      pathTitle: path.title,
      totalGraphs: stages.length,
      pendingGraphs: stages.filter((s) => !s.isCompleted).length,
      completedGraphs: stages.filter((s) => s.isCompleted).length,
      stages,
      suggestions: [],
      pathReused,
    };
  }
}

export const crossGraphLearningPathService =
  new CrossGraphLearningPathService();
export { CrossGraphLearningPathService };

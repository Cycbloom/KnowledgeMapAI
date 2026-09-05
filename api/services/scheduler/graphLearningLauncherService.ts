/** @schedule decision - S2 图谱启动串联：图谱大任务 → 学习路径 → 按路径重排已有子任务（一图一大任务） */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { smartTaskLinker } from "./smartTaskLinker";
import { learningPathService } from "../study/learningPathService";
import { pathSchedulerService } from "./planning/pathSchedulerService";
import { DEFAULT_LEARNING_PATH_TITLE } from "../../../shared/constants/taskTitles";

export interface NextScheduledSubtask {
  id: string;
  title?: string;
  knowledge_point_id?: string;
  learning_path_node_id?: string;
  learning_state?: string;
  position?: number;
}

export interface StartLearningForGraphResult {
  graphTaskId: string;
  pathId: string;
  pathTitle?: string;
  totalSubtaskIds: string[];
  totalTasks: number;
  graphTotalNodes: number;
  /** 按路径顺序首个待执行子任务（position 升序） */
  nextSubtask: NextScheduledSubtask | null;
  pathReused: boolean;
  reordered: boolean;
}

class GraphLearningLauncherService {
  /**
   * 统一「开始学习图谱」入口（一图一大任务模型）：
   *  1. 确保图谱大任务（smartTaskLinker 自动建 graph_learning 任务 + 每知识点一个子任务）
   *  2. 若无 active 学习路径，则用规则算法自动生成并保存
   *  3. 将该图谱大任务下已存在的每知识点子任务按学习路径顺序重排（position/priority/learning_path_node_id）
   *  4. 返回首个待执行子任务作为学习入口
   */
  async startLearningForGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    options?: { daily_minutes?: number },
  ): Promise<StartLearningForGraphResult> {
    const dailyMinutes = options?.daily_minutes ?? 180;

    // 1. 确保图谱大任务（含每知识点子任务）
    const graphTask = await smartTaskLinker.getOrCreateTaskForGraph(
      supabase,
      userId,
      graphId,
    );
    const graphTaskId = graphTask.mainTaskId;

    // 2. 复用或自动生成学习路径
    const existingPath = await this.findActivePathForGraph(supabase, userId, graphId);
    const path = existingPath ?? (await this.generatePathForGraph(supabase, userId, graphId, dailyMinutes));

    // 3. 将现有子任务按路径重排（幂等）
    const reordered = await this.applyPathOrderToSubtasks(
      supabase,
      graphTaskId,
      path.id,
    );

    // 3.5 全自动排课（fire-and-forget，不阻塞学习启动）
    void this.triggerAutoPlan(supabase, userId, path.id);

    // 4. 已按路径排序的子任务列表 + 首个待执行子任务
    const totalSubtaskIds = await this.listOrderedSubtaskIds(supabase, graphTaskId);
    const nextSubtask = await this.findNextSubtask(supabase, graphTaskId);

    logger.info("[GraphLearningLauncher] startLearningForGraph", {
      graphId,
      graphTaskId,
      pathId: path.id,
      pathReused: !!existingPath,
      subtaskCount: totalSubtaskIds.length,
      reordered,
    });

    return {
      graphTaskId,
      pathId: path.id,
      pathTitle: path.title,
      totalSubtaskIds,
      totalTasks: totalSubtaskIds.length,
      graphTotalNodes: graphTask.totalNodes,
      nextSubtask,
      pathReused: !!existingPath,
      reordered,
    };
  }

  private async triggerAutoPlan(
    supabase: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<void> {
    try {
      await pathSchedulerService.planPath(supabase, userId, pathId);
      logger.info("[GraphLearningLauncher] auto plan path done", { pathId });
    } catch (error) {
      logger.warn("[GraphLearningLauncher] auto plan path failed", {
        pathId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async findActivePathForGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ): Promise<{ id: string; title?: string } | null> {
    const { data, error } = await supabase
      .from("learning_paths")
      .select("id, title")
      .eq("user_id", userId)
      .eq("source_graph_id", graphId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("[GraphLearningLauncher] findActivePath error", {
        graphId,
        error: error.message,
      });
      return null;
    }
    return data ?? null;
  }

  private async generatePathForGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    dailyMinutes: number,
  ): Promise<{ id: string; title?: string }> {
    const result = await learningPathService.generateAndSavePath(supabase, userId, graphId, {
      learning_style: "sequential",
      daily_time_minutes: dailyMinutes,
      save_path: true,
      path_title: DEFAULT_LEARNING_PATH_TITLE,
    });

    if (!result.savedPath?.id) {
      logger.error("[GraphLearningLauncher] generated path without saved id", { graphId });
      throw new AppError(ErrorCodes.RESOURCE_PATH_NOT_FOUND, {
        message: "学习路径生成失败，未保存到库",
      });
    }
    return { id: result.savedPath.id, title: result.savedPath.title };
  }

  /**
   * 将图谱大任务下已有子任务按学习路径节点顺序重排。
   * 子任务通过 knowledge_point_id 与路径节点对齐；不在路径中的节点排在末尾。
   * 返回是否发生了新增路径映射。
   */
  private async applyPathOrderToSubtasks(
    supabase: SupabaseClient,
    graphTaskId: string,
    pathId: string,
  ): Promise<boolean> {
    const { data: pathNodes, error: outerError } = await supabase
      .from("learning_path_nodes")
      .select("id, knowledge_point_id, order_index")
      .eq("path_id", pathId)
      .order("order_index", { ascending: true });

    if (outerError) {
      logger.warn("[GraphLearningLauncher] applyPathOrder pathNodes error", {
        error: outerError.message,
      });
      return false;
    }

    const { data: subtasks, error: innerError } = await supabase
      .from("task_subtasks")
      .select("id, knowledge_point_id, learning_path_node_id, position")
      .eq("task_id", graphTaskId);

    if (innerError || !subtasks || subtasks.length === 0) {
      logger.warn("[GraphLearningLauncher] applyPathOrder no subtasks", {
        innerError: innerError?.message,
      });
      return false;
    }

    const kpToPathNode = new Map<string, { id: string; orderIndex: number }>();
    for (const node of pathNodes ?? []) {
      if (node.knowledge_point_id) {
        kpToPathNode.set(node.knowledge_point_id, {
          id: node.id,
          orderIndex: node.order_index,
        });
      }
    }

    const orderedCount = (pathNodes ?? []).length;
    let fallbackPosition = orderedCount;
    let changed = false;
    const now = new Date().toISOString();

    for (const subtask of subtasks) {
      const t = subtask as {
        id: string;
        knowledge_point_id: string | null;
        learning_path_node_id: string | null;
        position: number | null;
      };
      const pathNode = t.knowledge_point_id
        ? kpToPathNode.get(t.knowledge_point_id)
        : undefined;

      const position = pathNode ? pathNode.orderIndex : fallbackPosition++;
      const learningPathNodeId = pathNode ? pathNode.id : null;

      if (t.position !== position || t.learning_path_node_id !== learningPathNodeId) {
        changed = true;
      }

      await supabase
        .from("task_subtasks")
        .update({
          position,
          priority: position,
          learning_path_node_id: learningPathNodeId,
          updated_at: now,
        })
        .eq("id", t.id);
    }

    logger.info("[GraphLearningLauncher] applyPathOrderToSubtasks", {
      graphTaskId,
      pathId,
      subtaskCount: subtasks.length,
      changed,
    });

    return true;
  }

  private async listOrderedSubtaskIds(
    supabase: SupabaseClient,
    graphTaskId: string,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from("task_subtasks")
      .select("id")
      .eq("task_id", graphTaskId)
      .not("learning_path_node_id", "is", null)
      .order("position", { ascending: true });

    if (error) {
      logger.warn("[GraphLearningLauncher] listOrderedSubtaskIds error", {
        error: error.message,
      });
      return [];
    }
    return (data ?? []).map((s) => s.id as string);
  }

  private async findNextSubtask(
    supabase: SupabaseClient,
    graphTaskId: string,
  ): Promise<NextScheduledSubtask | null> {
    const { data } = await supabase
      .from("task_subtasks")
      .select(
        "id, title, knowledge_point_id, learning_path_node_id, learning_state, position",
      )
      .eq("task_id", graphTaskId)
      .not("learning_path_node_id", "is", null)
      .in("status", ["pending", "in_progress"])
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      title: data.title ?? undefined,
      knowledge_point_id: data.knowledge_point_id ?? undefined,
      learning_path_node_id: data.learning_path_node_id ?? undefined,
      learning_state: data.learning_state ?? undefined,
      position: data.position ?? undefined,
    };
  }
}

export const graphLearningLauncherService = new GraphLearningLauncherService();
export { GraphLearningLauncherService };
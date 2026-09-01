import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { transactionExecutor } from "../../database/transactionExecutor";
import type {
  CreateLearningPathInput,
  LearningPath,
  LearningPathProgressSummary,
  LearningPathWithNodeCount,
  UpdateLearningPathInput,
} from "./learningPathTypes";
import type { LearningPathProgressService } from "./learningPathProgressService";

/**
 * 学习路径 CRUD 服务：路径创建、查询、更新、删除。
 * 进度汇总委托 LearningPathProgressService。
 */
export class LearningPathCrudService {
  constructor(private readonly progressService: LearningPathProgressService) {}

  async createLearningPath(
    supabase: SupabaseClient,
    userId: string,
    input: CreateLearningPathInput,
  ): Promise<LearningPath> {
    // Transactional path
    if (transactionExecutor.isAvailable()) {
      try {
        const pathId = await transactionExecutor.executeInTransaction(async (client) => {
          const { rows } = await client.query(
            `INSERT INTO learning_paths (user_id, title, description, goal, target_date, source_graph_id, domain_id, path_type, total_estimated_time, ai_generated, daily_minutes_target, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
             RETURNING id`,
            [
              userId,
              input.title,
              input.description || null,
              input.goal || null,
              input.target_date || null,
              input.source_graph_id || null,
              input.domain_id || null,
              input.path_type || "single_graph",
              input.total_estimated_time || 0,
              input.ai_generated || false,
              input.daily_minutes_target || 30,
            ],
          );

          const newPathId = rows[0].id;

          if (input.nodes && input.nodes.length > 0) {
            const totalEstimatedTime = input.nodes.reduce(
              (sum, n) => sum + (n.estimated_time || 30),
              0,
            );

            for (const node of input.nodes) {
              await client.query(
                `INSERT INTO learning_path_nodes (path_id, knowledge_point_id, graph_id, order_index, title, description, estimated_time, is_milestone, prerequisites, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
                [
                  newPathId,
                  node.knowledge_point_id || null,
                  node.graph_id || null,
                  node.order_index,
                  node.title,
                  node.description || null,
                  node.estimated_time || 30,
                  node.is_milestone || false,
                  node.prerequisites || [],
                ],
              );
            }

            await client.query(
              `UPDATE learning_paths SET total_estimated_time = $1 WHERE id = $2`,
              [totalEstimatedTime, newPathId],
            );
          }

          return newPathId as string;
        });

        const result = await this.getLearningPath(supabase, pathId, userId);
        if (!result) throw new AppError(ErrorCodes.RESOURCE_PATH_NOT_FOUND, { message: "Learning path not found after creation" });
        return result;
      } catch (txError) {
        logger.warn('Transaction failed in createLearningPath, falling back to non-transactional operations', { error: txError });
      }
    } else {
      logger.warn('TransactionExecutor not available, using non-transactional path for createLearningPath');
    }

    // Non-transactional fallback
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .insert({
        user_id: userId,
        title: input.title,
        description: input.description || null,
        goal: input.goal || null,
        target_date: input.target_date || null,
        source_graph_id: input.source_graph_id || null,
        domain_id: input.domain_id || null,
        path_type: input.path_type || "single_graph",
        total_estimated_time: input.total_estimated_time || 0,
        ai_generated: input.ai_generated || false,
        daily_minutes_target: input.daily_minutes_target || 30,
        status: "active",
      })
      .select()
      .single();

    if (pathError) {
      logger.error("createLearningPath error:", pathError);
      throw pathError;
    }

    if (input.nodes && input.nodes.length > 0) {
      const nodesData = input.nodes.map((node) => ({
        path_id: path.id,
        knowledge_point_id: node.knowledge_point_id || null,
        graph_id: node.graph_id || null,
        order_index: node.order_index,
        title: node.title,
        description: node.description || null,
        estimated_time: node.estimated_time || 30,
        is_milestone: node.is_milestone || false,
        prerequisites: node.prerequisites || [],
        status: "pending" as const,
      }));

      const { error: nodesError } = await supabase
        .from("learning_path_nodes")
        .insert(nodesData);

      if (nodesError) {
        logger.error("createLearningPath nodes error:", nodesError);
        await supabase.from("learning_paths").delete().eq("id", path.id);
        throw nodesError;
      }

      const totalEstimatedTime = input.nodes.reduce(
        (sum, n) => sum + (n.estimated_time || 30),
        0,
      );
      await supabase
        .from("learning_paths")
        .update({ total_estimated_time: totalEstimatedTime })
        .eq("id", path.id);

      path.total_estimated_time = totalEstimatedTime;
    }

    const result = await this.getLearningPath(supabase, path.id, userId);
    if (!result) throw new AppError(ErrorCodes.RESOURCE_PATH_NOT_FOUND, { message: "Learning path not found after creation" });
    return result;
  }

  async getLearningPaths(
    supabase: SupabaseClient,
    userId: string,
    status?: string,
  ): Promise<LearningPathWithNodeCount[]> {
    let query = supabase
      .from("learning_paths")
      .select(
        `
        id,
        user_id,
        title,
        description,
        goal,
        target_date,
        source_graph_id,
        domain_id,
        path_type,
        total_estimated_time,
        ai_generated,
        status,
        daily_minutes_target,
        created_at,
        updated_at
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: paths, error } = await query;

    if (error) {
      logger.error("getLearningPaths error:", error);
      throw error;
    }

    if (!paths || paths.length === 0) {
      return [];
    }

    const pathIds = paths.map((p) => p.id);

    const { data: nodesData, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("path_id, status")
      .in("path_id", pathIds);

    if (nodesError) {
      logger.error("getLearningPaths nodes error:", nodesError);
      throw nodesError;
    }

    const nodeStatsMap = new Map<
      string,
      { total: number; completed: number }
    >();

    (nodesData || []).forEach((node) => {
      const stats = nodeStatsMap.get(node.path_id) || {
        total: 0,
        completed: 0,
      };
      stats.total++;
      if (node.status === "completed") {
        stats.completed++;
      }
      nodeStatsMap.set(node.path_id, stats);
    });

    return paths.map((path) => {
      const stats = nodeStatsMap.get(path.id) || { total: 0, completed: 0 };
      return {
        ...path,
        nodes_count: stats.total,
        completed_nodes_count: stats.completed,
      };
    });
  }

  async getLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPath | null> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError) {
      if (pathError.code === "PGRST116") {
        return null;
      }
      logger.error("getLearningPath error:", pathError);
      throw pathError;
    }

    if (!path) {
      return null;
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("*")
      .eq("path_id", pathId)
      .order("order_index", { ascending: true });

    if (nodesError) {
      logger.error("getLearningPath nodes error:", nodesError);
      throw nodesError;
    }

    const progress = await this.getPathProgress(supabase, pathId, userId);

    return {
      ...path,
      nodes: nodes || [],
      progress,
    };
  }

  async updateLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: UpdateLearningPathInput,
  ): Promise<LearningPath> {
    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("learning_paths")
      .update(updateData)
      .eq("id", pathId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("updateLearningPath error:", error);
      throw error;
    }

    if (!data) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return (await this.getLearningPath(
      supabase,
      pathId,
      userId,
    )) as LearningPath;
  }

  async deleteLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    hardDelete: boolean = false,
  ): Promise<void> {
    const { data: path, error: checkError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (checkError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (hardDelete) {
      const { error } = await supabase
        .from("learning_paths")
        .delete()
        .eq("id", pathId)
        .eq("user_id", userId);

      if (error) {
        logger.error("deleteLearningPath hard delete error:", error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("learning_paths")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", pathId)
        .eq("user_id", userId);

      if (error) {
        logger.error("deleteLearningPath archive error:", error);
        throw error;
      }
    }
  }

  async getPathProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPathProgressSummary> {
    return this.progressService.getPathProgress(supabase, pathId, userId);
  }
}

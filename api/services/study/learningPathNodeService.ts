import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { transactionExecutor } from "../../database/transactionExecutor";
import type {
  LearningPathNode,
  CreateLearningPathNodeInput,
  UpdateNodeStatusInput,
} from "./learningPathService";
import type { LearningPathProgressService } from "./learningPathProgressService";
import i18next from "i18next";

export class LearningPathNodeService {
  private progressService: LearningPathProgressService;

  constructor(progressService: LearningPathProgressService) {
    this.progressService = progressService;
  }

  async addNodeToPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: CreateLearningPathNodeInput,
  ): Promise<LearningPathNode> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: node, error } = await supabase
      .from("learning_path_nodes")
      .insert({
        path_id: pathId,
        knowledge_point_id: input.knowledge_point_id || null,
        graph_id: input.graph_id || null,
        order_index: input.order_index,
        title: input.title,
        description: input.description || null,
        estimated_time: input.estimated_time || 30,
        is_milestone: input.is_milestone || false,
        prerequisites: input.prerequisites || [],
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error("addNodeToPath error:", error);
      throw error;
    }

    await this.recalculateTotalTime(supabase, pathId);

    return node;
  }

  async updateNodeStatus(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
    input: UpdateNodeStatusInput,
  ): Promise<LearningPathNode> {
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select("id, path_id, started_at")
      .eq("id", nodeId)
      .eq("path_id", pathId)
      .single();

    if (nodeError || !node) {
      throw new AppError(i18next.t("learningPath.api.errors.nodeNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.forbidden"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const now = new Date().toISOString();
    const nodeUpdateData: Record<string, unknown> = {
      status: input.status,
      updated_at: now,
    };

    if (input.status === "in_progress" && !node.started_at) {
      nodeUpdateData.started_at = now;
    }

    if (input.status === "completed") {
      nodeUpdateData.completed_at = now;
    }

    // Transactional path
    if (transactionExecutor.isAvailable()) {
      try {
        await transactionExecutor.executeInTransaction(async (client) => {
          // Step 1: UPDATE learning_path_nodes status
          const setClauses: string[] = ['status = $1', 'updated_at = $2'];
          const params: unknown[] = [input.status, now];
          let paramIdx = params.length;

          if (input.status === "in_progress" && !node.started_at) {
            paramIdx++;
            setClauses.push(`started_at = $${paramIdx}`);
            params.push(now);
          }

          if (input.status === "completed") {
            paramIdx++;
            setClauses.push(`completed_at = $${paramIdx}`);
            params.push(now);
          }

          paramIdx++;
          const nodeIdParam = paramIdx;
          params.push(nodeId);

          await client.query(
            `UPDATE learning_path_nodes SET ${setClauses.join(', ')} WHERE id = $${nodeIdParam}`,
            params,
          );

          // Step 2: UPSERT learning_path_progress
          const progressSetClauses: string[] = [
            'status = $1',
            'updated_at = $2',
          ];
          const progressParams: unknown[] = [input.status, now];
          let progressParamIdx = progressParams.length;

          if (input.notes !== undefined) {
            progressParamIdx++;
            progressSetClauses.push(`notes = $${progressParamIdx}`);
            progressParams.push(input.notes);
          }
          if (input.time_spent !== undefined) {
            progressParamIdx++;
            progressSetClauses.push(`time_spent = $${progressParamIdx}`);
            progressParams.push(input.time_spent);
          }
          if (input.progress_percentage !== undefined) {
            progressParamIdx++;
            progressSetClauses.push(`progress_percentage = $${progressParamIdx}`);
            progressParams.push(input.progress_percentage);
          }
          if (input.status === "in_progress") {
            progressParamIdx++;
            progressSetClauses.push(`started_at = $${progressParamIdx}`);
            progressParams.push(now);
          }
          if (input.status === "completed") {
            progressParamIdx++;
            progressSetClauses.push(`completed_at = $${progressParamIdx}`);
            progressParams.push(now);
            progressParamIdx++;
            progressSetClauses.push(`progress_percentage = $${progressParamIdx}`);
            progressParams.push(100);
          }

          progressParamIdx++;
          const userIdParam = progressParamIdx;
          progressParams.push(userId);
          progressParamIdx++;
          const pathIdParam = progressParamIdx;
          progressParams.push(pathId);
          progressParamIdx++;
          const nodeIdParam2 = progressParamIdx;
          progressParams.push(nodeId);

          await client.query(
            `INSERT INTO learning_path_progress (user_id, path_id, node_id, ${progressSetClauses.map(c => c.split(' = ')[0]).join(', ')})
             VALUES ($${userIdParam}, $${pathIdParam}, $${nodeIdParam2}, ${progressParams.slice(0, progressSetClauses.length).map((_, i) => `$${i + 1}`).join(', ')})
             ON CONFLICT (user_id, path_id, node_id) DO UPDATE SET ${progressSetClauses.join(', ')}`,
            progressParams,
          );

          // Step 3: Check and UPDATE learning_paths completion status
          const { rows: nodesResult } = await client.query(
            `SELECT id, status FROM learning_path_nodes WHERE path_id = $1`,
            [pathId],
          );

          const totalNodes = nodesResult.length;
          const completedNodes = nodesResult.filter((n: { status: string }) => n.status === 'completed').length;

          if (totalNodes > 0 && completedNodes === totalNodes) {
            await client.query(
              `UPDATE learning_paths SET status = 'completed', updated_at = $1 WHERE id = $2`,
              [now, pathId],
            );
          }
        });
      } catch (txError) {
        logger.warn('Transaction failed in updateNodeStatus, falling back to non-transactional operations', { error: txError });

        // Non-transactional fallback
        const { data: updatedNode, error } = await supabase
          .from("learning_path_nodes")
          .update(nodeUpdateData)
          .eq("id", nodeId)
          .select()
          .single();

        if (error) {
          logger.error("updateNodeStatus error:", error);
          throw error;
        }

        const progressData: Record<string, unknown> = {
          user_id: userId,
          path_id: pathId,
          node_id: nodeId,
          status: input.status,
          updated_at: now,
        };

        if (input.notes !== undefined) {
          progressData.notes = input.notes;
        }
        if (input.time_spent !== undefined) {
          progressData.time_spent = input.time_spent;
        }
        if (input.progress_percentage !== undefined) {
          progressData.progress_percentage = input.progress_percentage;
        }

        if (input.status === "in_progress") {
          progressData.started_at = now;
        }
        if (input.status === "completed") {
          progressData.completed_at = now;
          progressData.progress_percentage = 100;
        }

        const { error: upsertError } = await supabase
          .from("learning_path_progress")
          .upsert(progressData, { onConflict: "user_id,path_id,node_id" });

        if (upsertError) {
          logger.error("updateNodeStatus progress upsert error:", upsertError);
        }

        await this.checkAndUpdatePathCompletion(supabase, pathId, userId);

        return updatedNode;
      }

      // After successful transaction, fetch the updated node
      const { data: updatedNode, error: fetchError } = await supabase
        .from("learning_path_nodes")
        .select("*")
        .eq("id", nodeId)
        .single();

      if (fetchError) {
        logger.error("updateNodeStatus fetch error:", fetchError);
        throw fetchError;
      }

      return updatedNode as LearningPathNode;
    }

    logger.warn('TransactionExecutor not available, using non-transactional path for updateNodeStatus');

    // Non-transactional fallback when transactionExecutor is not available
    const { data: updatedNode, error } = await supabase
      .from("learning_path_nodes")
      .update(nodeUpdateData)
      .eq("id", nodeId)
      .select()
      .single();

    if (error) {
      logger.error("updateNodeStatus error:", error);
      throw error;
    }

    const progressData: Record<string, unknown> = {
      user_id: userId,
      path_id: pathId,
      node_id: nodeId,
      status: input.status,
      updated_at: now,
    };

    if (input.notes !== undefined) {
      progressData.notes = input.notes;
    }
    if (input.time_spent !== undefined) {
      progressData.time_spent = input.time_spent;
    }
    if (input.progress_percentage !== undefined) {
      progressData.progress_percentage = input.progress_percentage;
    }

    if (input.status === "in_progress") {
      progressData.started_at = now;
    }
    if (input.status === "completed") {
      progressData.completed_at = now;
      progressData.progress_percentage = 100;
    }

    const { error: upsertError } = await supabase
      .from("learning_path_progress")
      .upsert(progressData, { onConflict: "user_id,path_id,node_id" });

    if (upsertError) {
      logger.error("updateNodeStatus progress upsert error:", upsertError);
    }

    await this.checkAndUpdatePathCompletion(supabase, pathId, userId);

    return updatedNode;
  }

  async reorderNodes(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    nodeOrders: { id: string; order_index: number }[],
  ): Promise<void> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const updates = nodeOrders.map((item) =>
      supabase
        .from("learning_path_nodes")
        .update({
          order_index: item.order_index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("path_id", pathId),
    );

    const results = await Promise.all(updates);

    for (const result of results) {
      if (result.error) {
        logger.error("reorderNodes error:", result.error);
        throw result.error;
      }
    }
  }

  async removeNodeFromPath(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
  ): Promise<void> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { error } = await supabase
      .from("learning_path_nodes")
      .delete()
      .eq("id", nodeId)
      .eq("path_id", pathId);

    if (error) {
      logger.error("removeNodeFromPath error:", error);
      throw error;
    }

    await this.recalculateTotalTime(supabase, pathId);
  }

  private async recalculateTotalTime(
    supabase: SupabaseClient,
    pathId: string,
  ): Promise<void> {
    const { data: nodes, error } = await supabase
      .from("learning_path_nodes")
      .select("estimated_time")
      .eq("path_id", pathId);

    if (error) {
      logger.error("recalculateTotalTime error:", error);
      return;
    }

    const totalTime = (nodes || []).reduce(
      (sum, n) => sum + (n.estimated_time || 0),
      0,
    );

    await supabase
      .from("learning_paths")
      .update({ total_estimated_time: totalTime })
      .eq("id", pathId);
  }

  private async checkAndUpdatePathCompletion(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<void> {
    const progress = await this.progressService.getPathProgress(supabase, pathId, userId);

    if (
      progress.total_nodes > 0 &&
      progress.completed_nodes === progress.total_nodes
    ) {
      await supabase
        .from("learning_paths")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pathId);
    }
  }
}

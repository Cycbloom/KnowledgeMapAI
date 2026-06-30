import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import type {
  LearningPathProgressSummary,
  LearningPathProgress,
} from "./learningPathService";

export class LearningPathProgressService {
  async updateProgress(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
    input: {
      progress_percentage?: number;
      time_spent?: number;
      notes?: string;
    },
  ): Promise<LearningPathProgress> {
    const { data: existing, error: checkError } = await supabase
      .from("learning_path_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .eq("node_id", nodeId)
      .maybeSingle();

    if (checkError) {
      logger.error("updateProgress check error:", checkError);
      throw checkError;
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      user_id: userId,
      path_id: pathId,
      node_id: nodeId,
      updated_at: now,
    };

    if (input.progress_percentage !== undefined) {
      updateData.progress_percentage = input.progress_percentage;
    }
    if (input.time_spent !== undefined) {
      updateData.time_spent = existing
        ? (existing.time_spent || 0) + input.time_spent
        : input.time_spent;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    if (!existing) {
      updateData.started_at = now;
    }

    const { data, error } = await supabase
      .from("learning_path_progress")
      .upsert(updateData, { onConflict: "user_id,path_id,node_id" })
      .select()
      .single();

    if (error) {
      logger.error("updateProgress error:", error);
      throw error;
    }

    return data;
  }

  async getPathProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPathProgressSummary> {
    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, status, estimated_time")
      .eq("path_id", pathId);

    if (nodesError) {
      logger.error("getPathProgress nodes error:", nodesError);
      throw nodesError;
    }

    if (!nodes || nodes.length === 0) {
      return {
        total_nodes: 0,
        completed_nodes: 0,
        in_progress_nodes: 0,
        pending_nodes: 0,
        skipped_nodes: 0,
        total_time_spent: 0,
        progress_percentage: 0,
      };
    }

    const { data: progressData, error: progressError } = await supabase
      .from("learning_path_progress")
      .select("time_spent")
      .eq("user_id", userId)
      .eq("path_id", pathId);

    if (progressError) {
      logger.error("getPathProgress progress error:", progressError);
    }

    const totalTimeSpent = (progressData || []).reduce(
      (sum, p) => sum + (p.time_spent || 0),
      0,
    );

    const stats = {
      total_nodes: nodes.length,
      completed_nodes: 0,
      in_progress_nodes: 0,
      pending_nodes: 0,
      skipped_nodes: 0,
    };

    nodes.forEach((node) => {
      switch (node.status) {
        case "completed":
          stats.completed_nodes++;
          break;
        case "in_progress":
          stats.in_progress_nodes++;
          break;
        case "skipped":
          stats.skipped_nodes++;
          break;
        default:
          stats.pending_nodes++;
      }
    });

    const progressPercentage =
      stats.total_nodes > 0
        ? Math.round((stats.completed_nodes / stats.total_nodes) * 100)
        : 0;

    return {
      ...stats,
      total_time_spent: totalTimeSpent,
      progress_percentage: progressPercentage,
    };
  }
}

export const learningPathProgressService = new LearningPathProgressService();

/** @schedule decision - 练习/测验会话数据查询：卡片、测验集、子任务、知识点、用户归属 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { StudyCard } from "../../../shared/types/common";
import type { QuizSet } from "../../../shared/types/quiz";
import { notDeleted } from '../common/softDeleteHelper';
import type {
  SubtaskData,
  KnowledgePointData,
  SubtaskWithTaskId,
} from "./subtaskQuizShared";

/**
 * 练习/测验数据查询服务：卡片、测验集、子任务、知识点及用户归属查询。
 */
export class SubtaskQuizQueryService {
  async getPracticeCards(
    supabase: SupabaseClient,
    knowledgePointId: string,
    difficulty?: 1 | 2,
  ): Promise<StudyCard[]> {
    logger.info("Getting practice cards for knowledge point", {
      knowledgePointId,
      difficulty,
    });

    let query = supabase
      .from("study_cards")
      .select("*")
      .eq("knowledge_point_id", knowledgePointId)
      .order("created_at", { ascending: false });

    if (difficulty !== undefined) {
      const difficultyRange = difficulty === 1 ? [1, 2, 3] : [3, 4, 5];
      query = query.in("difficulty", difficultyRange);
    }

    const { data: cards, error } = await query.limit(20);

    if (error) {
      logger.error("Failed to fetch practice cards", {
        knowledgePointId,
        error: error.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    logger.info("Found practice cards", {
      knowledgePointId,
      count: cards?.length ?? 0,
    });

    return (cards as StudyCard[]) ?? [];
  }

  async getQuizSet(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<QuizSet | null> {
    logger.info("Getting quiz set for knowledge point", {
      knowledgePointId,
    });

    const { data: quizSets, error } = await supabase
      .from("quiz_sets")
      .select(
        `
        id,
        user_id,
        graph_id,
        title,
        description,
        config,
        status,
        card_count,
        created_at,
        updated_at
      `,
      )
      .contains("config->knowledgePointIds", JSON.stringify([knowledgePointId]))
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      logger.error("Failed to fetch quiz set", {
        knowledgePointId,
        error: error.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    if (!quizSets || quizSets.length === 0) {
      logger.info("No quiz set found for knowledge point", {
        knowledgePointId,
      });
      return null;
    }

    logger.info("Found quiz set for knowledge point", {
      knowledgePointId,
      quizSetId: quizSets[0].id,
    });

    return quizSets[0] as QuizSet;
  }

  async getSubtaskData(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<SubtaskData> {
    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .select("id, task_id, knowledge_point_id, learning_state, knowledge_points(mastery_level)")
      .eq("id", subtaskId)
      .single();

    if (error || !subtask) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Subtask not found",
        details: { subtaskId },
      });
    }

    const { data: task } = await supabase
      .from("user_tasks")
      .select("user_id")
      .eq("id", (subtask as SubtaskWithTaskId).task_id)
      .single();

    const raw = subtask as SubtaskWithTaskId & {
      knowledge_points?: { mastery_level: number | null }[] | null;
    };
    return {
      id: raw.id,
      task_id: raw.task_id,
      knowledge_point_id: raw.knowledge_point_id,
      learning_state: raw.learning_state as SubtaskData["learning_state"],
      /** @schedule decision - mastery_level READ：从 knowledge_points 读取（调度算法输入） */
      mastery_level: raw.knowledge_points?.[0]?.mastery_level ?? 0,
      user_id: task?.user_id ?? "",
    } as SubtaskData;
  }

  async getKnowledgePointData(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<KnowledgePointData> {
    const { data: kp, error } = await supabase
      .from("knowledge_points")
      .select("id, title, content")
      .eq("id", knowledgePointId)
      .single();

    if (error || !kp) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Knowledge point not found",
        details: { knowledgePointId },
      });
    }

    const { data: graphNode } = await notDeleted(supabase
      .from("graph_nodes")
      .select("graph_id")
      .eq("knowledge_point_id", knowledgePointId)
      )
      .limit(1)
      .single();

    return {
      ...kp,
      graph_id: graphNode?.graph_id,
    } as KnowledgePointData;
  }

  async getUserIdForKnowledgePoint(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<string> {
    const { data: subtask } = await supabase
      .from("task_subtasks")
      .select("task_id")
      .eq("knowledge_point_id", knowledgePointId)
      .limit(1)
      .single();

    if (subtask) {
      const { data: task } = await supabase
        .from("user_tasks")
        .select("user_id")
        .eq("id", (subtask as SubtaskWithTaskId).task_id)
        .single();

      if (task?.user_id) {
        return task.user_id;
      }
    }

    const { data: graphNode } = await notDeleted(supabase
      .from("graph_nodes")
      .select("graph_id")
      .eq("knowledge_point_id", knowledgePointId)
      )
      .limit(1)
      .single();

    if (graphNode?.graph_id) {
      const { data: graph } = await supabase
        .from("knowledge_graphs")
        .select("owner_id")
        .eq("id", graphNode.graph_id)
        .single();

      if (graph?.owner_id) {
        return graph.owner_id;
      }
    }

    throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
      message: "Could not determine user for knowledge point",
    });
  }
}

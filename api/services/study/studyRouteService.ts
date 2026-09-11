import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { studyService } from "./studyService";
import type { StudyCard } from "../../../shared/types/common";
import { notDeleted } from '../common/softDeleteHelper';

interface CreateCardWithGraphNodeData {
  knowledge_point_id: string;
  question: string;
  answer: string;
  explanation?: string;
  card_type?: StudyCard["card_type"];
  options?: string[];
}

interface CardBatchItem {
  knowledge_point_id: string;
  question: string;
  answer: string;
  explanation?: string;
  card_type?: StudyCard["card_type"];
  type?: StudyCard["card_type"];
  options?: string[];
}

export class StudyRouteService {
  static parseCardQueryParams(query: Record<string, unknown>): {
    graphId: string | undefined;
    knowledgePointId: string | undefined;
    knowledgePointIds: string[] | undefined;
    dueOnly: boolean;
    refresh: boolean;
    page: number | undefined;
    pageSize: number | undefined;
    search: string | undefined;
    cardType: string | undefined;
    fsrsState: string | undefined;
    reviewCountMin: number | undefined;
    reviewCountMax: number | undefined;
    nextReviewStart: string | undefined;
    nextReviewEnd: string | undefined;
  } {
    const graphId = query.graph_id as string | undefined;
    const knowledgePointId = query.knowledge_point_id as string | undefined;
    const dueOnly = query.due === "true" || query.due === "1";
    const refresh = query.refresh === "true";

    let knowledgePointIds: string[] | undefined;
    if (query.knowledge_point_ids) {
      knowledgePointIds = (query.knowledge_point_ids as string).split(",");
    }

    const toPositiveInt = (v: unknown): number | undefined => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    };

    const page = toPositiveInt(query.page);
    const pageSize = toPositiveInt(query.page_size) ?? toPositiveInt(query.pageSize);

    const toFloat = (v: unknown): number | undefined => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      graphId,
      knowledgePointId,
      knowledgePointIds,
      dueOnly,
      refresh,
      page,
      pageSize,
      search: query.search as string | undefined,
      cardType: query.card_type as string | undefined,
      fsrsState: query.fsrs_state as string | undefined,
      reviewCountMin: toFloat(query.review_count_min),
      reviewCountMax: toFloat(query.review_count_max),
      nextReviewStart: query.next_review_start as string | undefined,
      nextReviewEnd: query.next_review_end as string | undefined,
    };
  }

  async createCardWithGraphNode(
    supabase: SupabaseClient,
    userId: string,
    data: CreateCardWithGraphNodeData,
  ) {
    const { data: graphNode } = await notDeleted(supabase
      .from("graph_nodes")
      .select("graph_id")
      .eq("knowledge_point_id", data.knowledge_point_id)
      )
      .single();

    if (!graphNode) {
      throw new AppError(i18next.t("study.api.errors.nodeNotFound"), 404, ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    try {
      const card = await studyService.createCard(supabase, {
        userId,
        knowledgePointId: data.knowledge_point_id,
        sourceGraphId: graphNode.graph_id,
        question: data.question,
        answer: data.answer,
        explanation: data.explanation,
        cardType: data.card_type,
        options: data.options,
      });

      return card;
    } catch (error) {
      const err = error as Error;
      logger.error("Error creating card:", error);
      throw new AppError(
        err.message || i18next.t("study.api.errors.createCardFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async createCardsBatchWithGraphNodes(
    supabase: SupabaseClient,
    userId: string,
    cards: CardBatchItem[],
  ) {
    const knowledgePointIds = [
      ...new Set(cards.map((c) => c.knowledge_point_id)),
    ];

    const { data: graphNodes } = await notDeleted(supabase
      .from("graph_nodes")
      .select("knowledge_point_id, graph_id")
      .in("knowledge_point_id", knowledgePointIds)
      );

    const nodeGraphMap = new Map(
      graphNodes?.map((gn) => [gn.knowledge_point_id, gn.graph_id]),
    );

    const cardsData = cards.map((card) => ({
      knowledgePointId: card.knowledge_point_id,
      sourceGraphId: nodeGraphMap.get(card.knowledge_point_id),
      question: card.question,
      answer: card.answer,
      explanation: card.explanation,
      cardType: card.card_type || card.type,
      options: card.options,
    }));

    try {
      const createdCards = await studyService.createCardsBatch(
        supabase,
        cardsData,
        userId,
      );
      return createdCards;
    } catch (error) {
      const err = error as Error;
      logger.error("Error creating cards batch:", error);
      throw new AppError(
        err.message || i18next.t("study.api.errors.createCardFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async getProgress(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    const { data, error } = await supabase
      .from("study_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("graph_id", graphId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError(
        error.message || i18next.t("study.api.errors.getProgressFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    return data || { message: "No progress recorded yet" };
  }
}

export const studyRouteService = new StudyRouteService();

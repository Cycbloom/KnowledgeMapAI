import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { studyService } from "./studyService";
import { graphNodeService } from "../graph/index";
import { aiService } from "../ai/aiService";
import { getSupabaseAdmin } from "../../supabase";
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

interface SyncGenerateCardsConfig {
  types?: string[];
  count?: number;
  provider?: string;
  model?: string;
}

interface SyncGenerateCardsResult {
  nodeId: string;
  success: boolean;
  count: number;
  error?: string;
}

function createDefaultFSRSState() {
  return {
    next_review: new Date().toISOString(),
    difficulty: 1,
    fsrs_state: "New" as const,
    fsrs_stability: 0,
    fsrs_difficulty: 0,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_retrievability: 0,
  };
}

export class StudyRouteService {
  static parseCardQueryParams(query: Record<string, unknown>): {
    graphId: string | undefined;
    knowledgePointId: string | undefined;
    knowledgePointIds: string[] | undefined;
    dueOnly: boolean;
    refresh: boolean;
  } {
    const graphId = query.graph_id as string | undefined;
    const knowledgePointId = query.knowledge_point_id as string | undefined;
    const dueOnly = query.due === "true" || query.due === "1";
    const refresh = query.refresh === "true";

    let knowledgePointIds: string[] | undefined;
    if (query.knowledge_point_ids) {
      knowledgePointIds = (query.knowledge_point_ids as string).split(",");
    }

    return { graphId, knowledgePointId, knowledgePointIds, dueOnly, refresh };
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

  async syncGenerateCardsForNodes(
    userId: string,
    nodeIds: string[],
    config: SyncGenerateCardsConfig = {},
  ): Promise<{
    results: SyncGenerateCardsResult[];
    summary: { total: number; successCount: number; totalCards: number };
  }> {
    const results: SyncGenerateCardsResult[] = [];

    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(
      getSupabaseAdmin(),
      nodeIds,
    );

    if (!graphNodes || graphNodes.length === 0) {
      return {
        results: [],
        summary: { total: 0, successCount: 0, totalCards: 0 },
      };
    }

    const types = config.types || ["qa", "choice"];
    const count = config.count || 3;

    for (const gn of graphNodes) {
      try {
        const aiResult = await aiService.generateCards(
          gn.title || "",
          gn.content || "",
          {
            types,
            count,
            provider: config.provider as import("@shared/types").AIProviderType | undefined,
            model: config.model,
            userId,
            graphId: gn.graph_id,
          },
        );

        const cards = (aiResult.cards || []) as Array<{
          question: string;
          answer: string;
          explanation?: string;
          type?: string;
          options?: unknown;
        }>;

        if (cards.length > 0) {
          const defaultFSRS = createDefaultFSRSState();
          const cardsToInsert = cards.map((card) => ({
            user_id: userId,
            knowledge_point_id: gn.knowledge_point_id,
            graph_id: gn.graph_id,
            question: card.question,
            answer: card.answer,
            explanation: card.explanation || null,
            card_type: card.type ?? "qa",
            options: card.options ? JSON.stringify(card.options) : null,
            ...defaultFSRS,
          }));

          const insertResult = await studyService.insertCards(
            getSupabaseAdmin(),
            cardsToInsert,
          );

          if (!insertResult.success) {
            logger.error(
              `Failed to insert cards for node ${gn.knowledge_point_id}:`,
              insertResult.error,
            );
            results.push({
              nodeId: gn.knowledge_point_id,
              success: false,
              count: 0,
              error: insertResult.error,
            });
          } else {
            results.push({
              nodeId: gn.knowledge_point_id,
              success: true,
              count: cards.length,
            });
          }
        } else {
          results.push({
            nodeId: gn.knowledge_point_id,
            success: true,
            count: 0,
          });
        }
      } catch (err) {
        logger.error(
          `Failed to generate cards for node ${gn.knowledge_point_id}:`,
          err,
        );
        results.push({
          nodeId: gn.knowledge_point_id,
          success: false,
          count: 0,
          error: (err as Error).message || "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCards = results.reduce((sum, r) => sum + r.count, 0);

    return {
      results,
      summary: { total: results.length, successCount, totalCards },
    };
  }
}

export const studyRouteService = new StudyRouteService();

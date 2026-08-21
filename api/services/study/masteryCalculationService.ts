/** @mastery display */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import {
  computeCardDisplayMastery,
  aggregateDisplayMastery,
  type CardWithDisplayMastery,
} from "../../../shared/utils/fsrs/masteryContract";

// 学习状态到初始掌握度的映射
const LEARNING_STATUS_INITIAL_MASTERY: Record<string, number> = {
  new: 0.1,
  learning: 0.2,
  review: 0.35,
  practice: 0.55,
  quiz: 0.75,
  mastery: 0.9,
};

interface StudyCardForMastery {
  knowledge_point_id: string;
  fsrs_retrievability: number | null;
  fsrs_stability: number | null;
  fsrs_last_review: string | null;
}

interface KnowledgePointForMastery {
  id: string;
  learning_status: string | null;
}

export class MasteryCalculationService {
  /**
   * 计算单个知识点的 mastery_level
   * 优先使用 FSRS retrievability 加权平均，其次使用学习状态估算
   */
  async calculateMasteryLevel(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<number> {
    // 1. 查询该知识点的 study_cards
    const { data: cards } = await supabase
      .from("study_cards")
      .select("knowledge_point_id, fsrs_retrievability, fsrs_stability, fsrs_last_review")
      .eq("knowledge_point_id", knowledgePointId);

    if (cards && cards.length > 0) {
      return this.aggregateFromCards(cards as StudyCardForMastery[]);
    }

    // 2. 无 study_cards，查询学习状态
    const { data: kp } = await supabase
      .from("knowledge_points")
      .select("id, learning_status")
      .eq("id", knowledgePointId)
      .single();

    if (kp?.learning_status) {
      return LEARNING_STATUS_INITIAL_MASTERY[kp.learning_status] ?? 0;
    }

    return 0;
  }

  /**
   * 批量计算多个知识点的 mastery_level
   * 使用两次批量查询代替 N+1，性能更优
   */
  async batchCalculateMasteryLevels(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    if (knowledgePointIds.length === 0) return result;

    // 1. 批量查询所有相关 study_cards
    const { data: cards } = await supabase
      .from("study_cards")
      .select("knowledge_point_id, fsrs_retrievability, fsrs_stability, fsrs_last_review")
      .in("knowledge_point_id", knowledgePointIds);

    // 按 knowledge_point_id 分组
    const cardsByKp = new Map<string, StudyCardForMastery[]>();
    for (const card of (cards ?? []) as StudyCardForMastery[]) {
      const kpId = card.knowledge_point_id;
      if (!cardsByKp.has(kpId)) {
        cardsByKp.set(kpId, []);
      }
      const list = cardsByKp.get(kpId);
      if (list) {
        list.push(card);
      }
    }

    // 对有 cards 的知识点计算加权平均
    const kpsWithoutCards: string[] = [];
    for (const kpId of knowledgePointIds) {
      const kpCards = cardsByKp.get(kpId);
      if (kpCards && kpCards.length > 0) {
        result.set(kpId, this.aggregateFromCards(kpCards));
      } else {
        kpsWithoutCards.push(kpId);
      }
    }

    // 2. 对无 cards 的知识点，查询学习状态
    if (kpsWithoutCards.length > 0) {
      const { data: kps } = await supabase
        .from("knowledge_points")
        .select("id, learning_status")
        .in("id", kpsWithoutCards);

      for (const kp of (kps ?? []) as KnowledgePointForMastery[]) {
        result.set(
          kp.id,
          kp.learning_status
            ? (LEARNING_STATUS_INITIAL_MASTERY[kp.learning_status] ?? 0)
            : 0,
        );
      }

      // 完全无记录的知识点
      for (const kpId of kpsWithoutCards) {
        if (!result.has(kpId)) {
          result.set(kpId, 0);
        }
      }
    }

    return result;
  }

  /**
   * 从 study_cards 聚合计算 mastery_level
   * 每张卡片先通过 computeCardDisplayMastery 计算 displayMastery，
   * 再通过 aggregateDisplayMastery 按 stabilityWeighted 策略聚合
   */
  private aggregateFromCards(cards: StudyCardForMastery[]): number {
    const nowMs = Date.now();
    const enriched: CardWithDisplayMastery[] = cards.map((card) => ({
      fsrs_stability: card.fsrs_stability,
      fsrs_last_review: card.fsrs_last_review,
      fsrs_retrievability: card.fsrs_retrievability,
      displayMastery: computeCardDisplayMastery(
        {
          fsrs_stability: card.fsrs_stability,
          fsrs_last_review: card.fsrs_last_review,
          fsrs_retrievability: card.fsrs_retrievability,
        },
        nowMs,
      ),
    }));
    return aggregateDisplayMastery(enriched, 'stabilityWeighted');
  }

  /**
   * 更新单个知识点的 mastery_level 到数据库
   */
  async updateKnowledgePointMastery(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<number> {
    const masteryLevel = await this.calculateMasteryLevel(supabase, knowledgePointId);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("knowledge_points")
      .update({
        mastery_level: masteryLevel,
        updated_at: now,
      })
      .eq("id", knowledgePointId);

    if (error) {
      logger.error("Failed to update knowledge point mastery_level", {
        knowledgePointId,
        error: error.message,
      });
    }

    return masteryLevel;
  }

  /**
   * 批量更新多个知识点的 mastery_level 到数据库
   * mastery_level 单一来源：仅写入 knowledge_points（task_subtasks 通过 JOIN 读取）
   */
  async batchUpdateMasteryLevels(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<Map<string, number>> {
    const masteryMap = await this.batchCalculateMasteryLevels(supabase, knowledgePointIds);
    const now = new Date().toISOString();

    for (const [kpId, masteryLevel] of masteryMap) {
      // 更新 knowledge_points（单一来源，不再同步到 task_subtasks）
      const { error: kpError } = await supabase
        .from("knowledge_points")
        .update({
          mastery_level: masteryLevel,
          updated_at: now,
        })
        .eq("id", kpId);

      if (kpError) {
        logger.error("Failed to update knowledge point mastery", {
          knowledgePointId: kpId,
          error: kpError.message,
        });
      }
    }

    return masteryMap;
  }
}

export const masteryCalculationService = new MasteryCalculationService();

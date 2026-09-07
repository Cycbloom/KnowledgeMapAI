import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

export interface MasteryHealthResponse {
  totalPoints: number;
  avgMastery: number;
  masteredCount: number;
  learningCount: number;
  weakCount: number;
  masteryBuckets: Array<{ range: string; count: number }>;
  weakPoints: Array<{ id: string; title: string; mastery: number }>;
  totalCards: number;
  avgStability: number;
  avgRetrievability: number;
  stabilityBuckets: Array<{ range: string; count: number }>;
  retrievabilityBuckets: Array<{ range: string; count: number }>;
}

/** knowledge_points.title 为 Json（可能为字符串或 {zh,en}），统一归一化为字符串。 */
function resolveKpTitle(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return String(
      obj.zh ?? obj["zh-CN"] ?? obj.en ?? obj["en-US"] ?? "",
    );
  }
  return "";
}

/**
 * 知识掌握度与记忆健康聚合服务。
 *
 * 从 knowledge_points（mastery_level）与 study_cards（FSRS 稳定性/可提取性）
 * 聚合当前掌握度分布、弱项知识点与记忆健康分桶，供统计中心展示。
 * 与 study_cards 状态分布（New/Learning/Review）互补：这里反映的是
 * 知识层掌握度与记忆强度的真实分布。
 */
class MasteryHealthService {
  async getMasteryHealth(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<MasteryHealthResponse> {
    const [kpRes, cardRes] = await Promise.all([
      supabase
        .from("knowledge_points")
        .select("id, title, mastery_level")
        .eq("owner_id", userId),
      supabase
        .from("study_cards")
        .select("fsrs_stability, fsrs_retrievability")
        .eq("user_id", userId),
    ]);

    if (kpRes.error) {
      logger.error("[MasteryHealth] Failed to fetch knowledge points:", kpRes.error);
      throw kpRes.error;
    }
    if (cardRes.error) {
      logger.error("[MasteryHealth] Failed to fetch study cards:", cardRes.error);
      throw cardRes.error;
    }

    const kps = (kpRes.data ?? []) as Array<{
      id: string;
      title: unknown;
      mastery_level: number | null;
    }>;
    const cards = (cardRes.data ?? []) as Array<{
      fsrs_stability: number | null;
      fsrs_retrievability: number | null;
    }>;

    // ---- 掌握度聚合 ----
    const masteryBuckets: Array<{ range: string; count: number }> = [
      { range: "0-20", count: 0 },
      { range: "20-40", count: 0 },
      { range: "40-60", count: 0 },
      { range: "60-80", count: 0 },
      { range: "80-100", count: 0 },
    ];
    let masterySum = 0;
    let masteredCount = 0;
    let learningCount = 0;
    let weakCount = 0;
    const weakCandidates: Array<{ id: string; title: string; mastery: number }> = [];

    for (const kp of kps) {
      const mastery = kp.mastery_level;
      if (mastery === null || mastery === undefined) continue;
      const clamped = Math.max(0, Math.min(1, mastery));
      masterySum += clamped;

      const pct = clamped * 100;
      if (pct < 20) masteryBuckets[0].count += 1;
      else if (pct < 40) masteryBuckets[1].count += 1;
      else if (pct < 60) masteryBuckets[2].count += 1;
      else if (pct < 80) masteryBuckets[3].count += 1;
      else masteryBuckets[4].count += 1;

      if (clamped >= 0.8) masteredCount += 1;
      else if (clamped >= 0.45) learningCount += 1;
      else weakCount += 1;

      if (clamped < 0.45) {
        weakCandidates.push({
          id: kp.id,
          title: resolveKpTitle(kp.title) || kp.id.slice(0, 8),
          mastery: Math.round(clamped * 1000) / 1000,
        });
      }
    }
    weakCandidates.sort((a, b) => a.mastery - b.mastery);

    // ---- 记忆健康聚合 ----
    const stabilityBuckets: Array<{ range: string; count: number }> = [
      { range: "<30", count: 0 },
      { range: "30-90", count: 0 },
      { range: "90-180", count: 0 },
      { range: "180+", count: 0 },
    ];
    const retrievabilityBuckets: Array<{ range: string; count: number }> = [
      { range: "<60", count: 0 },
      { range: "60-80", count: 0 },
      { range: "80-90", count: 0 },
      { range: "90+", count: 0 },
    ];
    let stabilitySum = 0;
    let retrievabilitySum = 0;
    let stabilityCount = 0;
    let retrievabilityCount = 0;

    for (const card of cards) {
      if (card.fsrs_stability !== null && card.fsrs_stability !== undefined) {
        const s = card.fsrs_stability;
        stabilitySum += s;
        stabilityCount += 1;
        if (s < 30) stabilityBuckets[0].count += 1;
        else if (s < 90) stabilityBuckets[1].count += 1;
        else if (s < 180) stabilityBuckets[2].count += 1;
        else stabilityBuckets[3].count += 1;
      }
      if (
        card.fsrs_retrievability !== null &&
        card.fsrs_retrievability !== undefined
      ) {
        const r = card.fsrs_retrievability;
        retrievabilitySum += r;
        retrievabilityCount += 1;
        const pct = r * 100;
        if (pct < 60) retrievabilityBuckets[0].count += 1;
        else if (pct < 80) retrievabilityBuckets[1].count += 1;
        else if (pct < 90) retrievabilityBuckets[2].count += 1;
        else retrievabilityBuckets[3].count += 1;
      }
    }

    return {
      totalPoints: kps.filter((k) => k.mastery_level !== null).length,
      avgMastery:
        kps.length > 0
          ? Math.round((masterySum / kps.length) * 1000) / 1000
          : 0,
      masteredCount,
      learningCount,
      weakCount,
      masteryBuckets,
      weakPoints: weakCandidates.slice(0, 8),
      totalCards: cards.length,
      avgStability:
        stabilityCount > 0
          ? Math.round((stabilitySum / stabilityCount) * 10) / 10
          : 0,
      avgRetrievability:
        retrievabilityCount > 0
          ? Math.round((retrievabilitySum / retrievabilityCount) * 1000) / 1000
          : 0,
      stabilityBuckets,
      retrievabilityBuckets,
    };
  }
}

export const masteryHealthService = new MasteryHealthService();

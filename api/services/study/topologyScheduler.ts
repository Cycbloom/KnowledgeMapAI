import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import type { UnifiedReviewItem } from "./spacedRepetitionBridge";
import { notDeleted } from '../common/softDeleteHelper';

const MASTERY_THRESHOLD = 0.6;

/**
 * Topology-aware review scheduler.
 *
 * Demotes review items whose prerequisite knowledge points have not yet
 * reached the mastery threshold, so that learners are not prompted to
 * review a node before its prerequisites are sufficiently mastered.
 *
 * Within each urgency group, demoted items are moved to the end of the
 * group while preserving their relative order. Urgency group ordering
 * (overdue → today → upcoming → future) is preserved.
 */
export async function applyTopologyPriority(
  items: UnifiedReviewItem[],
  supabase: SupabaseClient,
  userId: string,
): Promise<UnifiedReviewItem[]> {
  if (items.length === 0) return items;

  const kpIds = items.map((i) => i.knowledgePointId).filter(Boolean);
  if (kpIds.length === 0) return items;

  try {
    // 1. Query prerequisite edges targeting any of the review queue KP ids.
    const { data: edges, error: edgesError } = await notDeleted(supabase
      .from("edges")
      .select("source_knowledge_point_id, target_knowledge_point_id")
      .eq("relationship_type", "prerequisite")
      .in("target_knowledge_point_id", kpIds)
      );

    if (edgesError) throw edgesError;
    if (!edges || edges.length === 0) return items;

    // 2. Build prerequisite map: targetKpId -> sourceKpId[]
    const prereqMap = new Map<string, string[]>();
    const allSourceIds = new Set<string>();
    for (const edge of edges) {
      const target = edge.target_knowledge_point_id as string | null;
      const source = edge.source_knowledge_point_id as string | null;
      if (!target || !source) continue;
      const arr = prereqMap.get(target);
      if (arr) arr.push(source);
      else prereqMap.set(target, [source]);
      allSourceIds.add(source);
    }

    if (allSourceIds.size === 0) return items;

    // 3. Batch-fetch prerequisite mastery from study_cards.
    const { data: prereqCards, error: cardsError } = await supabase
      .from("study_cards")
      .select("knowledge_point_id, fsrs_retrievability")
      .eq("user_id", userId)
      .in("knowledge_point_id", Array.from(allSourceIds));

    if (cardsError) throw cardsError;

    const masteryMap = new Map<string, number>();
    for (const card of prereqCards ?? []) {
      const kpId = card.knowledge_point_id as string | null;
      if (!kpId) continue;
      masteryMap.set(kpId, Number(card.fsrs_retrievability ?? 0));
    }

    // 4. Mark items whose prerequisites are not yet mastered.
    const demotedIds = new Set<string>();
    for (const item of items) {
      const prereqs = prereqMap.get(item.knowledgePointId);
      if (!prereqs) continue;
      const hasUnmastered = prereqs.some((src) => {
        const m = masteryMap.get(src);
        return m === undefined || m < MASTERY_THRESHOLD;
      });
      if (hasUnmastered) demotedIds.add(item.id);
    }

    if (demotedIds.size === 0) return items;

    // 5. Per-urgency group: demote flagged items to the end of the group.
    const urgencyOrder = ["overdue", "today", "upcoming", "future"] as const;
    const result: UnifiedReviewItem[] = [];
    for (const urgency of urgencyOrder) {
      const group = items.filter((i) => i.urgency === urgency);
      if (group.length === 0) continue;
      const nonDemoted = group.filter((i) => !demotedIds.has(i.id));
      const demoted = group.filter((i) => demotedIds.has(i.id));
      result.push(...nonDemoted, ...demoted);
    }

    return result;
  } catch (error) {
    logger.warn("[TopologyScheduler] Failed to apply topology priority:", error);
    return items;
  }
}

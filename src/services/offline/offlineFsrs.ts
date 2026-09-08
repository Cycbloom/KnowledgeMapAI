import {
  fsrs,
  State,
  Rating,
  migrateParameters,
  type FSRSParameters,
  type Card,
} from "ts-fsrs";
import type { StudyCard } from "@shared/types/common";
import {
  dbCardToFSRS,
  mapQualityToRating,
} from "@shared/utils/fsrs/cardConversion";
import { stabilityToMasteryBaseline } from "@shared/utils/fsrs/masteryContract";
import { resolveLocalizedText } from "@shared/utils/localization";
import { createLogger } from "@/utils/logger";
import {
  getById,
  getMeta,
  putRecord,
  getAll,
} from "./offlineDb";
import type { OfflineGraphRow, OfflineKnowledgePointRow } from "@shared/types";

const logger = createLogger("OfflineFsrs");

interface FsrsUserSettings {
  request_retention?: number;
  maximum_interval?: number;
  fsrs_parameters?: number[];
}

function buildFSRSInstance(settings: FsrsUserSettings | null) {
  const params: Partial<FSRSParameters> = {};
  if (settings?.request_retention) {
    params.request_retention = Number(settings.request_retention);
  }
  if (settings?.maximum_interval) {
    params.maximum_interval = Number(settings.maximum_interval);
  }
  if (Array.isArray(settings?.fsrs_parameters)) {
    try {
      const migratedW = migrateParameters(settings.fsrs_parameters as number[]);
      if (
        Array.isArray(migratedW) &&
        migratedW.length >= 21 &&
        migratedW.every((w) => Number.isFinite(w))
      ) {
        params.w = migratedW;
      }
    } catch {
      // 参数异常时退回默认 w
    }
  }
  return fsrs(params);
}

/** 为卡片补全来源标题（与后端 enrichCardWithSource 同口径） */
export function enrichCardWithSource(
  card: StudyCard,
  graphs: OfflineGraphRow[],
  knowledgePoints: OfflineKnowledgePointRow[],
): StudyCard {
  const kp = knowledgePoints.find((p) => p.id === card.knowledge_point_id);
  const graph = graphs.find((g) => g.id === card.graph_id);
  return {
    ...card,
    knowledgePointTitle: kp?.title
      ? resolveLocalizedText(kp.title as string | Record<string, string> | null | undefined)
      : null,
    graphTitle: graph?.title
      ? resolveLocalizedText(graph.title as string | Record<string, string> | null | undefined)
      : null,
  };
}

/**
 * 本地 FSRS 进度更新：读卡 → 客户端算法调度 → 写回 + 记复习日志 + 记操作日志。
 * 返回更新后的卡片（含来源标题），供乐观更新直接覆盖查询缓存。
 */
export async function updateCardProgressOffline(
  cardId: string,
  quality: number,
): Promise<StudyCard> {
  const card = await getById<StudyCard>("study_cards", cardId);
  if (!card) {
    throw new Error(`Offline card not found: ${cardId}`);
  }

  const settings = await getMeta<FsrsUserSettings | null>("ownerSettings");
  const f = buildFSRSInstance(settings);
  const fsrsCard = dbCardToFSRS(card);
  const now = new Date();
  const rating = mapQualityToRating(quality);

  const schedulingCards = f.repeat(fsrsCard, now) as unknown as Record<
    Rating,
    { card: Card }
  >;
  const scheduledCard = schedulingCards[rating].card;

  const nextStability = Math.max(0, Number(scheduledCard.stability) || 0);
  const nextRetrievability =
    nextStability > 0 ? stabilityToMasteryBaseline(nextStability) : 0;

  const updatedCard: StudyCard = {
    ...card,
    last_reviewed: now.toISOString(),
    next_review: scheduledCard.due.toISOString(),
    review_count: scheduledCard.reps,
    fsrs_state: State[scheduledCard.state] as keyof typeof State,
    fsrs_stability: scheduledCard.stability,
    fsrs_difficulty: scheduledCard.difficulty,
    fsrs_elapsed_days: scheduledCard.elapsed_days,
    fsrs_scheduled_days: scheduledCard.scheduled_days,
    fsrs_retrievability: nextRetrievability,
    fsrs_last_review: now.toISOString(),
  };

  await putRecord("study_cards", updatedCard as unknown as Record<string, unknown>);

  const logId = `rl_${now.getTime()}_${cardId.slice(0, 8)}`;
  await putRecord("review_logs", {
    id: logId,
    card_id: cardId,
    quality,
    rating: State[scheduledCard.state],
    reviewed_at: now.toISOString(),
    next_review: scheduledCard.due.toISOString(),
  });

  await putRecord("op_log", {
    id: `op_${now.getTime()}_${cardId.slice(0, 8)}`,
    table: "study_cards",
    record_id: cardId,
    action: "update",
    data: {
      last_reviewed: updatedCard.last_reviewed,
      next_review: updatedCard.next_review,
      review_count: updatedCard.review_count,
      fsrs_state: updatedCard.fsrs_state,
      fsrs_stability: updatedCard.fsrs_stability,
      fsrs_difficulty: updatedCard.fsrs_difficulty,
      fsrs_elapsed_days: updatedCard.fsrs_elapsed_days,
      fsrs_scheduled_days: updatedCard.fsrs_scheduled_days,
      fsrs_retrievability: updatedCard.fsrs_retrievability,
      fsrs_last_review: updatedCard.fsrs_last_review,
      last_rating: rating,
    },
    timestamp: now.toISOString(),
    synced: false,
  });

  logger.debug("Offline card progress updated", {
    cardId,
    quality,
    nextReview: updatedCard.next_review,
  });

  return updatedCard;
}

export async function getEnrichmentData() {
  const [graphs, knowledgePoints] = await Promise.all([
    getAll<OfflineGraphRow>("graphs"),
    getAll<OfflineKnowledgePointRow>("knowledge_points"),
  ]);
  return { graphs, knowledgePoints };
}

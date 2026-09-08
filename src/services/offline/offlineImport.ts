import type { OfflineBundle } from "@shared/types";
import { createLogger } from "@/utils/logger";
import {
  bulkPut,
  clearStore,
  getAll,
  getBundleVersion,
  setBundleVersion,
  setLocalIdentity,
  setMeta,
  CONTENT_STORES,
} from "./offlineDb";
import type { StudyCard } from "@shared/types/common";

const logger = createLogger("OfflineImport");

const BUNDLE_URL = "offline/bundle.json";

/** 拉取内置离线数据包；不存在或解析失败返回 null（视为非离线版） */
export async function fetchOfflineBundle(): Promise<OfflineBundle | null> {
  try {
    const response = await fetch(BUNDLE_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const bundle = (await response.json()) as OfflineBundle;
    if (
      !bundle ||
      typeof bundle !== "object" ||
      !Array.isArray(bundle.studyCards)
    ) {
      logger.warn("Offline bundle malformed, ignoring");
      return null;
    }
    return bundle;
  } catch {
    return null;
  }
}

/**
 * 卡片合并规则：本地卡与数据包卡取 last_reviewed 较新者。
 * - 离线复习会更新 last_reviewed 为当前时间，通常晚于数据包 → 保留本地进度；
 * - 从未复习的卡 last_reviewed 为空 → 数据包新版本胜出。
 */
function mergeCard(
  localCard: StudyCard | undefined,
  bundleCard: StudyCard,
): StudyCard {
  if (!localCard) return bundleCard;
  const localReviewed = localCard.last_reviewed;
  const bundleReviewed = bundleCard.last_reviewed;
  if (localReviewed && (!bundleReviewed || localReviewed > bundleReviewed)) {
    return localCard;
  }
  return bundleCard;
}

/** 将数据包导入内容表：内容表整体覆盖（卡片按 last_reviewed 合并保留本地进度） */
export async function importOfflineBundle(bundle: OfflineBundle): Promise<void> {
  await clearStore("graphs");
  await bulkPut("graphs", bundle.graphs as unknown as Array<Record<string, unknown>>);

  await clearStore("knowledge_points");
  await bulkPut(
    "knowledge_points",
    bundle.knowledgePoints as unknown as Array<Record<string, unknown>>,
  );

  await clearStore("graph_nodes");
  await bulkPut(
    "graph_nodes",
    (bundle.graphNodes ?? []) as unknown as Array<Record<string, unknown>>,
  );

  await clearStore("edges");
  await bulkPut(
    "edges",
    (bundle.edges ?? []) as unknown as Array<Record<string, unknown>>,
  );

  const localCards = await getAll<StudyCard>("study_cards");
  const localById = new Map(localCards.map((card) => [card.id, card]));
  const mergedCards = bundle.studyCards.map((card) =>
    mergeCard(localById.get(card.id), card),
  );
  await clearStore("study_cards");
  await bulkPut(
    "study_cards",
    mergedCards as unknown as Array<Record<string, unknown>>,
  );

  await clearStore("quiz_sets");
  await bulkPut("quiz_sets", bundle.quizSets as unknown as Array<Record<string, unknown>>);

  await clearStore("quiz_set_cards");
  await bulkPut(
    "quiz_set_cards",
    bundle.quizSetCards as unknown as Array<Record<string, unknown>>,
  );

  await setBundleVersion(bundle.version);
  await setLocalIdentity({
    ownerId: bundle.owner.id,
    email: bundle.owner.email,
    name: bundle.owner.name ?? null,
  });
  await setMeta("ownerSettings", bundle.owner.settings ?? null);

  logger.warn("Offline bundle imported", {
    version: bundle.version,
    cards: mergedCards.length,
    exportedAt: bundle.exportedAt,
  });
}

/**
 * 确保离线内容就绪：首次启动或数据包版本升级时导入内置数据包。
 * 本地记录表（复习日志/答题会话/操作日志）永不随导入清除。
 */
export async function ensureOfflineContent(): Promise<OfflineBundle | null> {
  const bundle = await fetchOfflineBundle();
  if (!bundle) return null;

  const storedVersion = await getBundleVersion();
  if (storedVersion === bundle.version) {
    return bundle;
  }

  await importOfflineBundle(bundle);
  return bundle;
}

export { CONTENT_STORES };

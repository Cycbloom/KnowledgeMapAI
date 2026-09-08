import type {
  GetCardsParams,
  PaginatedStudyCards,
  StudyStats,
  StudySemanticGroupsResponse,
  DashboardStats,
  TodaySummary,
  StatisticsResponse,
  DailyReport,
  WeeklyReport,
  MasteryHealthResponse,
} from "@shared/types/api";
import type { StudyCard } from "@shared/types/common";
import type { QuizSet, QuizSetWithCards, QuizSetCard } from "@shared/types/quiz";
import type { Node, NodeStatus } from "@shared/types/graph-node";
import type { Edge } from "@shared/types/graph-edge";
import type { KnowledgePoint } from "@shared/types/graph-knowledge-point";
import type { OfflineKnowledgePointRow } from "@shared/types/offline";
import type { Graph } from "@shared/types/graph-entity";
import {
  buildNodeFromGraphNode,
  type GraphNodeRaw,
} from "@shared/utils/nodeHelpers";
import {
  computeCardDisplayMastery,
  aggregateDisplayMastery,
} from "@shared/utils/fsrs/masteryContract";
import { resolveLocalizedText } from "@shared/utils/localization";
import i18n from "@/i18n";
import { createLogger } from "@/utils/logger";
import {
  getAll,
  getById,
  putRecord,
} from "./offlineDb";
import {
  updateCardProgressOffline,
  getEnrichmentData,
} from "./offlineFsrs";

const logger = createLogger("OfflineApi");

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

async function loadAllCards(): Promise<StudyCard[]> {
  return getAll<StudyCard>("study_cards");
}

async function enrichCards(cards: StudyCard[]): Promise<StudyCard[]> {
  if (cards.length === 0) return [];
  const { graphs, knowledgePoints } = await getEnrichmentData();
  return cards.map((card) => {
    const kp = knowledgePoints.find((p) => p.id === card.knowledge_point_id);
    const graph = graphs.find((g) => g.id === card.graph_id);
    return {
      ...card,
      knowledgePointTitle: kp?.title
        ? resolveLocalizedText(
            kp.title as string | Record<string, string> | null | undefined,
          )
        : null,
      graphTitle: graph?.title
        ? resolveLocalizedText(
            graph.title as string | Record<string, string> | null | undefined,
          )
        : null,
    };
  });
}

function applyCardFilters(
  cards: StudyCard[],
  params?: GetCardsParams,
): StudyCard[] {
  if (!params) return cards;
  const now = new Date();

  let result = cards;
  if (params.graph_id) result = result.filter((c) => c.graph_id === params.graph_id);
  if (params.knowledge_point_id) {
    result = result.filter((c) => c.knowledge_point_id === params.knowledge_point_id);
  }
  if (params.knowledge_point_ids?.length) {
    const ids = new Set(params.knowledge_point_ids);
    result = result.filter((c) => c.knowledge_point_id && ids.has(c.knowledge_point_id));
  }
  if (params.source_graph_id) {
    result = result.filter((c) => c.source_graph_id === params.source_graph_id);
  }
  if (params.due) {
    result = result.filter((c) => new Date(c.next_review) <= now);
  }
  if (params.card_type) {
    result = result.filter((c) => c.card_type === params.card_type);
  }
  if (params.fsrs_state) {
    const states = new Set(
      params.fsrs_state
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (states.size > 0) {
      result = result.filter((c) => states.has(c.fsrs_state ?? ""));
    }
  }
  if (params.review_count_min !== undefined) {
    result = result.filter((c) => (c.review_count ?? 0) >= (params.review_count_min ?? 0));
  }
  if (params.review_count_max !== undefined) {
    result = result.filter((c) => (c.review_count ?? 0) <= (params.review_count_max ?? 0));
  }
  if (params.next_review_start) {
    result = result.filter((c) => c.next_review >= (params.next_review_start ?? ""));
  }
  if (params.next_review_end) {
    result = result.filter((c) => c.next_review <= (params.next_review_end ?? ""));
  }
  if (params.search && params.search.trim() !== "") {
    const term = params.search.trim().toLowerCase();
    result = result.filter((c) => {
      return (
        c.question.toLowerCase().includes(term) ||
        c.answer.toLowerCase().includes(term)
      );
    });
  }
  return result;
}

// ───────────────────────── study ─────────────────────────

const offlineStudyApi = {
  getCards: async (params?: GetCardsParams): Promise<StudyCard[]> => {
    const cards = await loadAllCards();
    const filtered = applyCardFilters(cards, params);
    return enrichCards(filtered);
  },

  getCardsPaged: async (params?: GetCardsParams): Promise<PaginatedStudyCards> => {
    const cards = await loadAllCards();
    const filtered = applyCardFilters(cards, params);
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 20);
    const sorted = [...filtered].sort((a, b) => {
      const da = a.created_at ?? "";
      const db = b.created_at ?? "";
      if (da !== db) return da > db ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
    const from = (page - 1) * pageSize;
    const items = await enrichCards(sorted.slice(from, from + pageSize));
    return { items, total: sorted.length, page, pageSize };
  },

  getCardsByKnowledgePoint: async (
    knowledgePointId: string,
    params?: { source_graph_id?: string; due?: boolean },
  ): Promise<StudyCard[]> => {
    return offlineStudyApi.getCards({
      knowledge_point_id: knowledgePointId,
      source_graph_id: params?.source_graph_id,
      due: params?.due,
    });
  },

  updateProgress: async (id: string, quality: number): Promise<StudyCard> => {
    const updated = await updateCardProgressOffline(id, quality);
    const enriched = await enrichCards([updated]);
    return enriched[0] ?? updated;
  },

  recordQuizAttempt: async (
    quizSetId: string,
    results: Array<{
      card_id: string;
      correct: boolean;
      user_answer?: string;
      time_spent?: number;
    }>,
  ): Promise<{
    success: boolean;
    data: { sessionId: string; score: number; correctCount: number; totalCount: number };
  }> => {
    const totalCount = results.length;
    const correctCount = results.filter((r) => r.correct).length;
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const sessionId = `offquiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await putRecord("quiz_sessions", {
      id: sessionId,
      quiz_set_id: quizSetId,
      correct_count: correctCount,
      total_count: totalCount,
      score,
      created_at: now,
      results,
    });

    await putRecord("op_log", {
      id: `op_quiz_${Date.now()}`,
      table: "quiz_sessions",
      record_id: sessionId,
      action: "create",
      data: {
        quiz_set_id: quizSetId,
        correct_count: correctCount,
        total_count: totalCount,
        score,
        results,
      },
      timestamp: now,
      synced: false,
    });

    logger.debug("Offline quiz attempt recorded", { quizSetId, correctCount, totalCount });
    return { success: true, data: { sessionId, score, correctCount, totalCount } };
  },

  getStats: async (graphId?: string): Promise<StudyStats> => {
    const cards = await loadAllCards();
    const scoped = graphId ? cards.filter((c) => c.graph_id === graphId) : cards;
    const now = new Date();
    let dueCards = 0;
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let relearningCards = 0;
    let totalDisplayMastery = 0;
    let totalStability = 0;
    let totalDifficulty = 0;
    const nowMs = now.getTime();

    for (const card of scoped) {
      if (card.next_review && new Date(card.next_review) <= now) dueCards++;
      switch (card.fsrs_state) {
        case "New": newCards++; break;
        case "Learning": learningCards++; break;
        case "Review": reviewCards++; break;
        case "Relearning": relearningCards++; break;
      }
      totalDisplayMastery += computeCardDisplayMastery(card, nowMs);
      totalStability += card.fsrs_stability ?? 0;
      totalDifficulty += card.fsrs_difficulty ?? 0;
    }

    const count = scoped.length;
    const avgDisplayMastery = count > 0 ? Math.round((totalDisplayMastery / count) * 1000) / 1000 : 0;
    return {
      totalCards: count,
      dueCards,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      averageRetrievability: avgDisplayMastery,
      averageDisplayMastery: avgDisplayMastery,
      averageStability: count > 0 ? Math.round((totalStability / count) * 100) / 100 : 0,
      averageDifficulty: count > 0 ? Math.round((totalDifficulty / count) * 100) / 100 : 0,
    };
  },

  getSemanticGroups: async (): Promise<StudySemanticGroupsResponse> => {
    return { groups: [], interference_pairs: [] };
  },
};

// ───────────────────────── quiz ─────────────────────────

const offlineQuizApi = {
  list: async (): Promise<QuizSet[]> => {
    return getAll<QuizSet>("quiz_sets");
  },

  get: async (id: string): Promise<QuizSetWithCards> => {
    const quizSet = await getById<QuizSet>("quiz_sets", id);
    if (!quizSet) {
      throw new Error(`Offline quiz set not found: ${id}`);
    }
    const links = (await getAll<QuizSetCard>("quiz_set_cards"))
      .filter((l) => l.quiz_set_id === id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const cardIds = links.map((l) => l.card_id);
    const cards = (await loadAllCards()).filter((c) => cardIds.includes(c.id));
    const enriched = await enrichCards(cards);
    return { ...quizSet, cards: enriched };
  },
};

// ───────────────────────── dashboard ─────────────────────────

const offlineDashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const cards = await loadAllCards();
    const logs = await getAll<{ reviewed_at: string }>("review_logs");

    const heatmap = new Map<string, number>();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const log of logs) {
      const d = new Date(log.reviewed_at);
      if (d < thirtyDaysAgo) continue;
      const key = dateKey(d);
      heatmap.set(key, (heatmap.get(key) ?? 0) + 1);
    }
    const heatmapItems = Array.from(heatmap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, count]) => ({ date, count }));

    const distributionMap: Array<{ name: string; value: number; color: string }> = [
      { name: "new", value: 0, color: "#6366f1" },
      { name: "learning", value: 0, color: "#f59e0b" },
      { name: "review", value: 0, color: "#10b981" },
      { name: "relearning", value: 0, color: "#ef4444" },
    ];
    for (const card of cards) {
      const item = distributionMap.find((d) => d.name === (card.fsrs_state ?? "New").toLowerCase());
      if (item) item.value++;
    }

    return { heatmap: heatmapItems, blindSpots: [], distribution: distributionMap };
  },

  getTodaySummary: async (): Promise<TodaySummary> => {
    const cards = await loadAllCards();
    const endOfToday = new Date(startOfToday().getTime() + 24 * 60 * 60 * 1000 - 1);
    const dueCards = cards.filter(
      (c) => c.next_review && new Date(c.next_review) <= endOfToday,
    ).length;
    return { inboxCount: 0, dueCards, dueTasks: 0 };
  },
};

// ───────────────────────── statistics ─────────────────────────

const offlineStatisticsApi = {
  getStats: async (): Promise<StatisticsResponse> => {
    const cards = await loadAllCards();
    const logs = await getAll<{ reviewed_at: string }>("review_logs");
    const now = new Date();

    const dueToday = cards.filter(
      (c) => c.next_review && new Date(c.next_review) <= now,
    ).length;
    const learning = cards.filter((c) => {
      const s = c.fsrs_state ?? "New";
      return s === "Learning" || s === "Relearning";
    }).length;
    let totalStability = 0;
    for (const card of cards) totalStability += card.fsrs_stability ?? 0;
    const avgStability = cards.length > 0 ? Math.round((totalStability / cards.length) * 100) / 100 : 0;

    const heatmapMap = new Map<string, number>();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    for (const log of logs) {
      const d = new Date(log.reviewed_at);
      if (d < ninetyDaysAgo) continue;
      const key = dateKey(d);
      heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1);
    }
    const heatmap = Array.from(heatmapMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, count]) => ({ date, count }));

    const distributionMap: Array<{ name: string; value: number; color: string }> = [
      { name: "new", value: 0, color: "#6366f1" },
      { name: "learning", value: 0, color: "#f59e0b" },
      { name: "review", value: 0, color: "#10b981" },
      { name: "relearning", value: 0, color: "#ef4444" },
    ];
    for (const card of cards) {
      const item = distributionMap.find((d) => d.name === (card.fsrs_state ?? "New").toLowerCase());
      if (item) item.value++;
    }

    const forecast: Array<{ date: string; count: number }> = [];
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(tomorrowStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      const count = cards.filter(
        (c) => c.next_review && new Date(c.next_review) >= dayStart && new Date(c.next_review) <= dayEnd,
      ).length;
      forecast.push({ date: dateKey(dayStart), count });
    }

    const growthMap = new Map<string, number>();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const card of cards) {
      if (!card.created_at) continue;
      const d = new Date(card.created_at);
      if (d < thirtyDaysAgo) continue;
      const key = dateKey(d);
      growthMap.set(key, (growthMap.get(key) ?? 0) + 1);
    }
    const growth = Array.from(growthMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, count]) => ({ date, count }));

    return {
      metrics: { totalCards: cards.length, dueToday, learning, avgStability },
      heatmap,
      distribution: distributionMap,
      forecast,
      growth,
    };
  },

  getMasteryHealth: async (): Promise<MasteryHealthResponse> => {
    const cards = await loadAllCards();
    const nowMs = Date.now();

    const kpMap = new Map<
      string,
      { title: string; sum: number; count: number; maxMastery: number }
    >();
    for (const card of cards) {
      const kpId = card.knowledge_point_id;
      if (!kpId) continue;
      const mastery = computeCardDisplayMastery(card, nowMs);
      const entry = kpMap.get(kpId) ?? {
        title: card.knowledgePointTitle ?? kpId,
        sum: 0,
        count: 0,
        maxMastery: 0,
      };
      entry.sum += mastery;
      entry.count += 1;
      entry.maxMastery = Math.max(entry.maxMastery, mastery);
      kpMap.set(kpId, entry);
    }

    const totalPoints = kpMap.size;
    let masteredCount = 0;
    let learningCount = 0;
    let weakCount = 0;
    const masteryBuckets: Array<{ range: string; count: number }> = [
      { range: "0-25", count: 0 },
      { range: "25-45", count: 0 },
      { range: "45-65", count: 0 },
      { range: "65-82", count: 0 },
      { range: "82-100", count: 0 },
    ];
    const weakPoints: Array<{ id: string; title: string; mastery: number }> = [];
    const kpMasteryList: number[] = [];

    for (const [id, entry] of kpMap.entries()) {
      const mastery = entry.count > 0 ? entry.sum / entry.count : entry.maxMastery;
      kpMasteryList.push(mastery);
      if (mastery >= 0.82) masteredCount++;
      else if (mastery >= 0.45) learningCount++;
      else weakCount++;

      const pct = Math.round(mastery * 100);
      if (pct < 25) masteryBuckets[0].count++;
      else if (pct < 45) masteryBuckets[1].count++;
      else if (pct < 65) masteryBuckets[2].count++;
      else if (pct < 82) masteryBuckets[3].count++;
      else masteryBuckets[4].count++;

      if (mastery < 0.45) {
        weakPoints.push({ id, title: entry.title, mastery });
      }
    }
    weakPoints.sort((a, b) => a.mastery - b.mastery);
    const avgMastery =
      kpMasteryList.length > 0
        ? Math.round(
            (kpMasteryList.reduce((sum, m) => sum + m, 0) / kpMasteryList.length) *
              1000,
          ) / 1000
        : 0;

    let totalStability = 0;
    for (const card of cards) totalStability += card.fsrs_stability ?? 0;
    const avgStability = cards.length > 0 ? Math.round((totalStability / cards.length) * 100) / 100 : 0;
    let totalRetrievability = 0;
    for (const card of cards) {
      totalRetrievability += computeCardDisplayMastery(card, nowMs);
    }
    const avgRetrievability = cards.length > 0 ? Math.round((totalRetrievability / cards.length) * 1000) / 1000 : 0;

    const stabilityBuckets: Array<{ range: string; count: number }> = [
      { range: "0-1m", count: 0 },
      { range: "1-3m", count: 0 },
      { range: "3m+", count: 0 },
    ];
    const retrievabilityBuckets: Array<{ range: string; count: number }> = [
      { range: "0-25", count: 0 },
      { range: "25-50", count: 0 },
      { range: "50-75", count: 0 },
      { range: "75-100", count: 0 },
    ];
    for (const card of cards) {
      const s = card.fsrs_stability ?? 0;
      if (s < 30) stabilityBuckets[0].count++;
      else if (s < 90) stabilityBuckets[1].count++;
      else stabilityBuckets[2].count++;

      const mastery = Math.round(computeCardDisplayMastery(card, nowMs) * 100);
      if (mastery < 25) retrievabilityBuckets[0].count++;
      else if (mastery < 50) retrievabilityBuckets[1].count++;
      else if (mastery < 75) retrievabilityBuckets[2].count++;
      else retrievabilityBuckets[3].count++;
    }

    return {
      totalPoints,
      avgMastery,
      masteredCount,
      learningCount,
      weakCount,
      masteryBuckets,
      weakPoints: weakPoints.slice(0, 5),
      totalCards: cards.length,
      avgStability,
      avgRetrievability,
      stabilityBuckets,
      retrievabilityBuckets,
    };
  },

  getDailyReport: async (date?: string): Promise<DailyReport> => {
    const target = date ?? dateKey(new Date());
    const logs = await getAll<{ reviewed_at: string }>("review_logs");
    const cardsReviewed = logs.filter((l) => dateKey(new Date(l.reviewed_at)) === target).length;
    return {
      date: target,
      tasksCompleted: 0,
      tasksPlanned: 0,
      focusMinutes: 0,
      focusSessions: 0,
      cardsReviewed,
      pendingReviews: 0,
      overdueTasks: 0,
      newKnowledgePoints: 0,
      newNotes: 0,
    };
  },

  getWeeklyReport: async (weekStart?: string): Promise<WeeklyReport> => {
    const start = weekStart ? new Date(weekStart) : startOfToday();
    const logs = await getAll<{ reviewed_at: string }>("review_logs");
    const dailyBreakdown: DailyReport[] = [];
    let activeDays = 0;
    let cardsReviewed = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = dateKey(day);
      const count = logs.filter((l) => dateKey(new Date(l.reviewed_at)) === key).length;
      if (count > 0) activeDays++;
      cardsReviewed += count;
      dailyBreakdown.push({
        date: key,
        tasksCompleted: 0,
        tasksPlanned: 0,
        focusMinutes: 0,
        focusSessions: 0,
        cardsReviewed: count,
        pendingReviews: 0,
        overdueTasks: 0,
        newKnowledgePoints: 0,
        newNotes: 0,
      });
    }
    const weekEnd = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return {
      weekStart: dateKey(start),
      weekEnd: dateKey(weekEnd),
      activeDays,
      tasksCompleted: 0,
      focusMinutes: 0,
      cardsReviewed,
      newKnowledgePoints: 0,
      newNotes: 0,
      currentPendingReviews: 0,
      currentOverdueTasks: 0,
      dailyBreakdown,
    };
  },
};

// ───────────────────────── health / focus / graphs ─────────────────────────

const offlineHealthApi = {
  getOverview: async () => ({ streakDays: 0, weeklyStudyTime: 0 }),
  getHeatmap: async () => [],
  getWeakPoints: async () => ({ weakPoints: [] }),
  getWeeklyActivity: async () => [],
  getPredictions: async () => ({ predictions: [] }),
};

// 离线模式无 AI 服务：主观题判分立即返回「未判分」，避免网络重试阻塞答题提交
const offlineAiApi = {
  gradeAnswer: async () => ({
    success: true,
    data: {
      score: 0,
      feedback: i18n.t("study.quizPractice.exam.aiGradeFailed"),
      correct: false,
    },
  }),
};

const offlineFocusApi = {
  saveSession: async () => ({ success: true }),
  getStats: async () => ({ data: { total_focus_seconds: 0, total_sessions: 0 } }),
  getTodayStats: async () => ({ data: { total_duration: 0, session_count: 0 } }),
};

// ───────────────────────── nodes / graphs ─────────────────────────

function buildOfflineNode(
  gnRow: Record<string, unknown>,
  kpRow: OfflineKnowledgePointRow | undefined,
): Node | null {
  if (!kpRow) return null;
  const raw: GraphNodeRaw = {
    id: gnRow.id as string,
    graph_id: gnRow.graph_id as string,
    knowledge_point_id: gnRow.knowledge_point_id as string,
    x_position: Number(gnRow.x_position) || 0,
    y_position: Number(gnRow.y_position) || 0,
    level: gnRow.level as GraphNodeRaw["level"],
    is_accepted: !!gnRow.is_accepted,
    created_at: (gnRow.created_at as string) ?? new Date().toISOString(),
    updated_at: (gnRow.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (gnRow.deleted_at as string | undefined) ?? undefined,
    knowledge_points: kpRow as unknown as KnowledgePoint,
  };
  return buildNodeFromGraphNode(raw);
}

/** 基于本地 study_cards 计算图谱节点学习状态（镜像服务端 getGraphNodeStatus） */
async function computeOfflineNodeStatus(
  graphId: string,
): Promise<Record<string, NodeStatus>> {
  const cards = (await loadAllCards()).filter((c) => c.graph_id === graphId);
  const now = new Date();
  const nowMs = now.getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const groups = new Map<string, StudyCard[]>();
  for (const card of cards) {
    const kpId = card.knowledge_point_id;
    if (!kpId) continue;
    const arr = groups.get(kpId) ?? [];
    arr.push(card);
    groups.set(kpId, arr);
  }

  const statusMap: Record<string, NodeStatus> = {};
  for (const [kpId, group] of groups) {
    const first = group[0];
    const nextReview = first.next_review ? new Date(first.next_review) : null;
    const isDue = !!nextReview && nextReview <= now;
    const isDueToday =
      !!nextReview && nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const masteryCards = group.map((c) => ({
      fsrs_stability: c.fsrs_stability,
      fsrs_last_review: c.fsrs_last_review,
      last_reviewed: c.last_reviewed,
      fsrs_retrievability: c.fsrs_retrievability,
      displayMastery: computeCardDisplayMastery(c, nowMs),
    }));
    const displayMastery = aggregateDisplayMastery(masteryCards, "stabilityWeighted");
    const avgStability =
      group.reduce((sum, c) => sum + (c.fsrs_stability ?? 0), 0) / group.length;
    const reviewCountSum = group.reduce((sum, c) => sum + (c.review_count ?? 0), 0);

    statusMap[kpId] = {
      mastered: avgStability > 21,
      locked: false,
      review_count: reviewCountSum,
      next_review: first.next_review ?? undefined,
      due: isDue,
      due_today: isDueToday,
      fsrs_stability: avgStability,
      fsrs_retrievability: displayMastery,
      display_mastery: displayMastery,
    };
  }
  return statusMap;
}

const offlineNodesApi = {
  get: async (id: string): Promise<Node> => {
    const graphNodes = await getAll<Record<string, unknown>>("graph_nodes");
    const gn = graphNodes.find(
      (n) => n.knowledge_point_id === id && !n.deleted_at,
    );
    if (!gn) throw new Error(`Offline node not found: ${id}`);
    const kp = await getById<OfflineKnowledgePointRow>("knowledge_points", id);
    const node = buildOfflineNode(gn, kp ?? undefined);
    if (!node) throw new Error(`Offline node not found: ${id}`);
    return node;
  },
};

function mapGraphRowToGraph(row: Record<string, unknown>): Graph {
  return {
    id: row.id as string,
    title: resolveLocalizedText(row.title as string | Record<string, string> | null | undefined),
    description: row.description
      ? resolveLocalizedText(row.description as string | Record<string, string> | null | undefined)
      : undefined,
    domain: (row.domain as string | null) ?? undefined,
    user_id: row.user_id as string,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string | undefined) ?? undefined,
    nodes_count: 0,
  };
}

const offlineGraphsApi = {
  list: async (): Promise<Graph[]> => {
    const rows = await getAll<Record<string, unknown>>("graphs");
    return rows.map(mapGraphRowToGraph);
  },

  get: async (id: string): Promise<Graph> => {
    const row = await getById<Record<string, unknown>>("graphs", id);
    if (!row) throw new Error(`Offline graph not found: ${id}`);
    return mapGraphRowToGraph(row);
  },

  getNodes: async (
    id: string,
    _includeEmbedding?: boolean,
    includeStatus?: boolean,
  ): Promise<{ nodes: Node[]; edges: Edge[]; nodeStatus?: Record<string, NodeStatus> }> => {
    const graphNodes = (await getAll<Record<string, unknown>>("graph_nodes")).filter(
      (n) => n.graph_id === id && !n.deleted_at,
    );
    const kps = await getAll<OfflineKnowledgePointRow>("knowledge_points");
    const nodes: Node[] = [];
    for (const gn of graphNodes) {
      const node = buildOfflineNode(
        gn,
        kps.find((k) => k.id === gn.knowledge_point_id),
      );
      if (node) nodes.push(node);
    }
    const edges = (await getAll<Record<string, unknown>>("edges"))
      .filter((e) => e.graph_id === id && !e.deleted_at) as unknown as Edge[];

    if (includeStatus) {
      const nodeStatus = await computeOfflineNodeStatus(id);
      return { nodes, edges, nodeStatus };
    }
    return { nodes, edges };
  },
};

export const offlineApi = {
  study: offlineStudyApi,
  quiz: offlineQuizApi,
  dashboard: offlineDashboardApi,
  statistics: offlineStatisticsApi,
  health: offlineHealthApi,
  ai: offlineAiApi,
  focus: offlineFocusApi,
  nodes: offlineNodesApi,
  graphs: offlineGraphsApi,
};

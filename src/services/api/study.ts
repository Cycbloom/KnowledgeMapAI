import { request } from "./client";
import type {
  GetCardsParams,
  PaginatedStudyCards,
  CardGroup,
  StudyStats,
  FsrsParameters,
  FsrsOptimizeResult,
  FsrsResetResult,
  StudySemanticGroupsResponse,
  DashboardStats,
  TodaySummary,
  StatisticsResponse,
} from "@shared/types/api";
import type { StudyCard } from "@shared/types/common";
import type { IStudyApi, IDashboardApi, IStatisticsApi } from "./contracts";

const buildCardsSearch = (params?: GetCardsParams): string => {
  const search = new URLSearchParams();
  if (params?.graph_id) search.set("graph_id", params.graph_id);
  if (params?.knowledge_point_id)
    {search.set("knowledge_point_id", params.knowledge_point_id);}
  if (params?.knowledge_point_ids)
    {search.set("knowledge_point_ids", params.knowledge_point_ids.join(","));}
  if (params?.source_graph_id)
    {search.set("source_graph_id", params.source_graph_id);}
  if (params?.due) search.set("due", "true");
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.pageSize !== undefined) search.set("page_size", String(params.pageSize));
  if (params?.search) search.set("search", params.search);
  if (params?.card_type) search.set("card_type", params.card_type);
  if (params?.fsrs_state) search.set("fsrs_state", params.fsrs_state);
  if (params?.review_count_min !== undefined) {
    search.set("review_count_min", String(params.review_count_min));
  }
  if (params?.review_count_max !== undefined) {
    search.set("review_count_max", String(params.review_count_max));
  }
  if (params?.next_review_start) search.set("next_review_start", params.next_review_start);
  if (params?.next_review_end) search.set("next_review_end", params.next_review_end);
  return search.toString();
};

export const studyApi: IStudyApi = {
  getCards: (params?: GetCardsParams) => {
    const query = buildCardsSearch(params);
    return request<StudyCard[]>(`/study/cards${query ? `?${query}` : ""}`);
  },

  getCardsPaged: (params?: GetCardsParams) => {
    const query = buildCardsSearch(params);
    return request<PaginatedStudyCards>(
      `/study/cards${query ? `?${query}` : ""}`,
    );
  },

  getCardsByKnowledgePoint: (
    knowledgePointId: string,
    params?: {
      source_graph_id?: string;
      due?: boolean;
    },
  ) => {
    const search = new URLSearchParams();
    search.set("knowledge_point_id", knowledgePointId);
    if (params?.source_graph_id)
      {search.set("source_graph_id", params.source_graph_id);}
    if (params?.due) search.set("due", "true");
    return request<StudyCard[]>(`/study/cards?${search.toString()}`);
  },

  createCardsBatch: (cards: unknown[]) =>
    request<StudyCard[]>("/study/cards/batch", {
      method: "POST",
      body: JSON.stringify({ cards }),
    }),

  update: (id: string, data: Partial<StudyCard>) =>
    request<StudyCard>(`/study/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/study/cards/${id}`, { method: "DELETE" }),

  deleteBatch: (ids: string[]) =>
    request<{ success: boolean }>("/study/cards/batch", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),

  updateProgress: (id: string, quality: number) =>
    request<StudyCard>(`/study/cards/${id}/progress`, {
      method: "PUT",
      body: JSON.stringify({ quality }),
    }),

  getCardGroups: (knowledgePointId: string) =>
    request<CardGroup[]>(`/study/cards/groups/${knowledgePointId}`),

  getStats: (graphId?: string) => {
    const params = new URLSearchParams();
    if (graphId) params.set("graph_id", graphId);
    const query = params.toString();
    return request<StudyStats>(`/study/stats${query ? `?${query}` : ""}`);
  },

  getFsrsParameters: () => request<FsrsParameters>("/study/fsrs-parameters"),

  setFsrsParameters: (w: number[]) =>
    request<FsrsParameters>("/study/fsrs-parameters", {
      method: "PUT",
      body: JSON.stringify({ w }),
    }),

  resetFsrsParameters: () =>
    request<FsrsResetResult>("/study/fsrs-parameters", {
      method: "DELETE",
    }),

  optimizeFsrsParameters: () =>
    request<FsrsOptimizeResult>("/study/fsrs-parameters/optimize", {
      method: "POST",
    }),

  getSemanticGroups: (graphId?: string) => {
    const params = new URLSearchParams();
    if (graphId) params.set("graph_id", graphId);
    const query = params.toString();
    return request<StudySemanticGroupsResponse>(
      `/study/semantic-groups${query ? `?${query}` : ""}`,
    );
  },
};

export const dashboardApi: IDashboardApi = {
  getStats: () => request<DashboardStats>("/dashboard/stats"),
  getTodaySummary: () => request<TodaySummary>("/dashboard/today"),
};

export const statisticsApi: IStatisticsApi = {
  getStats: () => request<StatisticsResponse>("/statistics"),
};

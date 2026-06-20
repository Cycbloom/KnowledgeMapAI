import type { GetCardsParams, CardGroup, StudyStats } from "@shared/types/api";
import type { StudyCard } from "@shared/types/common";

export interface IStudyApi {
  getCards(params?: GetCardsParams): Promise<StudyCard[]>;

  getCardsByKnowledgePoint(
    knowledgePointId: string,
    params?: {
      source_graph_id?: string;
      due?: boolean;
    },
  ): Promise<StudyCard[]>;

  createCardsBatch(cards: unknown[]): Promise<unknown>;

  update(id: string, data: Partial<StudyCard>): Promise<unknown>;

  delete(id: string): Promise<void | { success: boolean }>;

  deleteBatch(ids: string[]): Promise<void | { success: boolean }>;

  updateProgress(id: string, quality: number): Promise<unknown>;

  getCardGroups(knowledgePointId: string): Promise<CardGroup[]>;

  getStats(graphId?: string): Promise<StudyStats>;

  getFsrsParameters(): Promise<{
    source: "default" | "custom" | "optimized";
    w: number[];
    request_retention: number;
    maximum_interval: number;
    last_optimized_at: string | null;
  }>;

  setFsrsParameters(w: number[]): Promise<unknown>;

  resetFsrsParameters(): Promise<unknown>;

  optimizeFsrsParameters(): Promise<{
    success: boolean;
    improvement: number;
    reviewCount: number;
    message: string;
  }>;
}
import type {
  GetCardsParams,
  CardGroup,
  StudyStats,
  FsrsParameters,
  FsrsOptimizeResult,
  FsrsResetResult,
  StudySemanticGroupsResponse,
} from "@shared/types/api";
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

  createCardsBatch(cards: unknown[]): Promise<StudyCard[]>;

  update(id: string, data: Partial<StudyCard>): Promise<StudyCard>;

  delete(id: string): Promise<void | { success: boolean }>;

  deleteBatch(ids: string[]): Promise<void | { success: boolean }>;

  updateProgress(id: string, quality: number): Promise<StudyCard>;

  getCardGroups(knowledgePointId: string): Promise<CardGroup[]>;

  getStats(graphId?: string): Promise<StudyStats>;

  getFsrsParameters(): Promise<FsrsParameters>;

  setFsrsParameters(w: number[]): Promise<FsrsParameters>;

  resetFsrsParameters(): Promise<FsrsResetResult>;

  optimizeFsrsParameters(): Promise<FsrsOptimizeResult>;

  getSemanticGroups(graphId?: string): Promise<StudySemanticGroupsResponse>;
}
import type {
  GetCardsParams,
  PaginatedStudyCards,
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

  getCardsPaged(params?: GetCardsParams): Promise<PaginatedStudyCards>;

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

  recordQuizAttempt(
    quizSetId: string,
    results: Array<{
      card_id: string;
      correct: boolean;
      user_answer?: string;
      time_spent?: number;
    }>,
  ): Promise<{
    success: boolean;
    data: {
      sessionId: string;
      score: number;
      correctCount: number;
      totalCount: number;
    };
  }>;
}
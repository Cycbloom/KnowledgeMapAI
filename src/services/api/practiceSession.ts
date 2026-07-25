import { request } from "./client";
import type { StudyCard, LearningState } from "@shared/types";

interface PracticeSession {
  id: string;
  subtask_id: string;
  knowledge_point_id: string;
  cards: StudyCard[];
  started_at: string;
  user_id: string;
}

interface PracticeCompletionResult {
  masteryLevel: number;
  newState: LearningState;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  improvement: number;
}

export const practiceSessionApi = {
  start: (data: { subtask_id: string; knowledge_point_id: string }) =>
    request<{ success: boolean; data: PracticeSession }>(
      "/study/practice-sessions",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  complete: (
    subtaskId: string,
    results: Array<{
      card_id: string;
      correct: boolean;
      time_spent: number;
      user_answer?: string;
    }>,
  ) =>
    request<{ success: boolean; data: PracticeCompletionResult }>(
      `/study/practice-sessions/${subtaskId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ results }),
      },
    ),
};

import { request } from "./client";
import type { StudyCard, LearningState } from "@shared/types";

interface QuizSession {
  id: string;
  subtask_id: string;
  knowledge_point_id: string;
  quiz_set_id: string;
  cards: StudyCard[];
  started_at: string;
  user_id: string;
}

interface QuizCompletionResult {
  masteryLevel: number;
  newState: LearningState;
  score: number;
  correctCount: number;
  totalCount: number;
  improvement: number;
}

export const quizSessionApi = {
  start: (data: { subtask_id: string; knowledge_point_id: string }) =>
    request<{ success: boolean; data: QuizSession }>("/study/quiz-sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  complete: (
    subtaskId: string,
    results: Array<{
      card_id: string;
      correct: boolean;
      answer?: string;
      time_spent: number;
    }>,
  ) =>
    request<{ success: boolean; data: QuizCompletionResult }>(
      `/study/quiz-sessions/${subtaskId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ results }),
      },
    ),
};

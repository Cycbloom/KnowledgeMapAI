import { request } from "./client";

export const quizSessionApi = {
  start: (data: { subtask_id: string; knowledge_point_id: string }) =>
    request("/study/quiz-sessions", {
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
    request(`/study/quiz-sessions/${subtaskId}/complete`, {
      method: "POST",
      body: JSON.stringify({ results }),
    }),
};

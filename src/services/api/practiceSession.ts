import { request } from "./client";

export const practiceSessionApi = {
  start: (data: { subtask_id: string; knowledge_point_id: string }) =>
    request("/study/practice-sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  complete: (
    subtaskId: string,
    results: Array<{
      card_id: string;
      correct: boolean;
      time_spent: number;
      user_answer?: string;
    }>,
  ) =>
    request(`/study/practice-sessions/${subtaskId}/complete`, {
      method: "POST",
      body: JSON.stringify({ results }),
    }),
};

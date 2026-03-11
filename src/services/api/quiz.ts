import { request } from './index';
import type {
  QuizSet,
  QuizSetWithCards,
  CreateQuizSetData,
  UpdateQuizSetData,
  GenerateQuizData,
  QuizGenerationProgress,
  RegenerateCardData,
} from '@shared/types/quiz';

export const quizApi = {
  list: () => request<QuizSet[]>('/quiz-sets'),

  get: (id: string) => request<QuizSetWithCards>(`/quiz-sets/${id}`),

  create: (data: CreateQuizSetData) =>
    request<QuizSet>('/quiz-sets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateQuizSetData) =>
    request<QuizSet>(`/quiz-sets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => request<void>(`/quiz-sets/${id}`, { method: 'DELETE' }),

  generate: (data: GenerateQuizData) =>
    request<{ quiz_set_id: string; task_id: string }>('/quiz-sets/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getGenerationProgress: (taskId: string) =>
    request<QuizGenerationProgress>(`/quiz-sets/generation/${taskId}`),

  regenerateCard: (quizSetId: string, cardId: string, data?: RegenerateCardData) =>
    request<{ card_id: string; question: string; answer: string }>(
      `/quiz-sets/${quizSetId}/cards/${cardId}/regenerate`,
      {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }
    ),

  addCard: (quizSetId: string, cardId: string) =>
    request<{ success: boolean; message: string }>(`/quiz-sets/${quizSetId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId }),
    }),

  removeCard: (quizSetId: string, cardId: string) =>
    request<{ success: boolean; message: string }>(
      `/quiz-sets/${quizSetId}/cards/${cardId}`,
      { method: 'DELETE' }
    ),
};

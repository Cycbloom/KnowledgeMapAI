import type {
  QuizSet,
  QuizSetWithCards,
  CreateQuizSetData,
  UpdateQuizSetData,
  GenerateQuizData,
  QuizGenerationProgress,
  RegenerateCardData,
} from '@shared/types/quiz';

export interface IQuizApi {
  list(): Promise<QuizSet[]>;
  get(id: string): Promise<QuizSetWithCards>;
  create(data: CreateQuizSetData): Promise<QuizSet>;
  update(id: string, data: UpdateQuizSetData): Promise<QuizSet>;
  delete(id: string): Promise<void>;
  generate(data: GenerateQuizData): Promise<{ task_id: string }>;
  getGenerationProgress(taskId: string): Promise<QuizGenerationProgress>;
  regenerateCard(
    quizSetId: string,
    cardId: string,
    data?: RegenerateCardData,
  ): Promise<{ card_id: string; question: string; answer: string }>;
  addCard(quizSetId: string, cardId: string): Promise<{ success: boolean; message: string }>;
  removeCard(quizSetId: string, cardId: string): Promise<{ success: boolean; message: string }>;
  addCards(
    quizSetId: string,
    cardIds: string[],
  ): Promise<{ success: boolean; added: number; skipped: number; message: string }>;
}
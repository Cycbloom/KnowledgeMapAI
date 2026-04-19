import type { StudyCard } from './common';

export type QuizSetStatus = 'draft' | 'generating' | 'ready';

export type CardType = 'qa' | 'choice' | 'true_false' | 'multi_choice' | 'fill_in_the_blank' | 'essay';

export interface QuizSetConfig {
  cardTypes: CardType[];
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  knowledgePointIds: string[];
  cardsPerType?: Record<CardType, number>;
  customPrompt?: string;
  aiProvider?: string;
}

export interface QuizSet {
  id: string;
  user_id: string;
  graph_id?: string;
  title: string;
  description?: string;
  config: QuizSetConfig;
  status: QuizSetStatus;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuizSetData {
  title: string;
  description?: string;
  graph_id?: string;
  config: QuizSetConfig;
}

export interface UpdateQuizSetData {
  title?: string;
  description?: string;
  config?: QuizSetConfig;
  status?: QuizSetStatus;
}

export interface QuizSetCard {
  id: string;
  quiz_set_id: string;
  card_id: string;
  display_order: number;
  created_at: string;
}

export interface QuizSetWithCards extends QuizSet {
  cards: StudyCard[];
}

export interface GenerateQuizData {
  title: string;
  description?: string;
  graph_id?: string;
  config: QuizSetConfig;
}

export interface QuizGenerationProgress {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total: number;
  completed: number;
  current?: string;
  error?: string;
}

export interface RegenerateCardData {
  card_type?: CardType;
  custom_prompt?: string;
}

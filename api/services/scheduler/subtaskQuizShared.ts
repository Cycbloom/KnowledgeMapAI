import type { StudyCard } from "../../../shared/types/common";
import type { LearningState } from "../../../shared/types/scheduler";
import type { CardDifficulty } from "./types";

export interface PracticeSession {
  id: string;
  subtask_id: string;
  knowledge_point_id: string;
  cards: StudyCard[];
  started_at: Date;
  user_id: string;
}

export interface PracticeResult {
  card_id: string;
  correct: boolean;
  time_spent: number;
  user_answer?: string;
}

export interface QuizSession {
  id: string;
  subtask_id: string;
  knowledge_point_id: string;
  quiz_set_id: string;
  cards: StudyCard[];
  started_at: Date;
  user_id: string;
}

export interface QuizResult {
  card_id: string;
  correct: boolean;
  answer?: string;
  time_spent: number;
}

export interface PracticeCompletionResult {
  masteryLevel: number;
  newState: LearningState;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  improvement: number;
}

export interface QuizCompletionResult {
  masteryLevel: number;
  newState: LearningState;
  score: number;
  correctCount: number;
  totalCount: number;
  improvement: number;
}

export interface SubtaskData {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  learning_state: LearningState;
  /** @schedule decision - mastery_level READ：用于 FSRS 过渡数学（状态机 getNextState + 增量计算 newMastery） */
  mastery_level: number;
  user_id: string;
}

export interface KnowledgePointData {
  id: string;
  title: string;
  content?: string;
  graph_id?: string;
}

export interface AIGeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
}

export interface CardToInsert {
  knowledge_point_id: string;
  question: string;
  answer: string;
  explanation?: string;
  card_type: string;
  difficulty: number;
  options: string | null;
  /** @schedule decision - due date：新卡首次复习时间 */
  next_review: string;
  user_id?: string;
  graph_id?: string;
  quiz_set_id?: string;
  /** @schedule decision - FSRS CardState */
  fsrs_state: string;
  /** @schedule decision - FSRS Stability (S) */
  fsrs_stability: number;
  /** @schedule decision - FSRS Difficulty (D) */
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  /** @schedule decision - FSRS Retrievability (R) 初始快照 */
  fsrs_retrievability: number;
}

export interface QuizSetCardWithStudyCard {
  study_cards: StudyCard[];
}

export interface SubtaskWithTaskId {
  id: string;
  task_id: string;
  knowledge_point_id?: string;
  learning_state?: string;
  mastery_level?: number;
}

export const PRACTICE_WEIGHT = 0.1;
export const PRACTICE_MAX_IMPROVEMENT = 0.3;
export const QUIZ_WEIGHT = 0.2;
export const QUIZ_MAX_IMPROVEMENT = 0.4;

export const LEARNING_SESSIONS_TABLE = "learning_sessions";
export const LEARNING_SESSION_RESULTS_TABLE = "learning_session_results";

export const QUIZ_DIFFICULTY_MAP: Record<string, CardDifficulty> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  mixed: "mixed",
};

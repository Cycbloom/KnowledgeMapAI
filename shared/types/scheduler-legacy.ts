import type { UserTaskStatus } from "./scheduler-core";
import type {
  UserTask,
  UserTaskDetail,
  UserTaskStats,
  UserTaskFilters,
  CreateUserTaskData,
  UpdateUserTaskData,
} from "./scheduler-task";

/** @deprecated SM2-based review task type. Use study_cards (FSRS) based types instead. See FSRSReviewTask. */
export interface ReviewTask {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  task_id: string;
  algorithm?: "sm2" | "fsrs";
  interval_days?: number;
  ease_factor?: number;
  repetitions?: number;
  next_review_date: string;
  last_review_date?: string | null;
  last_quality_score?: number | null;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  fsrs_state?: string;
  fsrs_retrievability?: number;
  created_at: string;
  updated_at: string;
}

export interface FSRSReviewTask {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  task_id: string;
  algorithm: "fsrs";
  next_review_date: string;
  last_review_date?: string | null;
  last_quality_score?: number | null;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_state: string;
  fsrs_retrievability: number;
  created_at: string;
  updated_at: string;
}

/** @deprecated SM2-based create data. Use studyService.createCard() (FSRS) instead. */
export interface CreateReviewTaskData {
  knowledge_point_id: string;
  task_id: string;
}

/** @deprecated SM2-based update data. Use studyService.updateProgress() (FSRS) instead. */
export interface UpdateReviewTaskData {
  quality: number;
}

/** @deprecated SM2-based review stats. Use FSRS-based statistics from studyService instead. */
export interface ReviewTaskStats {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  future: number;
  averageEaseFactor: number;
  averageInterval: number;
  averageRepetitions: number;
}

/** @deprecated SM2-based pending review type. Use study_cards (FSRS) based types instead. */
export interface PendingReviewTask extends ReviewTask {
  urgency: "overdue" | "today" | "upcoming" | "future";
  masteryLevel: number;
}

/** @deprecated Use UserTaskStatus instead */
export type TaskStatus = UserTaskStatus;
/** @deprecated Use UserTask instead */
export type ScheduledTask = UserTask;
/** @deprecated Use UserTaskDetail instead */
export type TaskDetail = UserTaskDetail;
/** @deprecated Use UserTaskStats instead */
export type TaskStats = UserTaskStats;
/** @deprecated Use UserTaskFilters instead */
export type TaskFilters = UserTaskFilters;
/** @deprecated Use CreateUserTaskData instead */
export type CreateScheduledTaskData = CreateUserTaskData;
/** @deprecated Use UpdateUserTaskData instead */
export type UpdateScheduledTaskData = UpdateUserTaskData;

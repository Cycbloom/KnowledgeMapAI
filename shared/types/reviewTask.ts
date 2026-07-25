/**
 * FSRS 风格复习任务类型。
 *
 * 与后端 reviewTaskService.ts 对齐，消除前后端类型分裂。
 * 替代已删除的 scheduler-legacy.ts 中的 SM2 风格类型。
 */

export interface ReviewTask {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  task_id: string;
  interval_days?: number;
  ease_factor?: number;
  repetitions?: number;
  algorithm?: string;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  fsrs_state?: string;
  fsrs_retrievability?: number;
  next_review_date: string;
  last_review_date: string | null;
  last_quality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewTaskData {
  knowledge_point_id: string;
  task_id: string;
}

export interface ReviewTaskStats {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  future: number;
  averageStability: number;
  averageDifficulty: number;
  averageRetrievability: number;
}

export interface PendingReviewTask extends ReviewTask {
  urgency: "overdue" | "today" | "upcoming" | "future";
  masteryLevel: number;
}

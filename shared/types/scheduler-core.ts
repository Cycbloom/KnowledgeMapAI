export type TimerMode = "focus" | "shortBreak" | "longBreak";

export type TaskType = "one_time" | "long_term" | "periodic" | "learning" | "graph_learning";

export type ProgressMode = "average" | "decreasing" | "increasing" | "custom";

export type UserTaskStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type ExecutionStatus =
  | "completed"
  | "interrupted"
  | "time_slice_ended"
  | "pending"
  | "in_progress";

export type DependencyType = "strict" | "soft";

export type ScheduleType = "daily" | "weekly" | "custom" | "smart";

export type SubtaskStatus = "pending" | "in_progress" | "completed";

export type LearningState = "learning" | "review" | "practice" | "quiz";

export type ActivityKind = LearningState;

export type LinkType = "web" | "file" | "api";

export type TaskSource =
  | "user"
  | "import"
  | "template"
  | "system_recommendation";

export type SystemTaskType =
  | "graph_expansion"
  | "ai_generation"
  | "knowledge_sync"
  | "review_generation";

export type SystemTaskStatus =
  | "pending"
  | "in_progress"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

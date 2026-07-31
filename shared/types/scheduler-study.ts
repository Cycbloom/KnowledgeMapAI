import type { LearningState, SubtaskStatus } from "./scheduler-core";

export type LearningStageLabelKey =
  | "learning.stageLabels.learning"
  | "learning.stageLabels.review"
  | "learning.stageLabels.practice"
  | "learning.stageLabels.quiz";

export type LearningStageDescriptionKey =
  | "learning.stageDescriptions.learning"
  | "learning.stageDescriptions.review"
  | "learning.stageDescriptions.practice"
  | "learning.stageDescriptions.quiz";

export interface StateTransition {
  from: LearningState;
  to: LearningState;
  condition: {
    min_mastery?: number;
    max_mastery?: number;
  };
}

export interface LearningStateConfig {
  state: LearningState;
  labelKey: LearningStageLabelKey;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  descriptionKey: LearningStageDescriptionKey;
}

export const LEARNING_STATE_CONFIGS: Record<
  LearningState,
  LearningStateConfig
> = {
  learning: {
    state: "learning",
    labelKey: "learning.stageLabels.learning",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-500/20",
    borderColor: "border-blue-300 dark:border-blue-500/30",
    icon: "BookOpen",
    descriptionKey: "learning.stageDescriptions.learning",
  },
  review: {
    state: "review",
    labelKey: "learning.stageLabels.review",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-500/20",
    borderColor: "border-green-300 dark:border-green-500/30",
    icon: "RefreshCw",
    descriptionKey: "learning.stageDescriptions.review",
  },
  practice: {
    state: "practice",
    labelKey: "learning.stageLabels.practice",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-500/20",
    borderColor: "border-orange-300 dark:border-orange-500/30",
    icon: "Pencil",
    descriptionKey: "learning.stageDescriptions.practice",
  },
  quiz: {
    state: "quiz",
    labelKey: "learning.stageLabels.quiz",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-500/20",
    borderColor: "border-purple-300 dark:border-purple-500/30",
    icon: "FileCheck",
    descriptionKey: "learning.stageDescriptions.quiz",
  },
};

export interface CreateSubtaskData {
  title: string;
  description?: string;
  knowledge_point_id: string;
  estimated_duration?: number;
  priority?: number;
}

export interface UpdateSubtaskData {
  title?: string;
  description?: string;
  status?: SubtaskStatus;
  learning_state?: LearningState;
  mastery_level?: number;
  estimated_duration?: number;
  actual_duration?: number;
  priority?: number;
}

export interface TransitionSubtaskData {
  to_state: LearningState;
  mastery_level: number;
  reason?: string;
}

export type StudyMode = "drill" | "deep" | "preview" | "review" | "quiz" | "mixed";

export type StudyModePresetLabelKey =
  | "learning.studyModePresets.drill.label"
  | "learning.studyModePresets.deep.label"
  | "learning.studyModePresets.preview.label"
  | "learning.studyModePresets.review.label"
  | "learning.studyModePresets.quiz.label"
  | "learning.studyModePresets.mixed.label";

export type StudyModePresetDescriptionKey =
  | "learning.studyModePresets.drill.description"
  | "learning.studyModePresets.deep.description"
  | "learning.studyModePresets.preview.description"
  | "learning.studyModePresets.review.description"
  | "learning.studyModePresets.quiz.description"
  | "learning.studyModePresets.mixed.description";

export type StudyWorkflowStage = "learn" | "recall" | "practice" | "quiz" | "review" | "reflect";

export type RatingMode = "binary" | "ternary" | "full";

export interface StudyWorkflowTransition {
  from: StudyWorkflowStage;
  to: StudyWorkflowStage;
  condition: "always" | "mastery_above" | "accuracy_above" | "completed";
  threshold?: number;
}

export interface StudyWorkflowConfig {
  stages: StudyWorkflowStage[];
  transitions: StudyWorkflowTransition[];
  exitConditions: Partial<Record<StudyWorkflowStage, { type: "mastery" | "accuracy" | "time"; threshold: number }>>;
}

export interface FsrsParamOverride {
  request_retention?: number;
  maximum_interval?: number;
  w?: number[];
}

export interface StudyModePreset {
  mode: StudyMode;
  labelKey: StudyModePresetLabelKey;
  descriptionKey: StudyModePresetDescriptionKey;
  icon: string;
  workflow: StudyWorkflowConfig;
  fsrsOverride: FsrsParamOverride;
  ratingMode: RatingMode;
  masteryThresholdOverride?: Partial<Record<"LEARNING_REVIEW" | "REVIEW_PRACTICE" | "PRACTICE_QUIZ" | "QUIZ_MASTERY", number>>;
}

// --- Learning loop orchestrator types (migrated from backend learningLoopOrchestrator.ts) ---

export type LoopStage = "learn" | "test" | "review" | "iterate";

export interface LearningLoop {
  id: string;
  userId: string;
  knowledgePointId?: string;
  graphId?: string;
  currentStage: LoopStage;
  currentWorkflowStage?: StudyWorkflowStage;
  studyMode?: StudyMode;
  masteryLevel: number;
  loopCount: number;
  lastStageChangeAt: string;
  config: {
    masteryThreshold?: number;
    testDelayMinutes?: number;
    maxLoops?: number;
  };
  taskId?: string;
}

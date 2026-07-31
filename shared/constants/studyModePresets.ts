import type { StudyMode, StudyModePreset } from "../types/scheduler";

export const STUDY_MODE_PRESETS: Record<string, StudyModePreset> = {
  drill: {
    mode: "drill",
    labelKey: "learning.studyModePresets.drill.label",
    descriptionKey: "learning.studyModePresets.drill.description",
    icon: "Zap",
    workflow: {
      stages: ["recall", "quiz", "review"],
      transitions: [
        { from: "recall", to: "quiz", condition: "always" },
        { from: "quiz", to: "review", condition: "accuracy_above", threshold: 0.8 },
        { from: "quiz", to: "recall", condition: "accuracy_above", threshold: 0.0 },
      ],
      exitConditions: {
        quiz: { type: "accuracy", threshold: 0.8 },
      },
    },
    fsrsOverride: {
      request_retention: 0.85,
      maximum_interval: 30,
    },
    ratingMode: "binary",
  },
  deep: {
    mode: "deep",
    labelKey: "learning.studyModePresets.deep.label",
    descriptionKey: "learning.studyModePresets.deep.description",
    icon: "BookOpen",
    workflow: {
      stages: ["learn", "recall", "practice", "quiz", "reflect"],
      transitions: [
        { from: "learn", to: "recall", condition: "completed" },
        { from: "recall", to: "practice", condition: "always" },
        { from: "practice", to: "quiz", condition: "accuracy_above", threshold: 0.7 },
        { from: "practice", to: "recall", condition: "always" },
        { from: "quiz", to: "reflect", condition: "accuracy_above", threshold: 0.8 },
        { from: "quiz", to: "practice", condition: "always" },
      ],
      exitConditions: {
        practice: { type: "accuracy", threshold: 0.7 },
        quiz: { type: "accuracy", threshold: 0.8 },
      },
    },
    fsrsOverride: {
      request_retention: 0.9,
      maximum_interval: 36500,
    },
    ratingMode: "full",
  },
  preview: {
    mode: "preview",
    labelKey: "learning.studyModePresets.preview.label",
    descriptionKey: "learning.studyModePresets.preview.description",
    icon: "Eye",
    workflow: {
      stages: ["learn"],
      transitions: [],
      exitConditions: {
        learn: { type: "time", threshold: 60 },
      },
    },
    fsrsOverride: {},
    ratingMode: "binary",
  },
  review: {
    mode: "review",
    labelKey: "learning.studyModePresets.review.label",
    descriptionKey: "learning.studyModePresets.review.description",
    icon: "RefreshCw",
    workflow: {
      stages: ["review"],
      transitions: [],
      exitConditions: {},
    },
    fsrsOverride: {
      request_retention: 0.9,
      maximum_interval: 36500,
    },
    ratingMode: "full",
  },
  quiz: {
    mode: "quiz",
    labelKey: "learning.studyModePresets.quiz.label",
    descriptionKey: "learning.studyModePresets.quiz.description",
    icon: "FileCheck",
    workflow: {
      stages: ["quiz", "review"],
      transitions: [
        { from: "quiz", to: "review", condition: "accuracy_above", threshold: 0.7 },
        { from: "quiz", to: "quiz", condition: "always" },
      ],
      exitConditions: {
        quiz: { type: "accuracy", threshold: 0.7 },
      },
    },
    fsrsOverride: {
      request_retention: 0.85,
      maximum_interval: 60,
    },
    ratingMode: "full",
  },
  mixed: {
    mode: "mixed",
    labelKey: "learning.studyModePresets.mixed.label",
    descriptionKey: "learning.studyModePresets.mixed.description",
    icon: "Layers",
    workflow: {
      stages: ["learn", "recall", "practice", "quiz", "review"],
      transitions: [
        { from: "learn", to: "recall", condition: "completed" },
        { from: "recall", to: "practice", condition: "always" },
        { from: "practice", to: "quiz", condition: "accuracy_above", threshold: 0.7 },
        { from: "practice", to: "review", condition: "always" },
        { from: "quiz", to: "review", condition: "accuracy_above", threshold: 0.8 },
        { from: "quiz", to: "practice", condition: "always" },
      ],
      exitConditions: {
        practice: { type: "accuracy", threshold: 0.7 },
        quiz: { type: "accuracy", threshold: 0.8 },
      },
    },
    fsrsOverride: {
      request_retention: 0.9,
      maximum_interval: 36500,
    },
    ratingMode: "full",
  },
};

export const DEFAULT_STUDY_MODE: StudyMode = "mixed";

export function getStudyModePreset(mode: string): StudyModePreset {
  return STUDY_MODE_PRESETS[mode] ?? STUDY_MODE_PRESETS[DEFAULT_STUDY_MODE];
}

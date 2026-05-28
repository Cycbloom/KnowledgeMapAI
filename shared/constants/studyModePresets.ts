import type { StudyMode, StudyModePreset } from "../types/scheduler";

export const STUDY_MODE_PRESETS: Record<string, StudyModePreset> = {
  drill: {
    mode: "drill",
    label: "刷题模式",
    description: "跳过学习材料，直接进入测验，短间隔高频率强化记忆",
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
    label: "深度学习",
    description: "完整工作流：学习材料→主动回忆→练习→测验→反思，标准FSRS参数",
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
    label: "快速浏览",
    description: "仅阅读学习材料，单次曝光后标记为已浏览，不生成复习卡片",
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
    label: "间隔复习",
    description: "仅展示到期复习的节点，按FSRS标准调度执行复习",
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
    label: "测验模式",
    description: "直接对所有已学节点进行测验，根据测验结果更新掌握度",
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
    label: "混合模式",
    description: "根据节点状态自动选择策略：新节点→深度学习，已学节点→间隔复习，衰减节点→刷题强化",
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

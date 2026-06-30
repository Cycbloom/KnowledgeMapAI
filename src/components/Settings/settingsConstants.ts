import type { AIProviderType } from "@shared/types";

export interface ProviderConfig {
  configured: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
  source: "user" | "env" | "none";
}

export interface ProviderFormData {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface DatabaseConfig {
  configured: boolean;
  url: string;
  mode: "cloud" | "local";
  connected: boolean;
}

export const PROVIDER_DEFAULTS: Record<
  string,
  {
    name: string;
    baseURL: string;
    model: string;
    embeddingModel?: string;
    supportsEmbedding?: boolean;
  }
> = {
  deepseek: {
    name: "Deepseek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    embeddingModel: undefined,
    supportsEmbedding: false,
  },
  volcengine: {
    name: "火山引擎 (Volcengine)",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-pro-4k",
    embeddingModel: "doubao-embedding-vision-251215",
    supportsEmbedding: true,
  },
  aliyun: {
    name: "阿里云 (Aliyun)",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
    embeddingModel: "text-embedding-v3",
    supportsEmbedding: true,
  },
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    supportsEmbedding: true,
  },
  zhipu: {
    name: "智谱 AI (Zhipu)",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    embeddingModel: "embedding-3",
    supportsEmbedding: true,
  },
  moonshot: {
    name: "月之暗面 (Moonshot)",
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    embeddingModel: undefined,
    supportsEmbedding: false,
  },
};

export const STUDY_MODE_OPTIONS = [
  { value: "drill", label: "刷题模式", description: "跳过学习材料，直接测验，短间隔高频" },
  { value: "deep", label: "深度学习", description: "完整工作流，标准FSRS参数" },
  { value: "preview", label: "快速浏览", description: "仅阅读材料，不生成复习卡片" },
  { value: "review", label: "间隔复习", description: "到期复习节点，标准调度" },
  { value: "quiz", label: "测验模式", description: "直接测验已学节点" },
  { value: "mixed", label: "混合模式", description: "自动按节点状态选择策略" },
] as const;

export const STUDY_MODE_PRESETS: Record<string, { requestRetention: number; maximumInterval: number }> = {
  drill: { requestRetention: 0.85, maximumInterval: 30 },
  deep: { requestRetention: 0.9, maximumInterval: 36500 },
  preview: { requestRetention: 0.7, maximumInterval: 7 },
  review: { requestRetention: 0.9, maximumInterval: 36500 },
  quiz: { requestRetention: 0.85, maximumInterval: 180 },
  mixed: { requestRetention: 0.9, maximumInterval: 36500 },
};

export const DEFAULT_MASTERY_THRESHOLDS = {
  learningReview: 0.3,
  reviewPractice: 0.5,
  practiceQuiz: 0.7,
};

export const DEFAULT_SCHEDULER_WEIGHTS = {
  timeSlot: 0.1,
  mastery: 0.2,
  dependency: 0.15,
  typeMatch: 0.1,
  priority: 0.15,
  urgency: 0.2,
  availability: 0.1,
};

export const STUDY_STRATEGY_DEFAULTS = {
  defaultStudyMode: "mixed",
  requestRetention: 0.9,
  maximumInterval: 36500,
  masteryThresholds: DEFAULT_MASTERY_THRESHOLDS,
  schedulerWeights: DEFAULT_SCHEDULER_WEIGHTS,
};

export interface StudyStrategyValues {
  request_retention: number;
  maximum_interval: number;
  defaultStudyMode: string;
  masteryThresholds: typeof DEFAULT_MASTERY_THRESHOLDS;
  schedulerWeights: typeof DEFAULT_SCHEDULER_WEIGHTS;
  semantic_scheduling: boolean;
  available_models: Record<string, string[]>;
}

export interface MainAiConfig {
  provider: string;
  model: string;
  baseURL?: string;
  apiKey?: string;
}

export interface EmbeddingAiConfig {
  provider: string;
  model: string;
  baseURL: string;
  apiKey: string;
  enabled: boolean;
  loaded: boolean;
  isDefault: boolean;
}

export interface FsrsParams {
  source: "default" | "custom" | "optimized";
  w: number[];
  request_retention: number;
  maximum_interval: number;
  last_optimized_at: string | null;
}

export interface FsrsOptimizeResult {
  success: boolean;
  improvement: number;
  reviewCount: number;
  message: string;
}

export interface MobileAIConfig {
  provider: AIProviderType;
  model: string;
  apiKey: string;
}

export const DEFAULT_AVAILABLE_MODES: Record<string, string[]> = {
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  volcengine: ["doubao-pro-4k", "doubao-pro-32k", "doubao-embedding-1.5"],
  aliyun: ["qwen-max", "qwen-plus", "qwen-turbo"],
};

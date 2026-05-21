export type { MobileAIUserConfig } from "./config";

export {
  MOBILE_AI_CONFIG_KEY,
  ENV_API_KEYS,
  getStoredAIConfig,
  storeAIConfig,
  getAIConfigFromEnv,
  getAIConfigFromUserSettings,
  createAIClient,
} from "./config";

export type {
  GeneratedCard,
  GenerateCardsResult,
  AICardGenErrorType,
  AICardGenError,
} from "./errors";

export { classifyError } from "./errors";

export type { Keyword, GenerateLearningMaterialResult } from "./prompts";

export {
  TYPE_PROMPTS,
  DIFFICULTY_PROMPTS,
  getLearningMaterialSystemPrompt,
} from "./prompts";

export { mobileAIService } from "./service";

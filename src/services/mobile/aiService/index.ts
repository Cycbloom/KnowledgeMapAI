export {
  MOBILE_AI_CONFIG_KEY,
  MobileAIUserConfig,
  ENV_API_KEYS,
  getStoredAIConfig,
  storeAIConfig,
  getAIConfigFromEnv,
  getAIConfigFromUserSettings,
  createAIClient,
} from "./config";

export {
  GeneratedCard,
  GenerateCardsResult,
  AICardGenErrorType,
  AICardGenError,
  classifyError,
} from "./errors";

export {
  Keyword,
  GenerateLearningMaterialResult,
  TYPE_PROMPTS,
  DIFFICULTY_PROMPTS,
  getLearningMaterialSystemPrompt,
} from "./prompts";

export { mobileAIService } from "./service";

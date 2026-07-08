import type { AIProviderType, AIProviderConfig } from "@shared/types";
import { appSettingsService } from "../core/appSettingsService";
import { logger } from "../../utils/logger";

// Providers that support embedding functionality
const EMBEDDING_CAPABLE_PROVIDERS: AIProviderType[] = [
  "volcengine",
  "aliyun",
  "openai",
  "zhipu",
];

// Fallback env configs
export const getEnvConfig = (provider: AIProviderType): AIProviderConfig => {
  switch (provider) {
    case "deepseek":
      return {
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || "",
        baseURL: "https://api.deepseek.com",
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      };
    case "volcengine":
      return {
        apiKey: process.env.VOLCENGINE_API_KEY || "",
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
        model: process.env.VOLCENGINE_MODEL || "doubao-seed-1-8-251228",
        embeddingModel:
          process.env.VOLCENGINE_EMBEDDING_MODEL ||
          "doubao-embedding-vision-251215",
      };
    case "aliyun":
      return {
        apiKey: process.env.ALIYUN_API_KEY || "",
        baseURL: process.env.ALIYUN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: process.env.ALIYUN_MODEL || "qwen-long-latest",
      };
    case "openai":
      return {
        apiKey: process.env.OPENAI_API_KEY || "",
        baseURL: "https://api.openai.com/v1",
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      };
    case "zhipu":
      return {
        apiKey: process.env.ZHIPU_API_KEY || "",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        model: process.env.ZHIPU_MODEL || "glm-4-flash",
      };
    case "moonshot":
      return {
        apiKey: process.env.MOONSHOT_API_KEY || "",
        baseURL: "https://api.moonshot.cn/v1",
        model: process.env.MOONSHOT_MODEL || "moonshot-v1-8k",
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

export const getProviderConfig = async (
  provider: AIProviderType,
): Promise<AIProviderConfig> => {
  const envConfig = getEnvConfig(provider);

  try {
    const allConfigs =
      await appSettingsService.getSetting<Record<string, AIProviderConfig>>(
        "ai_provider_config",
      );

    if (allConfigs && allConfigs[provider]) {
      const dbConfig = allConfigs[provider];
      return {
        apiKey: dbConfig.apiKey || envConfig.apiKey,
        baseURL: dbConfig.baseURL || envConfig.baseURL,
        model: dbConfig.model || envConfig.model,
        embeddingModel: dbConfig.embeddingModel || envConfig.embeddingModel,
      };
    }
  } catch (error) {
    logger.error("Failed to load settings from DB, falling back to env", error);
  }

  return envConfig;
};

export const getDefaultProvider = async (): Promise<AIProviderType> => {
  try {
    const sysConfig = await appSettingsService.getSetting<{
      default_provider: string;
    }>("system_config");
    if (sysConfig?.default_provider) {
      return sysConfig.default_provider as AIProviderType;
    }
  } catch (e) {
    // ignore
  }
  return (process.env.AI_DEFAULT_PROVIDER as AIProviderType) || "deepseek";
};

export const getProviderForTask = async (
  task: "text" | "embedding" | "reasoning" | "tts" | "stt" = "text",
): Promise<AIProviderType | null> => {
  try {
    const sysConfig = await appSettingsService.getSetting<{
      main_ai?: { provider: string };
      embedding_ai?: { provider: string };
      stt_ai?: { provider: string };
      tts_ai?: { provider: string };
    }>("system_config");

    if (task === "embedding") {
      // 1. 优先使用专门配置的 embedding provider
      if (sysConfig?.embedding_ai?.provider) {
        return sysConfig.embedding_ai.provider as AIProviderType;
      }

      // 2. 检查环境变量
      const envEmbeddingProvider = process.env
        .EMBEDDING_PROVIDER as AIProviderType;
      if (envEmbeddingProvider) {
        return envEmbeddingProvider;
      }

      // 3. Fallback: 检查 main_ai provider 是否支持 embedding
      if (sysConfig?.main_ai?.provider) {
        const mainProvider = sysConfig.main_ai.provider as AIProviderType;
        if (EMBEDDING_CAPABLE_PROVIDERS.includes(mainProvider)) {
          return mainProvider;
        }
      }

      return null;
    }

    if (task === "stt") {
      if (sysConfig?.stt_ai?.provider) {
        return sysConfig.stt_ai.provider as AIProviderType;
      }
      return "aliyun";
    }

    if (task === "tts") {
      if (sysConfig?.tts_ai?.provider) {
        return sysConfig.tts_ai.provider as AIProviderType;
      }
      return "aliyun";
    }

    if (sysConfig?.main_ai?.provider) {
      return sysConfig.main_ai.provider as AIProviderType;
    }
  } catch (e) {
    logger.error(`[getProviderForTask] Error reading config for task=${task}:`, e);
  }

  return await getDefaultProvider();
};

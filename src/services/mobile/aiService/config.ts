import { useStore } from "@/store/useStore";
import {
  createMobileAIClient,
  MobileAIClient,
  isValidProvider,
} from "../aiClient";
import type { AIProviderType } from "@shared/types";

export const MOBILE_AI_CONFIG_KEY = "mobile_ai_config";

export interface MobileAIUserConfig {
  provider: AIProviderType;
  model?: string;
  apiKey: string;
}

export const ENV_API_KEYS: Record<AIProviderType, string | undefined> = {
  deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
  volcengine: import.meta.env.VITE_VOLCENGINE_API_KEY,
  aliyun: import.meta.env.VITE_ALIYUN_API_KEY,
  openai: import.meta.env.VITE_OPENAI_API_KEY,
  zhipu: import.meta.env.VITE_ZHIPU_API_KEY,
  moonshot: import.meta.env.VITE_MOONSHOT_API_KEY,
};

export function getStoredAIConfig(): MobileAIUserConfig | null {
  try {
    const stored = localStorage.getItem(MOBILE_AI_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[MobileAIService] 加载本地存储配置失败:", e);
  }
  return null;
}

export function storeAIConfig(config: MobileAIUserConfig): void {
  try {
    localStorage.setItem(MOBILE_AI_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("[MobileAIService] 保存配置到本地存储失败:", e);
  }
}

export function getAIConfigFromEnv(): MobileAIUserConfig | null {
  const { user } = useStore.getState();
  const aiConfig = user?.profile?.settings?.ai_config?.text;

  const provider = (aiConfig?.provider || "deepseek") as AIProviderType;
  const apiKey = ENV_API_KEYS[provider];

  if (!apiKey) {
    return null;
  }

  return {
    provider,
    model: aiConfig?.model,
    apiKey,
  };
}

export function getAIConfigFromUserSettings(): MobileAIUserConfig | null {
  const envConfig = getAIConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }

  const { user } = useStore.getState();
  const aiConfig = user?.profile?.settings?.ai_config?.text;
  const storedConfig = getStoredAIConfig();

  if (
    storedConfig &&
    storedConfig.apiKey &&
    storedConfig.apiKey.trim() !== ""
  ) {
    const provider = (aiConfig?.provider ||
      storedConfig.provider) as AIProviderType;

    if (!isValidProvider(provider)) {
      console.error("[MobileAIService] 无效的 Provider:", provider);
      return null;
    }

    return {
      provider,
      model: aiConfig?.model || storedConfig.model,
      apiKey: storedConfig.apiKey,
    };
  }

  return null;
}

export function createAIClient(): MobileAIClient | null {
  const config = getAIConfigFromUserSettings();
  if (!config || !config.apiKey || config.apiKey.trim() === "") {
    console.warn("[MobileAIService] AI 服务未配置");
    return null;
  }

  try {
    return createMobileAIClient(config);
  } catch (error) {
    console.error("[MobileAIService] 创建 AI 客户端失败:", error);
    return null;
  }
}

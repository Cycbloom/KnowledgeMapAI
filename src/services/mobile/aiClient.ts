import OpenAI from "openai";
import type { AIProviderType } from "@shared/types";

export interface AIProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  embeddingModel?: string;
}

export interface MobileAIConfig {
  provider: AIProviderType;
  model?: string;
  apiKey: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 30000,
};

const PROVIDER_CONFIGS: Record<
  AIProviderType,
  Omit<AIProviderConfig, "apiKey">
> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  volcengine: {
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-8-251228",
    embeddingModel: "doubao-embedding-vision-251215",
  },
  aliyun: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-long-latest",
  },
};

const VALID_PROVIDERS: AIProviderType[] = ["deepseek", "volcengine", "aliyun"];

function validateConfig(config: MobileAIConfig): void {
  if (!config) {
    throw new Error("AI 配置不能为空");
  }

  if (!config.apiKey || config.apiKey.trim() === "") {
    throw new Error("API Key 不能为空，请在设置中配置 API Key");
  }

  if (!config.provider) {
    throw new Error("AI 服务商未指定，请选择一个服务商");
  }

  if (!VALID_PROVIDERS.includes(config.provider)) {
    throw new Error(
      `不支持的 AI 服务商: ${config.provider}，请选择: ${VALID_PROVIDERS.join(", ")}`,
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(exponentialDelay, config.maxDelay);
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

export class MobileAIClient {
  private client: OpenAI;
  private config: AIProviderConfig;
  private providerType: AIProviderType;
  private retryConfig: RetryConfig;

  constructor(config: MobileAIConfig, retryConfig?: Partial<RetryConfig>) {
    validateConfig(config);

    this.providerType = config.provider;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    const providerConfig = PROVIDER_CONFIGS[config.provider];

    this.config = {
      apiKey: config.apiKey,
      baseURL: providerConfig.baseURL,
      model: config.model || providerConfig.model,
      embeddingModel: providerConfig.embeddingModel,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      dangerouslyAllowBrowser: true,
      timeout: 120000,
    });
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: { model?: string; timeout?: number },
  ): Promise<string> {
    const model = options?.model || this.config.model;

    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model,
      });

      return completion.choices[0].message.content || "";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new Error(`AI 请求失败: ${errorMessage}`);
    }
  }

  async chatWithJson<T>(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: { model?: string },
  ): Promise<T> {
    const model = options?.model || this.config.model;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          messages,
          model,
          response_format: { type: "json_object" },
        });

        const rawContent = completion.choices[0].message.content || "";
        const cleanedContent = cleanJsonString(rawContent);
        const parsed = JSON.parse(cleanedContent) as T;

        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxRetries - 1) {
          const backoffDelay = calculateBackoff(attempt, this.retryConfig);
          await delay(backoffDelay);
        }
      }
    }

    throw new Error(
      `AI 请求失败，已重试 ${this.retryConfig.maxRetries} 次: ${lastError?.message || "未知错误"}`,
    );
  }

  get model(): string {
    return this.config.model;
  }

  get provider(): AIProviderType {
    return this.providerType;
  }

  get baseURL(): string {
    return this.config.baseURL;
  }
}

export function createMobileAIClient(config: MobileAIConfig): MobileAIClient {
  return new MobileAIClient(config);
}

export function getProviderDefaultModel(provider: AIProviderType): string {
  return PROVIDER_CONFIGS[provider].model;
}

export function isValidProvider(provider: string): provider is AIProviderType {
  return VALID_PROVIDERS.includes(provider as AIProviderType);
}

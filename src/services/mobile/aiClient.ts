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

export class MobileAIClient {
  private client: OpenAI;
  private config: AIProviderConfig;
  private providerType: AIProviderType;

  constructor(config: MobileAIConfig) {
    this.providerType = config.provider;
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
    });
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: { model?: string },
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      messages,
      model: options?.model || this.config.model,
    });

    return completion.choices[0].message.content || "";
  }

  async chatWithJson<T>(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: { model?: string },
  ): Promise<T> {
    const completion = await this.client.chat.completions.create({
      messages,
      model: options?.model || this.config.model,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content || "{}";
    return JSON.parse(content) as T;
  }

  get model(): string {
    return this.config.model;
  }

  get provider(): AIProviderType {
    return this.providerType;
  }
}

export function createMobileAIClient(config: MobileAIConfig): MobileAIClient {
  return new MobileAIClient(config);
}

export function getProviderDefaultModel(provider: AIProviderType): string {
  return PROVIDER_CONFIGS[provider].model;
}

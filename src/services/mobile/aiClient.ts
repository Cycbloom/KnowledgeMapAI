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

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "***";
  }
  return apiKey.slice(0, 4) + "****" + apiKey.slice(-4);
}

export class MobileAIClient {
  private client: OpenAI;
  private config: AIProviderConfig;
  private providerType: AIProviderType;
  private retryConfig: RetryConfig;

  constructor(config: MobileAIConfig, retryConfig?: Partial<RetryConfig>) {
    console.log("=".repeat(60));
    console.log("[MobileAIClient] 初始化 AI 客户端");
    console.log("=".repeat(60));
    console.log("[MobileAIClient] 输入配置:", {
      provider: config.provider,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      model: config.model,
    });

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

    console.log("[MobileAIClient] 最终配置:", {
      provider: this.providerType,
      baseURL: this.config.baseURL,
      model: this.config.model,
      maskedApiKey: maskApiKey(this.config.apiKey),
    });
    console.log("=".repeat(60));

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      dangerouslyAllowBrowser: true,
      timeout: 120000,
    });
    console.log("[MobileAIClient] 超时设置: 120秒");
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: { model?: string; timeout?: number },
  ): Promise<string> {
    const model = options?.model || this.config.model;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${maskApiKey(this.config.apiKey)}`,
    };

    console.log("\n" + "=".repeat(60));
    console.log("[MobileAIClient.chat] 发送请求");
    console.log("=".repeat(60));
    console.log("[请求信息]");
    console.log("  URL:", `${this.config.baseURL}/chat/completions`);
    console.log("  Method: POST");
    console.log("  Headers:", JSON.stringify(headers, null, 2));
    console.log("  API Key (原始):", this.config.apiKey ? "已设置" : "未设置");
    console.log("  API Key 长度:", this.config.apiKey?.length || 0);
    console.log(
      "  Request Body:",
      JSON.stringify(
        {
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content:
              m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""),
          })),
        },
        null,
        2,
      ),
    );
    console.log("=".repeat(60));

    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model,
      });

      const elapsed = Date.now() - startTime;
      const content = completion.choices[0].message.content || "";

      console.log("\n" + "=".repeat(60));
      console.log("[MobileAIClient.chat] 响应成功");
      console.log("=".repeat(60));
      console.log("[响应信息]");
      console.log("  耗时:", elapsed, "ms");
      console.log("  响应长度:", content.length, "字符");
      console.log(
        "  响应预览:",
        content.slice(0, 200) + (content.length > 200 ? "..." : ""),
      );
      console.log("=".repeat(60));

      return content;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.log("\n" + "=".repeat(60));
      console.log("[MobileAIClient.chat] 请求失败");
      console.log("=".repeat(60));
      console.log("[错误信息]");
      console.log("  耗时:", elapsed, "ms");
      console.log("  错误:", errorMessage);
      if (error instanceof Error && (error as any).status) {
        console.log("  HTTP 状态码:", (error as any).status);
      }
      if (error instanceof Error && (error as any).response) {
        console.log("  响应数据:", (error as any).response);
      }
      console.log("=".repeat(60));

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
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${maskApiKey(this.config.apiKey)}`,
        };

        console.log("\n" + "=".repeat(60));
        console.log(
          `[MobileAIClient.chatWithJson] 发送请求 (尝试 ${attempt + 1}/${this.retryConfig.maxRetries})`,
        );
        console.log("=".repeat(60));
        console.log("[请求信息]");
        console.log("  URL:", `${this.config.baseURL}/chat/completions`);
        console.log("  Method: POST");
        console.log("  Headers:", JSON.stringify(headers, null, 2));
        console.log(
          "  API Key (原始):",
          this.config.apiKey ? "已设置" : "未设置",
        );
        console.log("  API Key 长度:", this.config.apiKey?.length || 0);
        console.log(
          "  Request Body:",
          JSON.stringify(
            {
              model,
              messages: messages.map((m) => ({
                role: m.role,
                content:
                  m.content.slice(0, 100) +
                  (m.content.length > 100 ? "..." : ""),
              })),
              response_format: { type: "json_object" },
            },
            null,
            2,
          ),
        );
        console.log("=".repeat(60));

        const startTime = Date.now();

        const completion = await this.client.chat.completions.create({
          messages,
          model,
          response_format: { type: "json_object" },
        });

        const elapsed = Date.now() - startTime;
        const rawContent = completion.choices[0].message.content || "";

        console.log("\n" + "=".repeat(60));
        console.log("[MobileAIClient.chatWithJson] 响应成功");
        console.log("=".repeat(60));
        console.log("[响应信息]");
        console.log("  耗时:", elapsed, "ms");
        console.log("  响应长度:", rawContent.length, "字符");
        console.log(
          "  响应预览:",
          rawContent.slice(0, 300) + (rawContent.length > 300 ? "..." : ""),
        );
        console.log("=".repeat(60));

        const cleanedContent = cleanJsonString(rawContent);

        const parsed = JSON.parse(cleanedContent) as T;
        console.log("[MobileAIClient.chatWithJson] JSON 解析成功");

        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isNetworkError =
          lastError.message.includes("ERR_HTTP2_PROTOCOL_ERROR") ||
          lastError.message.includes("ERR_CONNECTION") ||
          lastError.message.includes("network") ||
          lastError.message.includes("timeout") ||
          lastError.message.includes("ECONNREFUSED") ||
          lastError.message.includes("ETIMEDOUT");

        console.log("\n" + "=".repeat(60));
        console.log(`[MobileAIClient.chatWithJson] 尝试 ${attempt + 1} 失败`);
        console.log("=".repeat(60));
        console.log("[错误信息]");
        console.log("  错误类型:", isNetworkError ? "网络错误" : "API 错误");
        console.log("  错误消息:", lastError.message);
        if ((error as any)?.status) {
          console.log("  HTTP 状态码:", (error as any).status);
        }
        if ((error as any)?.response) {
          console.log("  响应数据:", (error as any).response);
        }
        if ((error as any)?.cause) {
          console.log("  原因:", (error as any).cause);
        }
        console.log("=".repeat(60));

        if (attempt < this.retryConfig.maxRetries - 1) {
          const backoffDelay = calculateBackoff(attempt, this.retryConfig);
          console.log(
            `[MobileAIClient.chatWithJson] 等待 ${backoffDelay}ms 后重试`,
          );
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

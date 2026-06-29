// AI 配置路由共享常量与工具函数

export const PROVIDER_ENV_KEY_MAP: Record<string, string[]> = {
  deepseek: ["DEEPSEEK_API_KEY", "AI_API_KEY"],
  volcengine: ["VOLCENGINE_API_KEY"],
  aliyun: ["ALIYUN_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  zhipu: ["ZHIPU_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY"],
};

export const PROVIDER_DEFAULTS: Record<
  string,
  { baseURL: string; model: string; embeddingModel?: string }
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
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  zhipu: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
  },
  moonshot: {
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
};

export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) {
    return "****";
  }
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      return `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
    }
    const parts = parsed.hostname.split(".");
    if (parts.length >= 2) {
      return `${parsed.protocol}//****.${parts.slice(-2).join(".")}`;
    }
    return `${parsed.protocol}//****`;
  } catch {
    return "****";
  }
}

export function hasEnvFallback(provider: string): boolean {
  const envKeys = PROVIDER_ENV_KEY_MAP[provider];
  if (!envKeys) return false;
  return envKeys.some((key) => !!process.env[key]);
}

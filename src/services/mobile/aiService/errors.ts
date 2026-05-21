export interface GeneratedCard {
  type: "qa" | "choice" | "true_false" | "multi_choice" | "fill_in_the_blank";
  question: string;
  answer: string;
  explanation?: string;
  options?: string[];
  correct_indices?: number[];
}

export interface GenerateCardsResult {
  cards: GeneratedCard[];
}

export type AICardGenErrorType =
  | "api_key_missing"
  | "api_key_invalid"
  | "quota_exceeded"
  | "rate_limited"
  | "network_error"
  | "timeout"
  | "invalid_response"
  | "database_error"
  | "unknown";

export interface AICardGenError {
  type: AICardGenErrorType;
  message: string;
  suggestion: string;
  retryable: boolean;
}

export function classifyError(error: unknown): AICardGenError {
  const errorMessage =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  const originalMessage =
    error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("api key") ||
    errorMessage.includes("api_key") ||
    errorMessage.includes("未配置")
  ) {
    return {
      type: "api_key_missing",
      message: "AI 服务未配置",
      suggestion: "请前往设置页面配置 AI API Key",
      retryable: false,
    };
  }

  if (
    (errorMessage.includes("invalid") && errorMessage.includes("key")) ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("401") ||
    errorMessage.includes("403")
  ) {
    return {
      type: "api_key_invalid",
      message: "API Key 无效",
      suggestion: "请检查您的 API Key 是否正确，或前往设置页面重新配置",
      retryable: false,
    };
  }

  if (
    errorMessage.includes("quota") ||
    errorMessage.includes("exceeded") ||
    errorMessage.includes("limit") ||
    errorMessage.includes("insufficient")
  ) {
    return {
      type: "quota_exceeded",
      message: "API 配额已用尽",
      suggestion: "您的 API 配额已用尽，请检查账户余额或等待配额重置",
      retryable: false,
    };
  }

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests") ||
    errorMessage.includes("429")
  ) {
    return {
      type: "rate_limited",
      message: "请求过于频繁",
      suggestion: "请稍后再试，或减少单次生成的题目数量",
      retryable: true,
    };
  }

  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("enotfound") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("offline")
  ) {
    return {
      type: "network_error",
      message: "网络连接失败",
      suggestion: "请检查网络连接后重试",
      retryable: true,
    };
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return {
      type: "timeout",
      message: "请求超时",
      suggestion: "服务器响应超时，请稍后重试",
      retryable: true,
    };
  }

  if (
    errorMessage.includes("json") ||
    errorMessage.includes("parse") ||
    errorMessage.includes("invalid response") ||
    errorMessage.includes("format")
  ) {
    return {
      type: "invalid_response",
      message: "AI 响应格式错误",
      suggestion: "AI 返回的数据格式不正确，请重试",
      retryable: true,
    };
  }

  if (
    errorMessage.includes("database") ||
    errorMessage.includes("supabase") ||
    errorMessage.includes("insert") ||
    errorMessage.includes("save") ||
    errorMessage.includes("保存")
  ) {
    return {
      type: "database_error",
      message: "数据库写入失败",
      suggestion: "题目生成成功但保存失败，请检查数据库连接后重试",
      retryable: true,
    };
  }

  return {
    type: "unknown",
    message: `生成失败: ${originalMessage}`,
    suggestion: "请稍后重试，如问题持续请联系技术支持",
    retryable: true,
  };
}

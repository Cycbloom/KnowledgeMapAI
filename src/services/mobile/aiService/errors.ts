import i18next from "i18next";

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
      message: i18next.t("ai.errors.apiKeyMissing.message"),
      suggestion: i18next.t("ai.errors.apiKeyMissing.suggestion"),
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
      message: i18next.t("ai.errors.apiKeyInvalid.message"),
      suggestion: i18next.t("ai.errors.apiKeyInvalid.suggestion"),
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
      message: i18next.t("ai.errors.quotaExceeded.message"),
      suggestion: i18next.t("ai.errors.quotaExceeded.suggestion"),
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
      message: i18next.t("ai.errors.rateLimited.message"),
      suggestion: i18next.t("ai.errors.rateLimited.suggestion"),
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
      message: i18next.t("ai.errors.networkError.message"),
      suggestion: i18next.t("ai.errors.networkError.suggestion"),
      retryable: true,
    };
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return {
      type: "timeout",
      message: i18next.t("ai.errors.timeout.message"),
      suggestion: i18next.t("ai.errors.timeout.suggestion"),
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
      message: i18next.t("ai.errors.invalidResponse.message"),
      suggestion: i18next.t("ai.errors.invalidResponse.suggestion"),
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
      message: i18next.t("ai.errors.databaseError.message"),
      suggestion: i18next.t("ai.errors.databaseError.suggestion"),
      retryable: true,
    };
  }

  return {
    type: "unknown",
    message: i18next.t("ai.errors.unknown.message", { message: originalMessage }),
    suggestion: i18next.t("ai.errors.unknown.suggestion"),
    retryable: true,
  };
}

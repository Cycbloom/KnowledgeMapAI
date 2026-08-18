import i18next from "i18next";

import {
  ErrorCodes as SharedErrorCodes,
  ErrorCodeMessageKeys as SharedErrorCodeMessageKeys,
  type ErrorCode as SharedErrorCode,
} from "../../shared/types/errorCodes";

import {
  AppErrorBase,
  type ErrorContext,
  type ErrorSerialization,
} from "@shared/types/appError";

export { SharedErrorCodes, SharedErrorCodeMessageKeys };
export type { SharedErrorCode };
// Re-export ErrorContext from shared for consumers of this module
export type { ErrorContext };

export type FrontendErrorCode =
  | "NETWORK_ERROR"
  | "CANCELLED_ERROR"
  | "UNKNOWN_ERROR";

export type ErrorCode = SharedErrorCode | FrontendErrorCode;

export const FrontendErrorCodes = {
  NETWORK_ERROR: "NETWORK_ERROR",
  CANCELLED_ERROR: "CANCELLED_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export class AppError extends AppErrorBase {
  declare readonly code: ErrorCode;

  constructor(
    message: string,
    code: ErrorCode = "UNKNOWN_ERROR",
    statusCode: number = 500,
    context?: ErrorContext,
    isOperational: boolean = true,
  ) {
    super(message, code, statusCode, context, isOperational);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): ErrorSerialization {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.context && Object.keys(this.context).length > 0 && { context: this.context }),
      timestamp: this.timestamp.toISOString(),
    };
  }

  static fromJSON(data: ErrorSerialization & { isOperational?: boolean }): AppError {
    return new AppError(
      data.message,
      data.code as ErrorCode,
      data.statusCode,
      data.context,
      data.isOperational ?? true,
    );
  }
}

export class NetworkError extends AppError {
  constructor(
    message: string = i18next.t("common.errors.networkError"),
    context?: ErrorContext,
  ) {
    super(message, "NETWORK_ERROR", 0, context);
    this.name = "NetworkError";
  }
}

export class AuthError extends AppError {
  constructor(
    message: string = i18next.t("common.errors.authError"),
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AUTH_UNAUTHORIZED, 401, context);
    this.name = "AuthError";
  }
}

export class TokenExpiredError extends AppError {
  constructor(
    message: string = i18next.t("common.errors.tokenExpiredError"),
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AUTH_TOKEN_EXPIRED, 401, context);
    this.name = "TokenExpiredError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = i18next.t("common.errors.forbiddenError"), context?: ErrorContext) {
    super(message, SharedErrorCodes.AUTH_FORBIDDEN, 403, context);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = i18next.t("common.errors.notFoundError"), context?: ErrorContext) {
    super(message, SharedErrorCodes.RESOURCE_NOT_FOUND, 404, context);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string = i18next.t("common.errors.validationError"),
    details?: Array<{ field: string; message: string }>,
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.VALIDATION_ERROR, 400, context);
    this.name = "ValidationError";
    this.details = details;
  }

  override toJSON(): ErrorSerialization & { details?: Array<{ field: string; message: string }> } {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

export class ServerError extends AppError {
  constructor(
    message: string = i18next.t("common.errors.serverError"),
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500, context);
    this.name = "ServerError";
  }
}

export class TimeoutError extends AppError {
  constructor(
    message: string = i18next.t("common.errors.timeoutError"),
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AI_TIMEOUT, 408, context);
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = i18next.t("common.errors.rateLimitError"),
    retryAfter?: number,
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AI_RATE_LIMIT_EXCEEDED, 429, context);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }

  override toJSON(): ErrorSerialization & { retryAfter?: number } {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

export class CancelledError extends AppError {
  constructor(message: string = i18next.t("common.errors.cancelledError"), context?: ErrorContext) {
    super(message, "CANCELLED_ERROR", 0, context);
    this.name = "CancelledError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  if (error instanceof NetworkError) {
    return true;
  }
  return isAppError(error) && error.code === FrontendErrorCodes.NETWORK_ERROR;
}

export function isAuthError(
  error: unknown,
): error is AuthError | TokenExpiredError {
  if (error instanceof AuthError || error instanceof TokenExpiredError) {
    return true;
  }
  if (isAppError(error)) {
    const authCodes: readonly SharedErrorCode[] = [
      SharedErrorCodes.AUTH_UNAUTHORIZED,
      SharedErrorCodes.AUTH_TOKEN_EXPIRED,
      SharedErrorCodes.AUTH_TOKEN_INVALID,
      SharedErrorCodes.AUTH_TOKEN_REVOKED,
      SharedErrorCodes.AUTH_HEADER_MISSING,
      SharedErrorCodes.AUTH_TOKEN_MISSING,
      SharedErrorCodes.AUTH_FORBIDDEN,
    ];
    return authCodes.includes(error.code as SharedErrorCode);
  }
  return false;
}

// 预构建 Set 消除按 code 的线性查找（isValidationError 内不再每次构建数组扫描）
const VALIDATION_CODES_SET = new Set<SharedErrorCode>([
  SharedErrorCodes.VALIDATION_ERROR,
  SharedErrorCodes.VALIDATION_INVALID_JSON,
  SharedErrorCodes.VALIDATION_INVALID_PARAMS,
  SharedErrorCodes.VALIDATION_MISSING_FIELD,
  SharedErrorCodes.VALIDATION_INVALID_FORMAT,
]);

export function isValidationError(error: unknown): error is ValidationError {
  if (error instanceof ValidationError) {
    return true;
  }
  if (isAppError(error)) {
    return VALIDATION_CODES_SET.has(error.code as SharedErrorCode);
  }
  return false;
}

/** 可重试的 HTTP 状态码 */
const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return i18next.t("common.errors.unknownError");
}

/**
 * 判断错误是否可重试。
 * 合并了 retryFetch.ts（HTTP 状态码 + 网络错误）和 shared/utils/retry.ts（消息关键词）的逻辑。
 */
export function isRetryableError(error: unknown): boolean {
  // 1. AppError：根据 statusCode 判断
  if (isAppError(error)) {
    return RETRYABLE_STATUS_CODES.has(error.statusCode);
  }
  // 2. ApiError：根据 status 判断
  if (isApiError(error)) {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }
  // 3. 普通 Error：根据消息关键词和网络特征判断
  if (error instanceof Error) {
    // AbortError（超时中断）
    if (error.name === "AbortError") {
      return true;
    }
    const msg = error.message.toLowerCase();
    // 网络类错误
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("network") ||
      msg.includes("econnreset") ||
      msg.includes("enotfound") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("eai_again")
    ) {
      return true;
    }
    // 超时
    if (msg.includes("timeout")) {
      return true;
    }
    // 限流 / 5xx（消息中包含状态码）
    if (
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503")
    ) {
      return true;
    }
    // 带有 status 属性的 fetch 错误
    const fetchError = error as Error & { status?: number };
    if (fetchError.status !== undefined) {
      return RETRYABLE_STATUS_CODES.has(fetchError.status);
    }
  }
  return false;
}

export function getErrorCode(error: unknown): ErrorCode {
  if (isAppError(error)) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

export const FrontendErrorCodeMessages: Record<FrontendErrorCode, string> = {
  NETWORK_ERROR: "common.errors.networkConnectionFailed",
  CANCELLED_ERROR: "common.errors.cancelledError",
  UNKNOWN_ERROR: "common.errors.operationFailed",
};

export const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  ...SharedErrorCodeMessageKeys,
  ...FrontendErrorCodeMessages,
};

export function getUserFriendlyMessage(error: unknown): string {
  const code = getErrorCode(error);
  const messageKey = USER_FRIENDLY_MESSAGES[code];
  const friendlyMessage = i18next.t(messageKey as never) as string;
  if (isAppError(error) && error.message !== friendlyMessage) {
    return error.message;
  }
  return friendlyMessage;
}

export function createErrorFromResponse(response: {
  status: number;
  statusText: string;
  data?: {
    message?: string;
    error?: string;
    code?: string;
    details?: Array<{ field: string; message: string }>;
  };
}): AppError {
  const { status, statusText, data } = response;
  const message = data?.message || data?.error || statusText || i18next.t("common.errors.requestFailed");

  switch (status) {
    case 0:
      return new NetworkError(message);
    case 400:
      return new ValidationError(message, data?.details);
    case 401: {
      // 根据后端返回的 code 字段区分鉴权错误类型
      // 仅 AUTH_TOKEN_EXPIRED 是可恢复的（通过 refresh token 续期）
      const code = data?.code;
      if (code === SharedErrorCodes.AUTH_TOKEN_EXPIRED) {
        return new TokenExpiredError(message);
      }
      // 其他鉴权错误（INVALID/REVOKED/HEADER_MISSING/TOKEN_MISSING/UNAUTHORIZED）
      // 都是不可恢复的，使用实际的 code 创建 AuthError
      return new AppError(message, (code as ErrorCode) ?? SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
    }
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 408:
      return new TimeoutError(message);
    case 429:
      return new RateLimitError(message);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message);
    default:
      return new AppError(message, (data?.code as ErrorCode) ?? "UNKNOWN_ERROR", status);
  }
}

export function wrapUnknownError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("failed to fetch") ||
      error.name === "TypeError"
    ) {
      return new NetworkError(error.message);
    }

    if (message.includes("timeout") || error.name === "AbortError") {
      return new TimeoutError(error.message);
    }

    return new AppError(error.message, "UNKNOWN_ERROR", 500);
  }

  if (typeof error === "string") {
    return new AppError(error, "UNKNOWN_ERROR", 500);
  }

  return new AppError(i18next.t("common.errors.unknownError"), "UNKNOWN_ERROR", 500);
}

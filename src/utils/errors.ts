import {
  ErrorCodes as SharedErrorCodes,
  ErrorCodeMessages as SharedErrorCodeMessages,
} from "../../shared/types/errorCodes";

import type { ErrorCode as SharedErrorCode } from "../../shared/types/errorCodes";

export { SharedErrorCodes, SharedErrorCodeMessages };
export type { SharedErrorCode };

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

export interface ErrorContext {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = "UNKNOWN_ERROR",
    statusCode: number = 500,
    context?: ErrorContext,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      isOperational: this.isOperational,
    };
  }

  static fromJSON(data: ReturnType<AppError["toJSON"]>): AppError {
    const error = new AppError(
      data.message,
      data.code,
      data.statusCode,
      data.context,
      data.isOperational,
    );
    return error;
  }
}

export class NetworkError extends AppError {
  constructor(
    message: string = "网络错误，请检查网络连接",
    context?: ErrorContext,
  ) {
    super(message, "NETWORK_ERROR", 0, context);
    this.name = "NetworkError";
  }
}

export class AuthError extends AppError {
  constructor(
    message: string = "认证失败，请重新登录",
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AUTH_UNAUTHORIZED, 401, context);
    this.name = "AuthError";
  }
}

export class TokenExpiredError extends AppError {
  constructor(
    message: string = "登录已过期，请重新登录",
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AUTH_TOKEN_EXPIRED, 401, context);
    this.name = "TokenExpiredError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "没有权限执行此操作", context?: ErrorContext) {
    super(message, SharedErrorCodes.AUTH_FORBIDDEN, 403, context);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "请求的资源不存在", context?: ErrorContext) {
    super(message, SharedErrorCodes.RESOURCE_NOT_FOUND, 404, context);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string = "输入数据格式不正确",
    details?: Array<{ field: string; message: string }>,
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.VALIDATION_ERROR, 400, context);
    this.name = "ValidationError";
    this.details = details;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

export class ServerError extends AppError {
  constructor(
    message: string = "服务器错误，请稍后重试",
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500, context);
    this.name = "ServerError";
  }
}

export class TimeoutError extends AppError {
  constructor(
    message: string = "请求超时，请稍后重试",
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AI_TIMEOUT, 408, context);
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = "请求过于频繁，请稍后重试",
    retryAfter?: number,
    context?: ErrorContext,
  ) {
    super(message, SharedErrorCodes.AI_RATE_LIMIT_EXCEEDED, 429, context);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

export class CancelledError extends AppError {
  constructor(message: string = "请求已取消", context?: ErrorContext) {
    super(message, "CANCELLED_ERROR", 0, context);
    this.name = "CancelledError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
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

export function isValidationError(error: unknown): error is ValidationError {
  if (error instanceof ValidationError) {
    return true;
  }
  if (isAppError(error)) {
    const validationCodes: readonly SharedErrorCode[] = [
      SharedErrorCodes.VALIDATION_ERROR,
      SharedErrorCodes.VALIDATION_INVALID_JSON,
      SharedErrorCodes.VALIDATION_INVALID_PARAMS,
      SharedErrorCodes.VALIDATION_MISSING_FIELD,
      SharedErrorCodes.VALIDATION_INVALID_FORMAT,
    ];
    return validationCodes.includes(error.code as SharedErrorCode);
  }
  return false;
}

/** 可重试的 HTTP 状态码 */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504] as const;

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
  return "未知错误";
}

/**
 * 判断错误是否可重试。
 * 合并了 retryFetch.ts（HTTP 状态码 + 网络错误）和 shared/utils/retry.ts（消息关键词）的逻辑。
 */
export function isRetryableError(error: unknown): boolean {
  // 1. AppError：根据 statusCode 判断
  if (isAppError(error)) {
    return (RETRYABLE_STATUS_CODES as readonly number[]).includes(error.statusCode);
  }
  // 2. ApiError：根据 status 判断
  if (isApiError(error)) {
    return (RETRYABLE_STATUS_CODES as readonly number[]).includes(error.status);
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
      return (RETRYABLE_STATUS_CODES as readonly number[]).includes(fetchError.status);
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
  NETWORK_ERROR: "网络连接失败，请检查网络设置",
  CANCELLED_ERROR: "请求已取消",
  UNKNOWN_ERROR: "操作失败，请稍后重试",
};

export const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  ...SharedErrorCodeMessages,
  ...FrontendErrorCodeMessages,
};

export function getUserFriendlyMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (isAppError(error) && error.message !== USER_FRIENDLY_MESSAGES[code]) {
    return error.message;
  }
  return USER_FRIENDLY_MESSAGES[code];
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
  const message = data?.message || data?.error || statusText || "请求失败";

  switch (status) {
    case 0:
      return new NetworkError(message);
    case 400:
      return new ValidationError(message, data?.details);
    case 401:
      return new TokenExpiredError(message);
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
      return new AppError(message, "UNKNOWN_ERROR", status);
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

  return new AppError("未知错误", "UNKNOWN_ERROR", 500);
}

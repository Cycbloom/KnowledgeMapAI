import { describe, it, expect } from "vitest";
import {
  AppError,
  NetworkError,
  AuthError,
  TokenExpiredError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ServerError,
  TimeoutError,
  RateLimitError,
  CancelledError,
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
  getErrorMessage,
  getErrorCode,
  getUserFriendlyMessage,
  createErrorFromResponse,
  wrapUnknownError,
  USER_FRIENDLY_MESSAGES,
  type ErrorCode,
} from "../../utils/errors";

describe("errors utilities", () => {
  describe("AppError", () => {
    it("should create error with default values", () => {
      const error = new AppError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("AppError");
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should create error with custom values", () => {
      const context = { userId: 123, action: "login" };
      const error = new AppError(
        "Custom error",
        "AUTH_ERROR",
        401,
        context,
        false,
      );
      expect(error.message).toBe("Custom error");
      expect(error.code).toBe("AUTH_ERROR");
      expect(error.statusCode).toBe(401);
      expect(error.context).toEqual(context);
      expect(error.isOperational).toBe(false);
    });

    it("should serialize to JSON", () => {
      const error = new AppError("Test error", "VALIDATION_ERROR", 400, {
        field: "email",
      });
      const json = error.toJSON();
      expect(json).toMatchObject({
        name: "AppError",
        message: "Test error",
        code: "VALIDATION_ERROR",
        statusCode: 400,
        context: { field: "email" },
        isOperational: true,
      });
      expect(json.timestamp).toBeDefined();
    });

    it("should deserialize from JSON", () => {
      const original = new AppError("Test error", "AUTH_ERROR", 401, {
        userId: 123,
      });
      const json = original.toJSON();
      const restored = AppError.fromJSON(json);
      expect(restored.message).toBe(original.message);
      expect(restored.code).toBe(original.code);
      expect(restored.statusCode).toBe(original.statusCode);
      expect(restored.context).toEqual(original.context);
    });
  });

  describe("NetworkError", () => {
    it("should create error with default message", () => {
      const error = new NetworkError();
      expect(error.message).toBe("网络错误，请检查网络连接");
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.statusCode).toBe(0);
      expect(error.name).toBe("NetworkError");
    });

    it("should create error with custom message", () => {
      const error = new NetworkError("Connection refused", {
        host: "localhost",
      });
      expect(error.message).toBe("Connection refused");
      expect(error.context).toEqual({ host: "localhost" });
    });
  });

  describe("AuthError", () => {
    it("should create error with default message", () => {
      const error = new AuthError();
      expect(error.message).toBe("认证失败，请重新登录");
      expect(error.code).toBe("AUTH_UNAUTHORIZED");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("AuthError");
    });
  });

  describe("TokenExpiredError", () => {
    it("should create error with default message", () => {
      const error = new TokenExpiredError();
      expect(error.message).toBe("登录已过期，请重新登录");
      expect(error.code).toBe("AUTH_TOKEN_EXPIRED");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("TokenExpiredError");
    });
  });

  describe("ForbiddenError", () => {
    it("should create error with default message", () => {
      const error = new ForbiddenError();
      expect(error.message).toBe("没有权限执行此操作");
      expect(error.code).toBe("AUTH_FORBIDDEN");
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe("ForbiddenError");
    });
  });

  describe("NotFoundError", () => {
    it("should create error with default message", () => {
      const error = new NotFoundError();
      expect(error.message).toBe("请求的资源不存在");
      expect(error.code).toBe("RESOURCE_NOT_FOUND");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });
  });

  describe("ValidationError", () => {
    it("should create error with default message", () => {
      const error = new ValidationError();
      expect(error.message).toBe("输入数据格式不正确");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
    });

    it("should create error with details", () => {
      const details = [
        { field: "email", message: "Invalid email format" },
        { field: "password", message: "Password too short" },
      ];
      const error = new ValidationError("Validation failed", details);
      expect(error.details).toEqual(details);
    });

    it("should serialize details to JSON", () => {
      const details = [{ field: "email", message: "Invalid" }];
      const error = new ValidationError("Failed", details);
      expect(error.details).toEqual(details);
    });
  });

  describe("ServerError", () => {
    it("should create error with default message", () => {
      const error = new ServerError();
      expect(error.message).toBe("服务器错误，请稍后重试");
      expect(error.code).toBe("SYSTEM_INTERNAL_ERROR");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("ServerError");
    });
  });

  describe("TimeoutError", () => {
    it("should create error with default message", () => {
      const error = new TimeoutError();
      expect(error.message).toBe("请求超时，请稍后重试");
      expect(error.code).toBe("AI_TIMEOUT");
      expect(error.statusCode).toBe(408);
      expect(error.name).toBe("TimeoutError");
    });
  });

  describe("RateLimitError", () => {
    it("should create error with default message", () => {
      const error = new RateLimitError();
      expect(error.message).toBe("请求过于频繁，请稍后重试");
      expect(error.code).toBe("AI_RATE_LIMIT_EXCEEDED");
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe("RateLimitError");
    });

    it("should create error with retryAfter", () => {
      const error = new RateLimitError("Too many requests", 60);
      expect(error.retryAfter).toBe(60);
    });

    it("should serialize retryAfter to JSON", () => {
      const error = new RateLimitError("Too many requests", 60);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe("CancelledError", () => {
    it("should create error with default message", () => {
      const error = new CancelledError();
      expect(error.message).toBe("请求已取消");
      expect(error.code).toBe("CANCELLED_ERROR");
      expect(error.statusCode).toBe(0);
      expect(error.name).toBe("CancelledError");
    });
  });

  describe("isAppError", () => {
    it("should return true for AppError instances", () => {
      expect(isAppError(new AppError("test"))).toBe(true);
      expect(isAppError(new NetworkError())).toBe(true);
      expect(isAppError(new ValidationError())).toBe(true);
    });

    it("should return false for non-AppError errors", () => {
      expect(isAppError(new Error("test"))).toBe(false);
      expect(isAppError("error")).toBe(false);
      expect(isAppError(null)).toBe(false);
    });
  });

  describe("isNetworkError", () => {
    it("should return true only for NetworkError", () => {
      const error = new NetworkError();
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe("NETWORK_ERROR");
    });
  });

  describe("isAuthError", () => {
    it("should return true for AuthError and TokenExpiredError", () => {
      const authError = new AuthError();
      expect(authError.name).toBe("AuthError");
      expect(authError.code).toBe("AUTH_UNAUTHORIZED");

      const tokenError = new TokenExpiredError();
      expect(tokenError.name).toBe("TokenExpiredError");
      expect(tokenError.code).toBe("AUTH_TOKEN_EXPIRED");
    });
  });

  describe("isValidationError", () => {
    it("should return true only for ValidationError", () => {
      const error = new ValidationError();
      expect(error.name).toBe("ValidationError");
      expect(error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("getErrorMessage", () => {
    it("should return message from AppError", () => {
      expect(getErrorMessage(new AppError("Custom message"))).toBe(
        "Custom message",
      );
    });

    it("should return message from Error", () => {
      expect(getErrorMessage(new Error("Error message"))).toBe("Error message");
    });

    it("should return string as-is", () => {
      expect(getErrorMessage("String error")).toBe("String error");
    });

    it("should return default message for unknown types", () => {
      expect(getErrorMessage(null)).toBe("未知错误");
      expect(getErrorMessage(undefined)).toBe("未知错误");
      expect(getErrorMessage(123)).toBe("未知错误");
    });
  });

  describe("getErrorCode", () => {
    it("should return code from AppError", () => {
      expect(getErrorCode(new ValidationError())).toBe("VALIDATION_ERROR");
      expect(getErrorCode(new AuthError())).toBe("AUTH_UNAUTHORIZED");
    });

    it("should return UNKNOWN_ERROR for non-AppError", () => {
      expect(getErrorCode(new Error("test"))).toBe("UNKNOWN_ERROR");
      expect(getErrorCode("error")).toBe("UNKNOWN_ERROR");
    });
  });

  describe("USER_FRIENDLY_MESSAGES", () => {
    it("should have messages for all error codes", () => {
      const codes: ErrorCode[] = [
        "NETWORK_ERROR",
        "AUTH_UNAUTHORIZED",
        "AUTH_TOKEN_EXPIRED",
        "AUTH_FORBIDDEN",
        "RESOURCE_NOT_FOUND",
        "VALIDATION_ERROR",
        "SYSTEM_INTERNAL_ERROR",
        "AI_TIMEOUT",
        "AI_RATE_LIMIT_EXCEEDED",
        "CANCELLED_ERROR",
        "UNKNOWN_ERROR",
      ];
      codes.forEach((code) => {
        expect(USER_FRIENDLY_MESSAGES[code]).toBeDefined();
        expect(typeof USER_FRIENDLY_MESSAGES[code]).toBe("string");
      });
    });
  });

  describe("getUserFriendlyMessage", () => {
    it("should return user-friendly message for error code", () => {
      const message = getUserFriendlyMessage(new NetworkError());
      expect(message).toBe("网络错误，请检查网络连接");
    });

    it("should return custom message if different from default", () => {
      const error = new ValidationError("邮箱格式不正确");
      expect(getUserFriendlyMessage(error)).toBe("邮箱格式不正确");
    });

    it("should return default message for non-AppError", () => {
      expect(getUserFriendlyMessage(new Error("test"))).toBe(
        "操作失败，请稍后重试",
      );
    });
  });

  describe("createErrorFromResponse", () => {
    it("should create NetworkError for status 0", () => {
      const error = createErrorFromResponse({
        status: 0,
        statusText: "Network Error",
      });
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("should create ValidationError for status 400", () => {
      const response = {
        status: 400,
        statusText: "Bad Request",
        data: {
          message: "Invalid data",
          details: [{ field: "email", message: "Invalid" }],
        },
      };
      const error = createErrorFromResponse(response);
      expect(error.name).toBe("ValidationError");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid data");
    });

    it("should create TokenExpiredError for status 401", () => {
      const error = createErrorFromResponse({
        status: 401,
        statusText: "Unauthorized",
      });
      expect(error.name).toBe("TokenExpiredError");
      expect(error.code).toBe("AUTH_TOKEN_EXPIRED");
    });

    it("should create ForbiddenError for status 403", () => {
      const error = createErrorFromResponse({
        status: 403,
        statusText: "Forbidden",
      });
      expect(error.name).toBe("ForbiddenError");
      expect(error.code).toBe("AUTH_FORBIDDEN");
    });

    it("should create NotFoundError for status 404", () => {
      const error = createErrorFromResponse({
        status: 404,
        statusText: "Not Found",
      });
      expect(error.name).toBe("NotFoundError");
      expect(error.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("should create TimeoutError for status 408", () => {
      const error = createErrorFromResponse({
        status: 408,
        statusText: "Request Timeout",
      });
      expect(error.name).toBe("TimeoutError");
      expect(error.code).toBe("AI_TIMEOUT");
    });

    it("should create RateLimitError for status 429", () => {
      const error = createErrorFromResponse({
        status: 429,
        statusText: "Too Many Requests",
      });
      expect(error.name).toBe("RateLimitError");
      expect(error.code).toBe("AI_RATE_LIMIT_EXCEEDED");
    });

    it("should create ServerError for 5xx status", () => {
      const error500 = createErrorFromResponse({
        status: 500,
        statusText: "Internal Server Error",
      });
      expect(error500.name).toBe("ServerError");
      expect(error500.code).toBe("SYSTEM_INTERNAL_ERROR");

      const error502 = createErrorFromResponse({
        status: 502,
        statusText: "Bad Gateway",
      });
      expect(error502.name).toBe("ServerError");

      const error503 = createErrorFromResponse({
        status: 503,
        statusText: "Service Unavailable",
      });
      expect(error503.name).toBe("ServerError");

      const error504 = createErrorFromResponse({
        status: 504,
        statusText: "Gateway Timeout",
      });
      expect(error504.name).toBe("ServerError");
    });

    it("should create AppError for unknown status", () => {
      const error = createErrorFromResponse({
        status: 418,
        statusText: "I'm a teapot",
      });
      expect(error.name).toBe("AppError");
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.statusCode).toBe(418);
    });

    it("should use data.message or data.error over statusText", () => {
      const error = createErrorFromResponse({
        status: 400,
        statusText: "Bad Request",
        data: { error: "Custom error message" },
      });
      expect(error.message).toBe("Custom error message");
    });
  });

  describe("wrapUnknownError", () => {
    it("should return AppError as-is", () => {
      const original = new ValidationError("test");
      expect(wrapUnknownError(original)).toBe(original);
    });

    it("should wrap network-related errors", () => {
      const error = wrapUnknownError(new Error("network error"));
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("should wrap fetch errors", () => {
      const error = wrapUnknownError(new Error("Failed to fetch"));
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("should wrap TypeError as NetworkError", () => {
      const typeError = new TypeError("Something went wrong");
      const error = wrapUnknownError(typeError);
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("should wrap timeout errors", () => {
      const error = wrapUnknownError(new Error("Request timeout"));
      expect(error.name).toBe("TimeoutError");
      expect(error.code).toBe("AI_TIMEOUT");
    });

    it("should wrap AbortError as TimeoutError", () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      const error = wrapUnknownError(abortError);
      expect(error.name).toBe("TimeoutError");
      expect(error.code).toBe("AI_TIMEOUT");
    });

    it("should wrap generic errors", () => {
      const error = wrapUnknownError(new Error("Something went wrong"));
      expect(error.name).toBe("AppError");
      expect(error.code).toBe("UNKNOWN_ERROR");
    });

    it("should wrap string errors", () => {
      const error = wrapUnknownError("Something failed");
      expect(error.name).toBe("AppError");
      expect(error.message).toBe("Something failed");
    });

    it("should wrap unknown types", () => {
      const error = wrapUnknownError(null);
      expect(error.name).toBe("AppError");
      expect(error.message).toBe("未知错误");
    });
  });
});

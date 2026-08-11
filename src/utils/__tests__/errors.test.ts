import { describe, it, expect } from "vitest";

import {
  AppError,
  NetworkError,
  AuthError,
  TokenExpiredError,
  ForbiddenError,
  ValidationError,
  ApiError,
  SharedErrorCodes,
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
  isApiError,
  getErrorMessage,
} from "../errors";

describe("isAppError", () => {
  it("对 AppError 实例返回 true", () => {
    expect(isAppError(new AppError("boom"))).toBe(true);
  });

  it("对 AppError 子类实例返回 true", () => {
    expect(isAppError(new NetworkError("network"))).toBe(true);
    expect(isAppError(new ValidationError("invalid"))).toBe(true);
  });

  it("对普通的 Error 返回 false", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("对 ApiError 返回 false", () => {
    expect(isAppError(new ApiError("api", 500))).toBe(false);
  });

  it("对 null / 普通对象返回 false", () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ message: "x" })).toBe(false);
  });
});

describe("isNetworkError", () => {
  // 已修复：isNetworkError 增加基于 code 的兜底判断，
  // 即使 AppError 构造函数的 Object.setPrototypeOf 移除了子类 prototype，
  // 也能通过 NETWORK_ERROR code 正确识别 NetworkError。
  it("对 NetworkError 实例返回 true", () => {
    expect(isNetworkError(new NetworkError("offline"))).toBe(true);
  });

  it("对 code 为 NETWORK_ERROR 的 AppError 返回 true", () => {
    expect(isNetworkError(new AppError("net", "NETWORK_ERROR"))).toBe(true);
  });

  it("对普通 AppError 返回 false", () => {
    expect(isNetworkError(new AppError("boom"))).toBe(false);
  });

  it("对 ApiError / Error / null 返回 false", () => {
    expect(isNetworkError(new ApiError("api", 0))).toBe(false);
    expect(isNetworkError(new Error("plain"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("isAuthError", () => {
  it("对 AuthError / TokenExpiredError 实例返回 true", () => {
    expect(isAuthError(new AuthError("unauthorized"))).toBe(true);
    expect(isAuthError(new TokenExpiredError("expired"))).toBe(true);
  });

  it("对 code 属于 auth 集合的 AppError 返回 true（含 ForbiddenError）", () => {
    expect(isAuthError(new ForbiddenError("forbidden"))).toBe(true);
    expect(
      isAuthError(new AppError("t", SharedErrorCodes.AUTH_UNAUTHORIZED)),
    ).toBe(true);
    expect(
      isAuthError(new AppError("t", SharedErrorCodes.AUTH_TOKEN_INVALID)),
    ).toBe(true);
    expect(
      isAuthError(new AppError("t", SharedErrorCodes.AUTH_TOKEN_REVOKED)),
    ).toBe(true);
    expect(
      isAuthError(new AppError("t", SharedErrorCodes.AUTH_HEADER_MISSING)),
    ).toBe(true);
    expect(
      isAuthError(new AppError("t", SharedErrorCodes.AUTH_TOKEN_MISSING)),
    ).toBe(true);
    expect(
      isAuthError(new AppError("t", SharedErrorCodes.AUTH_FORBIDDEN)),
    ).toBe(true);
  });

  it("对 code 不属于 auth 集合的 AppError 返回 false", () => {
    expect(
      isAuthError(new AppError("v", SharedErrorCodes.VALIDATION_ERROR)),
    ).toBe(false);
    expect(isAuthError(new NetworkError("network"))).toBe(false);
  });

  it("对 ApiError / Error / null / 普通对象 返回 false", () => {
    expect(isAuthError(new ApiError("api", 401))).toBe(false);
    expect(isAuthError(new Error("plain"))).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError({})).toBe(false);
  });
});

describe("isValidationError", () => {
  it("对 ValidationError 实例返回 true", () => {
    expect(isValidationError(new ValidationError("invalid"))).toBe(true);
  });

  it("对 code 属于 validation 集合的 AppError 返回 true", () => {
    expect(
      isValidationError(
        new AppError("v", SharedErrorCodes.VALIDATION_ERROR),
      ),
    ).toBe(true);
    expect(
      isValidationError(
        new AppError("v", SharedErrorCodes.VALIDATION_INVALID_JSON),
      ),
    ).toBe(true);
    expect(
      isValidationError(
        new AppError("v", SharedErrorCodes.VALIDATION_INVALID_PARAMS),
      ),
    ).toBe(true);
    expect(
      isValidationError(
        new AppError("v", SharedErrorCodes.VALIDATION_MISSING_FIELD),
      ),
    ).toBe(true);
    expect(
      isValidationError(
        new AppError("v", SharedErrorCodes.VALIDATION_INVALID_FORMAT),
      ),
    ).toBe(true);
  });

  it("对 code 不属于 validation 集合的 AppError 返回 false", () => {
    expect(
      isValidationError(new AppError("a", SharedErrorCodes.AUTH_UNAUTHORIZED)),
    ).toBe(false);
    expect(isValidationError(new NetworkError("network"))).toBe(false);
  });

  it("对 ApiError / Error / null / 普通对象 返回 false", () => {
    expect(isValidationError(new ApiError("api", 400))).toBe(false);
    expect(isValidationError(new Error("plain"))).toBe(false);
    expect(isValidationError(null)).toBe(false);
    expect(isValidationError({})).toBe(false);
  });
});

describe("isApiError", () => {
  it("对 ApiError 实例返回 true", () => {
    expect(isApiError(new ApiError("api", 500))).toBe(true);
    expect(isApiError(new ApiError("api", 404, "NOT_FOUND"))).toBe(true);
  });

  it("对 AppError / Error / null / 普通对象 返回 false", () => {
    expect(isApiError(new AppError("boom"))).toBe(false);
    expect(isApiError(new Error("plain"))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError({ status: 500 })).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("对 AppError 返回其 message", () => {
    expect(getErrorMessage(new AppError("自定义错误"))).toBe("自定义错误");
  });

  it("对 AppError 子类返回其 message", () => {
    expect(getErrorMessage(new NetworkError("网络错误"))).toBe("网络错误");
  });

  it("对 ApiError 返回其 message", () => {
    expect(getErrorMessage(new ApiError("api 错误", 500))).toBe("api 错误");
  });

  it("对普通 Error 返回其 message", () => {
    expect(getErrorMessage(new Error("普通错误"))).toBe("普通错误");
  });

  it("对字符串输入原样返回", () => {
    expect(getErrorMessage("字符串错误")).toBe("字符串错误");
  });

  it("对未知输入返回兜底值", () => {
    expect(getErrorMessage(null)).toBe("未知错误");
    expect(getErrorMessage(undefined)).toBe("未知错误");
    expect(getErrorMessage({})).toBe("未知错误");
    expect(getErrorMessage(42)).toBe("未知错误");
  });
});
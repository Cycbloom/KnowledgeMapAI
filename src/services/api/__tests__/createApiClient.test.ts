// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
// --- Mocks ---

// vi.mock is hoisted above all other code. Use vi.hoisted to create shared references.
const mockRef = vi.hoisted(() => {
  let requestInterceptor: (...args: unknown[]) => unknown = () => {};
  let responseSuccessInterceptor: (...args: unknown[]) => unknown = () => {};
  let responseErrorInterceptor: (...args: unknown[]) => unknown = () => {};

  const mockAxiosInstance = {
    defaults: { baseURL: "/api/v1" },
    interceptors: {
      request: {
        use: vi.fn((fn: (...args: unknown[]) => unknown) => {
          requestInterceptor = fn;
        }),
      },
      response: {
        use: vi.fn((successFn: (...args: unknown[]) => unknown, errorFn: (...args: unknown[]) => unknown) => {
          responseSuccessInterceptor = successFn;
          responseErrorInterceptor = errorFn;
        }),
      },
    },
    get: vi.fn(() => new Promise<unknown>(() => {})),
  };

  return { mockAxiosInstance, requestInterceptor, responseSuccessInterceptor, responseErrorInterceptor };
});

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockRef.mockAxiosInstance),
    getAdapter: vi.fn(),
    defaults: { adapter: undefined },
  },
}));

vi.mock("../../../store/useStore", () => ({
  useStore: { getState: vi.fn(() => ({ token: "test-token" })) },
}));

vi.mock("../../../utils/errors", () => ({
  createErrorFromResponse: vi.fn(() => {
    const err = new Error("mock error") as Error & { statusCode: number };
    err.statusCode = 500;
    return err;
  }),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(msg?: string) { super(msg || "Token expired"); this.name = "TokenExpiredError"; }
  },
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(msg: string, code?: string, statusCode?: number) {
      super(msg); this.name = "AppError"; this.code = code || "UNKNOWN_ERROR"; this.statusCode = statusCode || 500;
    }
  },
  SharedErrorCodes: {
    AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
    AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
    AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
    AUTH_TOKEN_REVOKED: "AUTH_TOKEN_REVOKED",
  },
}));

vi.mock("../../../config/mobileApiConfig", () => ({
  isCapacitorMobile: vi.fn(() => false),
  getMobileApiBaseUrl: vi.fn(() => "/api"),
}));

vi.mock("../../../config/electronConfig", () => ({
  isElectronProduction: vi.fn(() => false),
  getElectronApiUrl: vi.fn(),
}));

vi.mock("./localClient", () => ({
  localQuery: vi.fn(),
  isCloudOnlyResource: vi.fn(() => false),
}));

vi.mock("../../../utils/errorReporter", () => ({
  captureException: vi.fn(),
}));

vi.mock("../../../utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./TokenRefreshManager", () => ({
  TokenRefreshManager: {
    getInstance: vi.fn(() => ({
      shouldRefreshToken: vi.fn(() => false),
      refreshAccessToken: vi.fn(),
    })),
  },
}));

const mockUUID = "test-uuid-12345";
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => mockUUID),
});

vi.stubGlobal("performance", {
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => [{ duration: 100 }]),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
});

// Silence console.warn calls from the response interceptor
vi.stubGlobal("console", {
  ...console,
  warn: vi.fn(),
});

// Prevent actual fetch calls from initCsrf
vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response())));

// --- Imports (must be after vi.mock declarations) ---

import { createApiClient } from "../createApiClient";
import { createErrorFromResponse } from "../../../utils/errors";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { useStore } from "../../../store/useStore";

// --- Helpers ---

const createMockConfig = (
  overrides: Partial<InternalAxiosRequestConfig> = {},
): InternalAxiosRequestConfig =>
  ({
    method: "get",
    url: "/test",
    headers: {},
    ...overrides,
  }) as InternalAxiosRequestConfig;

const createMockResponse = (overrides: Record<string, unknown> = {}) => ({
  data: { id: 1, name: "test" },
  status: 200,
  statusText: "OK",
  headers: {},
  config: {
    _inflightKey: undefined,
    _requestId: undefined,
    method: "get",
    url: "/test",
  },
  ...overrides,
});

// --- Tests ---

describe("createApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-capture interceptor handlers after clearAllMocks resets call history
    mockRef.mockAxiosInstance.interceptors.request.use.mockImplementation(
      (fn: (...args: unknown[]) => unknown) => {
        mockRef.requestInterceptor = fn;
      },
    );
    mockRef.mockAxiosInstance.interceptors.response.use.mockImplementation(
      (successFn: (...args: unknown[]) => unknown, errorFn: (...args: unknown[]) => unknown) => {
        mockRef.responseSuccessInterceptor = successFn;
        mockRef.responseErrorInterceptor = errorFn;
      },
    );
  });

  describe("创建客户端", () => {
    it("应该创建 axios 实例并设置 baseURL 和 withCredentials", () => {
      createApiClient();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: "/api/v1",
        withCredentials: true,
      });
    });
  });

  describe("请求拦截器", () => {
    it("应该添加 Authorization token", async () => {
      const config = createMockConfig();

      const result = await mockRef.requestInterceptor(config);

      expect(result.headers.Authorization).toBe("Bearer test-token");
    });

    it("应该添加请求 ID 和版本头", async () => {
      const config = createMockConfig();

      const result = await mockRef.requestInterceptor(config);

      expect(result.headers["X-Request-Id"]).toBe(mockUUID);
      expect(result.headers["X-Client-Version"]).toBe("1.0.1");
    });

    it("应该在无 token 时不添加 Authorization 头", async () => {
      (useStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({ token: null });
      const config = createMockConfig();

      const result = await mockRef.requestInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe("响应拦截器成功", () => {
    it("应该返回 response.data", () => {
      const response = createMockResponse();

      const result = mockRef.responseSuccessInterceptor(response);

      expect(result).toEqual({ id: 1, name: "test" });
    });

    it("应该清理 inflight 记录", () => {
      const response = createMockResponse({
        config: { _inflightKey: "get:/test:{}", _requestId: undefined },
      });

      const result = mockRef.responseSuccessInterceptor(response);

      expect(result).toEqual({ id: 1, name: "test" });
    });
  });

  describe("响应拦截器错误", () => {
    it("应该调用 createErrorFromResponse 并拒绝错误", async () => {
      const mockAppError = new Error("converted error");
      (createErrorFromResponse as ReturnType<typeof vi.fn>).mockReturnValue(
        mockAppError,
      );

      const error = {
        config: {
          _inflightKey: undefined,
          _requestId: undefined,
          headers: {},
          method: "get",
          url: "/test",
        },
        response: { status: 500, data: { message: "Server error" } },
        message: "Request failed",
        isAxiosError: true,
      };

      await expect(mockRef.responseErrorInterceptor(error)).rejects.toThrow(
        "converted error",
      );

      expect(createErrorFromResponse).toHaveBeenCalledWith({
        status: 500,
        statusText: "Request failed",
        data: { message: "Server error" },
      });
    });

    it("应该在没有 response 时使用默认值调用 createErrorFromResponse", async () => {
      const mockAppError = new Error("network error");
      (createErrorFromResponse as ReturnType<typeof vi.fn>).mockReturnValue(
        mockAppError,
      );

      const error = {
        config: {
          _inflightKey: undefined,
          _requestId: undefined,
          headers: {},
          method: "get",
          url: "/test",
        },
        response: undefined,
        message: "Network Error",
        isAxiosError: true,
      };

      await expect(mockRef.responseErrorInterceptor(error)).rejects.toThrow(
        "network error",
      );

      expect(createErrorFromResponse).toHaveBeenCalledWith({
        status: 0,
        statusText: "Network Error",
        data: undefined,
      });
    });
  });

  describe("GET 请求去重", () => {
    it("应该让相同的并发 GET 请求共享同一个 Promise", async () => {
      const client = createApiClient();

      const promise1 = client.get("/test");
      const promise2 = client.get("/test");

      // Both calls return the same promise reference (deduplication)
      expect(promise1).toBe(promise2);
    });

    it("应该对不同的 URL 分别发起请求", () => {
      const client = createApiClient();

      const promise1 = client.get("/test1");
      const promise2 = client.get("/test2");

      // Different URLs get different promises
      expect(promise1).not.toBe(promise2);
    });
  });
});
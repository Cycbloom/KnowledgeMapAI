// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createToastMutation } from "../mutationFactory";

const mocks = vi.hoisted(() => ({
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  mutationFn: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  invalidateQueries: vi.fn(),
}));

// Mock messageHelper — 隔离 FrontendEventBus / useFocusStore 等副作用
vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock react-i18next — t(key) 直接返回 key，便于断言传入的 i18n key
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

// Mock FrontendEventBus — mutationFactory 顶层 import，避免触发真实事件总线
vi.mock("../../../services/timer/FrontendEventBus", () => ({
  frontendEventBus: { publish: vi.fn() },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

interface TestData {
  id: string;
  count: number;
}

interface TestVariables {
  name: string;
}

describe("createToastMutation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Spy on invalidateQueries 以断言失效调用
    vi
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation(mocks.invalidateQueries);
    mocks.mutationFn.mockResolvedValue({ id: "result-1", count: 5 });
  });

  it("成功时应该用 successMessage 字符串作为 i18n key 显示 success toast", async () => {
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      successMessage: "common.saveSuccess",
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(mocks.messageSuccess).toHaveBeenCalledWith("common.saveSuccess");
    });
    expect(mocks.messageError).not.toHaveBeenCalled();
  });

  it("失败时应该用 errorMessage 字符串作为 i18n key 显示 error toast", async () => {
    mocks.mutationFn.mockRejectedValueOnce(new Error("network failed"));
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      errorMessage: "common.saveError",
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ name: "test" }),
    ).rejects.toThrow("network failed");

    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith("common.saveError");
    });
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
  });

  it("successMessage 为函数时应该用 data 调用并将返回值作为 i18n key", async () => {
    const successFn = vi.fn((data: TestData) =>
      data.count > 0 ? "import.success" : "import.empty",
    );
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      successMessage: successFn,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(successFn).toHaveBeenCalledWith({ id: "result-1", count: 5 });
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("import.success");
  });

  it("successMessage 函数基于 data 返回不同 key（空数据分支）", async () => {
    mocks.mutationFn.mockResolvedValueOnce({ id: "result-2", count: 0 });
    const successFn = vi.fn((data: TestData) =>
      data.count > 0 ? "import.success" : "import.empty",
    );
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      successMessage: successFn,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(mocks.messageSuccess).toHaveBeenCalledWith("import.empty");
    });
  });

  it("errorMessage 为函数时应该用 error 调用并将返回值作为 i18n key", async () => {
    const testError = new Error("validation failed");
    mocks.mutationFn.mockRejectedValueOnce(testError);
    const errorFn = vi.fn((error: Error) =>
      error.message.includes("validation") ? "error.validation" : "error.generic",
    );
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      errorMessage: errorFn,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ name: "test" }),
    ).rejects.toThrow("validation failed");

    await waitFor(() => {
      expect(errorFn).toHaveBeenCalledWith(testError);
    });
    expect(mocks.messageError).toHaveBeenCalledWith("error.validation");
  });

  it("未提供 successMessage 时不应调用 message.success", async () => {
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
  });

  it("未提供 errorMessage 时不应调用 message.error", async () => {
    mocks.mutationFn.mockRejectedValueOnce(new Error("fail"));
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ name: "test" }),
    ).rejects.toThrow("fail");

    await waitFor(() => {
      expect(mocks.messageError).not.toHaveBeenCalled();
    });
  });

  it("成功时应该对 invalidateQueries 中每个 key 调用 invalidateQueries", async () => {
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      invalidateQueries: [["graphs"], ["nodes"], ["user", "profile"]],
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledTimes(3);
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["graphs"],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["nodes"],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ["user", "profile"],
    });
  });

  it("未提供 invalidateQueries 时不应调用 invalidateQueries", async () => {
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it("成功时应该调用原始 onSuccess 回调（在 toast 与失效缓存之后）", async () => {
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      successMessage: "common.success",
      invalidateQueries: [["graphs"]],
      onSuccess: mocks.onSuccess,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(mocks.onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(mocks.onSuccess).toHaveBeenCalledWith(
      { id: "result-1", count: 5 },
      { name: "test" },
    );
    // toast 与失效缓存也应被调用
    expect(mocks.messageSuccess).toHaveBeenCalledWith("common.success");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["graphs"] });
  });

  it("失败时应该调用原始 onError 回调（在 toast 之后）", async () => {
    const testError = new Error("fail");
    mocks.mutationFn.mockRejectedValueOnce(testError);
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      errorMessage: "common.error",
      onError: mocks.onError,
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ name: "test" }),
    ).rejects.toThrow("fail");

    await waitFor(() => {
      expect(mocks.onError).toHaveBeenCalledTimes(1);
    });
    expect(mocks.onError).toHaveBeenCalledWith(testError, { name: "test" });
    expect(mocks.messageError).toHaveBeenCalledWith("common.error");
  });

  it("成功时 i18n key 应该经过 t() 翻译后再传给 message.success", async () => {
    // t(key) 返回 key 本身（见 mock），断言 message.success 收到的是 t() 的返回值
    const useMutation = createToastMutation<TestData, TestVariables>({
      mutationFn: mocks.mutationFn,
      successMessage: "graph.deleteSuccess",
    });
    const { result } = renderHook(() => useMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ name: "test" });

    await waitFor(() => {
      expect(mocks.messageSuccess).toHaveBeenCalledWith("graph.deleteSuccess");
    });
  });
});

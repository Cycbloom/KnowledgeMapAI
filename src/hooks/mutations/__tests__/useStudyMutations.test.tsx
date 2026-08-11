// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { StudyCard } from "@shared/types/common";
import {
  useDeleteCardMutation,
  useDeleteCardsBatchMutation,
  useUpdateCardMutation,
  useUpdateCardProgressMutation,
} from "../useStudyMutations";

const mocks = vi.hoisted(() => ({
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  deleteCard: vi.fn(),
  deleteBatch: vi.fn(),
  updateCard: vi.fn(),
  updateProgress: vi.fn(),
}));

// Mock messageHelper — 隔离 FrontendEventBus 等副作用
vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: mocks.messageSuccess,
    error: mocks.messageError,
    info: vi.fn(),
    warning: vi.fn(),
  },
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "unknown error",
}));

// Mock react-i18next — t(key) 直接返回 key
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

// Mock api — 隔离真实网络请求
vi.mock("../../../services/api", () => ({
  api: {
    study: {
      delete: mocks.deleteCard,
      deleteBatch: mocks.deleteBatch,
      update: mocks.updateCard,
      updateProgress: mocks.updateProgress,
    },
  },
}));

// Mock FrontendEventBus — mutationFactory 顶层 import 依赖
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

const cardKey = ["studyCards", "all", "all", "none", "all"] as const;

function makeCard(id: string, extra: Partial<StudyCard> = {}): StudyCard {
  return {
    id,
    knowledge_point_id: `kp-${id}`,
    user_id: "u1",
    graph_id: "g1",
    question: `question ${id}`,
    answer: `answer ${id}`,
    card_type: "qa",
    next_review: "2026-09-01T00:00:00Z",
    review_count: 0,
    ...extra,
  };
}

describe("Study mutations 乐观更新与回滚", () => {
  let queryClient: QueryClient;

  const seedCache = (cards: StudyCard[]) => {
    queryClient.setQueryData<StudyCard[]>(cardKey, cards);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe("useDeleteCardMutation", () => {
    it("成功时立即从缓存中移除对应卡片", async () => {
      seedCache([makeCard("a"), makeCard("b")]);
      mocks.deleteCard.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteCardMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync("a");

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.map((c) => c.id)).toEqual(["b"]);
      });
      expect(mocks.deleteCard).toHaveBeenCalledWith("a");
    });

    it("失败时回滚缓存并弹出错误 Toast", async () => {
      seedCache([makeCard("a"), makeCard("b")]);
      mocks.deleteCard.mockRejectedValue(new Error("delete failed"));
      const { result } = renderHook(() => useDeleteCardMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(result.current.mutateAsync("a")).rejects.toThrow("delete failed");

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.map((c) => c.id)).toEqual(["a", "b"]);
      });
      expect(mocks.messageError).toHaveBeenCalled();
    });
  });

  describe("useDeleteCardsBatchMutation", () => {
    it("成功时立即从缓存中移除所有选中卡片", async () => {
      seedCache([makeCard("a"), makeCard("b"), makeCard("c")]);
      mocks.deleteBatch.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteCardsBatchMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync(["a", "c"]);

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.map((c) => c.id)).toEqual(["b"]);
      });
      expect(mocks.deleteBatch).toHaveBeenCalledWith(["a", "c"]);
    });

    it("失败时回滚缓存并弹出错误 Toast", async () => {
      seedCache([makeCard("a"), makeCard("b")]);
      mocks.deleteBatch.mockRejectedValue(new Error("batch failed"));
      const { result } = renderHook(() => useDeleteCardsBatchMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(result.current.mutateAsync(["a"])).rejects.toThrow("batch failed");

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.map((c) => c.id)).toEqual(["a", "b"]);
      });
      expect(mocks.messageError).toHaveBeenCalled();
    });
  });

  describe("useUpdateCardMutation", () => {
    it("成功时立即用新字段更新缓存中的对应卡片", async () => {
      seedCache([makeCard("a"), makeCard("b")]);
      mocks.updateCard.mockResolvedValue(undefined);
      const { result } = renderHook(() => useUpdateCardMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({
        id: "a",
        data: { question: "new question", difficulty: 3 },
      });

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        const updated = cache?.find((c) => c.id === "a");
        expect(updated?.question).toBe("new question");
        expect(updated?.difficulty).toBe(3);
      });
    });

    it("失败时回滚缓存并弹出错误 Toast", async () => {
      seedCache([makeCard("a")]);
      mocks.updateCard.mockRejectedValue(new Error("update failed"));
      const { result } = renderHook(() => useUpdateCardMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        result.current.mutateAsync({ id: "a", data: { question: "new" } }),
      ).rejects.toThrow("update failed");

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.[0]?.question).toBe("question a");
      });
      expect(mocks.messageError).toHaveBeenCalled();
    });
  });

  describe("useUpdateCardProgressMutation", () => {
    it("评分成功后用服务端返回的卡片精确覆盖缓存", async () => {
      seedCache([makeCard("a")]);
      const serverCard = makeCard("a", {
        next_review: "2026-10-01T00:00:00Z",
        review_count: 1,
      });
      mocks.updateProgress.mockResolvedValue(serverCard);
      const { result } = renderHook(() => useUpdateCardProgressMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await result.current.mutateAsync({ id: "a", quality: 3 });

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.[0]?.next_review).toBe("2026-10-01T00:00:00Z");
        expect(cache?.[0]?.review_count).toBe(1);
      });
      expect(mocks.updateProgress).toHaveBeenCalledWith("a", 3);
    });

    it("失败时回滚缓存并弹出错误 Toast", async () => {
      seedCache([makeCard("a")]);
      mocks.updateProgress.mockRejectedValue(new Error("progress failed"));
      const { result } = renderHook(() => useUpdateCardProgressMutation(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        result.current.mutateAsync({ id: "a", quality: 3 }),
      ).rejects.toThrow("progress failed");

      await waitFor(() => {
        const cache = queryClient.getQueryData<StudyCard[]>(cardKey);
        expect(cache?.[0]?.last_reviewed).toBeUndefined();
      });
      expect(mocks.messageError).toHaveBeenCalled();
    });
  });
});
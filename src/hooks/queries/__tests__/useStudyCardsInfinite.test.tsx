// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { StudyCard } from "@shared/types/common";
import type { PaginatedStudyCards } from "@shared/types/api";
import { useStudyCardsInfinite } from "../useStudyQueries";

const mocks = vi.hoisted(() => ({
  getCardsPaged: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    study: {
      getCardsPaged: mocks.getCardsPaged,
    },
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

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

function makePage(page: number, pageSize: number, count: number, total: number): PaginatedStudyCards {
  return {
    items: Array.from({ length: count }, (_, i) => makeCard(`p${page}-${i}`)),
    total,
    page,
    pageSize,
  };
}

describe("useStudyCardsInfinite", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("首屏加载时以 page=1 请求并填充第一页数据", async () => {
    mocks.getCardsPaged.mockResolvedValue(makePage(1, 20, 20, 25));
    const { result } = renderHook(() => useStudyCardsInfinite({}), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mocks.getCardsPaged).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(result.current.data?.pages[0].items).toHaveLength(20);
  });

  it("fetchNextPage 时以 page=2 请求并追加下一页", async () => {
    mocks.getCardsPaged.mockImplementation((params: { page?: number }) => {
      const page = params.page ?? 1;
      return Promise.resolve(makePage(page, 20, page === 1 ? 20 : 5, 25));
    });
    const { result } = renderHook(() => useStudyCardsInfinite({}), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mocks.getCardsPaged).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 20 });

    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });
    expect(mocks.getCardsPaged).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 20 });
    expect(result.current.data?.pages[1].items).toHaveLength(5);
  });

  it("无更多页时 hasNextPage 为 false 且 fetchNextPage 不再请求", async () => {
    mocks.getCardsPaged.mockImplementation((params: { page?: number }) => {
      const page = params.page ?? 1;
      return Promise.resolve(makePage(page, 20, 20, 20));
    });
    const { result } = renderHook(() => useStudyCardsInfinite({}), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.hasNextPage).toBe(false);

    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.isFetched).toBe(true);
    });
    expect(mocks.getCardsPaged).toHaveBeenCalledTimes(1);
    expect(result.current.data?.pages).toHaveLength(1);
  });

  it("过滤条件变化时重置分页并以 page=1 重新请求", async () => {
    mocks.getCardsPaged.mockImplementation((params: { page?: number; search?: string }) => {
      const page = params.page ?? 1;
      return Promise.resolve(makePage(page, 20, 20, 25));
    });
    const { result, rerender } = renderHook(
      (props: { search?: string }) => useStudyCardsInfinite(props),
      {
        initialProps: { search: "" },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mocks.getCardsPaged).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: "",
    });

    rerender({ search: "xyz" });

    await waitFor(() => {
      expect(mocks.getCardsPaged).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        search: "xyz",
      });
      expect(result.current.data?.pages).toHaveLength(1);
    });
  });
});
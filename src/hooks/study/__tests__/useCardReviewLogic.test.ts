// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCardReviewLogic } from "../useCardReviewLogic";
import { message } from "../../../utils/messageHelper";
import type { StudyCard } from "@shared/types";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

vi.mock("../../mutations", () => ({
  useUpdateCardProgressMutation: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

// 固定 quiz 设置：wrongRequeue 开启以覆盖错题自动重练分支，interleaveMode 关闭走默认排程
vi.mock("../../../store/useQuizSettingsStore", () => ({
  useQuizSettingsStore: (selector: (s: { wrongRequeue: boolean; interleaveMode: boolean }) => unknown) =>
    selector({ wrongRequeue: true, interleaveMode: false }),
}));

function makeCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: "card-1",
    knowledge_point_id: "kp-1",
    user_id: "user-1",
    graph_id: "graph-1",
    card_type: "qa",
    question: "Q",
    answer: "A",
    next_review: new Date("2025-01-01T00:00:00Z").toISOString(),
    ...overrides,
  };
}

describe("useCardReviewLogic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, "error").mockReturnValue("test-id");
    // 生产契约:mutationFn 调用 api.study.updateProgress,mutateAsync 解析为
    // 服务端返回的更新后 StudyCard(useStudyMutations onSuccess 依赖它覆盖缓存),
    // 因此默认 mock 必须回传与入参 id 一致的卡片,而非 undefined。
    mocks.mutateAsync.mockImplementation(async ({ id }: { id: string }) =>
      makeCard({ id }),
    );
  });

  function renderHook_(overrides: Partial<Parameters<typeof useCardReviewLogic>[0]> = {}) {
    return renderHook(() =>
      useCardReviewLogic({
        semanticSimilarityMap: new Map(),
        isMobile: false,
        ...overrides,
      }),
    );
  }

  it("应该返回正确的初始状态", () => {
    const { result } = renderHook_();
    expect(result.current.quizCards).toEqual([]);
    expect(result.current.currentCardIndex).toBe(0);
    expect(result.current.showAnswer).toBe(false);
    expect(result.current.finished).toBe(false);
    expect(result.current.selectedOption).toBeNull();
    expect(result.current.swipeDirection).toBeNull();
    expect(result.current.cardKey).toBe(0);
    expect(result.current.currentCard).toBeUndefined();
    expect(result.current.similarityWithPrev).toBeNull();
    expect(result.current.sessionStartTime).toBeNull();
    expect(result.current.sessionDuration).toBe(0);
    expect(result.current.reviewedCount).toBe(0);
    expect(result.current.correctCount).toBe(0);
    expect(result.current.updateProgressMutation.isPending).toBe(false);
  });

  it("startCardReview 应该重置状态并装载卡片", () => {
    const { result } = renderHook_();
    const cards = [makeCard({ id: "1" }), makeCard({ id: "2" })];
    act(() => { result.current.startCardReview(cards); });
    expect(result.current.quizCards).toHaveLength(2);
    expect(result.current.currentCardIndex).toBe(0);
    expect(result.current.finished).toBe(false);
    expect(result.current.showAnswer).toBe(false);
    expect(result.current.selectedOption).toBeNull();
    expect(result.current.reviewedCount).toBe(0);
    expect(result.current.correctCount).toBe(0);
    expect(result.current.sessionStartTime).not.toBeNull();
    expect(result.current.currentCard).toBeDefined();
  });

  it("practiceSingleCard 应该装载单张卡片并重置统计", () => {
    const { result } = renderHook_();
    const card = makeCard({ id: "solo" });
    act(() => { result.current.practiceSingleCard(card); });
    expect(result.current.quizCards).toEqual([card]);
    expect(result.current.currentCardIndex).toBe(0);
    expect(result.current.finished).toBe(false);
    expect(result.current.sessionStartTime).not.toBeNull();
    expect(result.current.currentCard).toEqual(card);
  });

  it("resetReviewState 应该清空所有状态", () => {
    const { result } = renderHook_();
    act(() => { result.current.practiceSingleCard(makeCard()); });
    act(() => { result.current.resetReviewState(); });
    expect(result.current.quizCards).toEqual([]);
    expect(result.current.currentCardIndex).toBe(0);
    expect(result.current.finished).toBe(false);
    expect(result.current.sessionStartTime).toBeNull();
    expect(result.current.reviewedCount).toBe(0);
    expect(result.current.correctCount).toBe(0);
  });

  it("handleNextCard 应该在还有卡片时推进索引并隐藏答案", () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    act(() => { result.current.setShowAnswer(true); });
    act(() => { result.current.handleNextCard(); });
    expect(result.current.currentCardIndex).toBe(1);
    expect(result.current.showAnswer).toBe(false);
    expect(result.current.selectedOption).toBeNull();
    expect(result.current.finished).toBe(false);
  });

  it("handleNextCard 应该在最后一张时设置 finished", () => {
    const { result } = renderHook_();
    act(() => { result.current.practiceSingleCard(makeCard({ id: "1" })); });
    act(() => { result.current.handleNextCard(); });
    expect(result.current.finished).toBe(true);
    expect(result.current.sessionDuration).toBeGreaterThanOrEqual(0);
  });

  it("handleRate 应该调用 mutateAsync 并推进到下一张卡片", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    const currentId = result.current.currentCard?.id;
    await act(async () => { await result.current.handleRate(4); });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: currentId, quality: 4 });
    expect(result.current.reviewedCount).toBe(1);
    expect(result.current.correctCount).toBe(1);
    expect(result.current.currentCardIndex).toBe(1);
  });

  it("handleRate 在 quality < 3 时应该只增加 reviewedCount 不增加 correctCount", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    await act(async () => { await result.current.handleRate(1); });
    expect(result.current.reviewedCount).toBe(1);
    expect(result.current.correctCount).toBe(0);
  });

  it("错题重练推进到下一张时应重置 showAnswer 与 selectedOption", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    // 记录起始状态：startCardReview 会对少数的卡片走随机洗牌，因此不假设当前卡的具体 id，
    // 只记录"当前卡的 id"与"当前索引"，后续断言还原实际行为而非固定位置。
    const answeredId = result.current.currentCard?.id;
    expect(answeredId).toBeDefined();
    const startIndex = result.current.currentCardIndex;
    const startLength = result.current.quizCards.length;
    // 模拟：用户已作答并翻面
    act(() => {
      result.current.setShowAnswer(true);
      result.current.setSelectedOption("wrong");
    });
    await act(async () => { await result.current.handleRate(1); });
    // 答错触发重练：索引前进，且下一张卡必须处于未翻面、无选中状态
    expect(result.current.currentCardIndex).toBe(startIndex + 1);
    expect(result.current.showAnswer).toBe(false);
    expect(result.current.selectedOption).toBeNull();
    // 刚答错的卡被插到队尾，等待再次练习（队列长度 +1）
    expect(result.current.quizCards).toHaveLength(startLength + 1);
    expect(result.current.quizCards[result.current.quizCards.length - 1].id).toBe(answeredId);
  });

  it("handleRate 在 mutation 失败时应该发布错误消息", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    await act(async () => { await result.current.handleRate(3); });
    expect(message.error).toHaveBeenCalledWith("study.messages.saveProgressFailed");
    expect(result.current.currentCardIndex).toBe(0);
  });

  it("handleRate 在没有卡片时应该直接返回", async () => {
    const { result } = renderHook_();
    await act(async () => { await result.current.handleRate(3); });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.reviewedCount).toBe(0);
  });

  it("handleRestart 应该重置 finished 状态并保留卡片数", () => {
    const { result } = renderHook_();
    act(() => { result.current.practiceSingleCard(makeCard({ id: "1" })); });
    act(() => { result.current.handleNextCard(); });
    expect(result.current.finished).toBe(true);
    act(() => { result.current.handleRestart(); });
    expect(result.current.finished).toBe(false);
    expect(result.current.currentCardIndex).toBe(0);
    expect(result.current.quizCards).toHaveLength(1);
    expect(result.current.reviewedCount).toBe(0);
    expect(result.current.correctCount).toBe(0);
    expect(result.current.cardKey).toBeGreaterThan(0);
  });

  it("handleDragEnd 应该在右滑阈值触发 handleSwipeRate(3)", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook_({ isMobile: false });
      act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
      const currentId = result.current.currentCard?.id;
      await act(async () => {
        result.current.handleDragEnd(null as never, {
          velocity: { x: 0 },
          offset: { x: 150 },
        });
        vi.advanceTimersByTime(500);
      });
      expect(result.current.swipeDirection).toBeNull();
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: currentId, quality: 3 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("handleDragEnd 应该在左滑阈值触发 handleSwipeRate(1)", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook_({ isMobile: false });
      act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
      const currentId = result.current.currentCard?.id;
      await act(async () => {
        result.current.handleDragEnd(null as never, {
          velocity: { x: 0 },
          offset: { x: -150 },
        });
        vi.advanceTimersByTime(500);
      });
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: currentId, quality: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("handleDragEnd 在未达阈值时不应触发评分", async () => {
    const { result } = renderHook_({ isMobile: false });
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    await act(async () => {
      result.current.handleDragEnd(null as never, {
        velocity: { x: 0 },
        offset: { x: 20 },
      });
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("键盘按 1 键在 showAnswer=true 且有当前卡片时应该触发 handleRate(1)", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    const currentId = result.current.currentCard?.id;
    act(() => { result.current.setShowAnswer(true); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: currentId, quality: 1 });
  });

  it("键盘按空格在 showAnswer=true 时应该触发 handleRate(3)", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" }), makeCard({ id: "2" })]); });
    const currentId = result.current.currentCard?.id;
    act(() => { result.current.setShowAnswer(true); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: currentId, quality: 3 });
  });

  it("showAnswer=false 时不应注册键盘评分快捷键", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" })]); });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("在 input 元素内按键时不应触发评分快捷键", async () => {
    const { result } = renderHook_();
    act(() => { result.current.startCardReview([makeCard({ id: "1" })]); });
    act(() => { result.current.setShowAnswer(true); });
    const input = document.createElement("input");
    document.body.appendChild(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("semanticAwareShuffle 在卡片数 <= 2 时应使用随机洗牌且不丢失卡片", () => {
    const { result } = renderHook_();
    const cards = [makeCard({ id: "1" }), makeCard({ id: "2" })];
    const original = [...cards];
    act(() => { result.current.semanticAwareShuffle(cards); });
    expect(cards).toHaveLength(original.length);
    expect(cards.map((c) => c.id).sort()).toEqual(original.map((c) => c.id).sort());
  });

  it("semanticAwareShuffle 在相似度图为空时使用随机洗牌", () => {
    const { result } = renderHook_();
    const cards = [makeCard({ id: "1" }), makeCard({ id: "2" }), makeCard({ id: "3" })];
    act(() => { result.current.semanticAwareShuffle(cards); });
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.id).sort()).toEqual(["1", "2", "3"]);
  });
});

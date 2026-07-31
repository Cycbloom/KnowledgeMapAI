// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuizLogic } from "../useQuizLogic";
import { message } from "../../../utils/messageHelper";

// Mock react-i18next：t 直接返回 key 便于断言
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh-CN" } }),
}));

describe("useQuizLogic", () => {
  const setSelectedOption = vi.fn();
  const setShowAnswer = vi.fn();
  const setViewState = vi.fn();
  const startCardReview = vi.fn();

  function renderQuizHook(overrides: Partial<Parameters<typeof useQuizLogic>[0]> = {}) {
    return renderHook(() =>
      useQuizLogic({
        showAnswer: false,
        selectedOption: null,
        setSelectedOption,
        setShowAnswer,
        setViewState,
        startCardReview,
        currentOptions: ["A", "B", "C", "D"],
        isMultiChoice: false,
        ...overrides,
      }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, "info").mockReturnValue("test-id");
  });

  it("应该返回三个 action 函数", () => {
    const { result } = renderQuizHook();
    expect(typeof result.current.handleStartQuiz).toBe("function");
    expect(typeof result.current.handleOptionClick).toBe("function");
    expect(typeof result.current.handleMultiOptionClick).toBe("function");
  });

  it("handleStartQuiz 应该在 all 模式下使用全部卡片并切换视图", () => {
    const { result } = renderQuizHook();
    const allCards = [
      { id: "1", knowledge_point_id: "kp1" },
      { id: "2", knowledge_point_id: "kp2" },
    ] as never;
    const dueCards = [{ id: "1", knowledge_point_id: "kp1" }] as never;

    act(() => {
      result.current.handleStartQuiz("all", allCards, dueCards);
    });

    expect(startCardReview).toHaveBeenCalledWith(allCards);
    expect(setViewState).toHaveBeenCalledWith("quiz");
    expect(message.info).not.toHaveBeenCalled();
  });

  it("handleStartQuiz 应该在 due 模式下使用到期卡片", () => {
    const { result } = renderQuizHook();
    const allCards = [{ id: "1" }] as never;
    const dueCards = [{ id: "2" }] as never;

    act(() => {
      result.current.handleStartQuiz("due", allCards, dueCards);
    });

    expect(startCardReview).toHaveBeenCalledWith(dueCards);
    expect(setViewState).toHaveBeenCalledWith("quiz");
  });

  it("handleStartQuiz 应该在选中为空时发布提示且不启动复习", () => {
    const { result } = renderQuizHook();

    act(() => {
      result.current.handleStartQuiz("due", [], []);
    });

    expect(startCardReview).not.toHaveBeenCalled();
    expect(setViewState).not.toHaveBeenCalled();
    expect(message.info).toHaveBeenCalledWith("study.messages.noCardsToReview");
  });

  it("handleOptionClick 应该在未显示答案时设置选项并显示答案", () => {
    const { result } = renderQuizHook({ showAnswer: false });

    act(() => {
      result.current.handleOptionClick("A");
    });

    expect(setSelectedOption).toHaveBeenCalledWith("A");
    expect(setShowAnswer).toHaveBeenCalledWith(true);
  });

  it("handleOptionClick 应该在已显示答案时直接返回不修改状态", () => {
    const { result } = renderQuizHook({ showAnswer: true });

    act(() => {
      result.current.handleOptionClick("A");
    });

    expect(setSelectedOption).not.toHaveBeenCalled();
    expect(setShowAnswer).not.toHaveBeenCalled();
  });

  it("handleMultiOptionClick 应该把选中项加入数组（JSON 编码）", () => {
    const { result } = renderQuizHook({
      isMultiChoice: true,
      selectedOption: null,
      showAnswer: false,
    });

    act(() => {
      result.current.handleMultiOptionClick("A");
    });

    expect(setSelectedOption).toHaveBeenCalledWith(JSON.stringify(["A"]));
  });

  it("handleMultiOptionClick 应该在再次点击时移除已选项", () => {
    const { result } = renderQuizHook({
      isMultiChoice: true,
      selectedOption: JSON.stringify(["A", "B"]),
      showAnswer: false,
    });

    act(() => {
      result.current.handleMultiOptionClick("A");
    });

    expect(setSelectedOption).toHaveBeenCalledWith(JSON.stringify(["B"]));
  });

  it("handleMultiOptionClick 应该在已显示答案时直接返回", () => {
    const { result } = renderQuizHook({
      isMultiChoice: true,
      showAnswer: true,
    });

    act(() => {
      result.current.handleMultiOptionClick("A");
    });

    expect(setSelectedOption).not.toHaveBeenCalled();
  });

  it("键盘按 a 键应该触发第一个选项的单选逻辑", () => {
    renderQuizHook({ showAnswer: false, isMultiChoice: false });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a" }),
      );
    });

    expect(setSelectedOption).toHaveBeenCalledWith("A");
    expect(setShowAnswer).toHaveBeenCalledWith(true);
  });

  it("键盘按 2 键应该触发第二个选项", () => {
    renderQuizHook({ showAnswer: false, isMultiChoice: false });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "2" }),
      );
    });

    expect(setSelectedOption).toHaveBeenCalledWith("B");
  });

  it("showAnswer 为 true 时不应注册键盘快捷键", () => {
    renderQuizHook({ showAnswer: true });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a" }),
      );
    });

    expect(setSelectedOption).not.toHaveBeenCalled();
  });

  it("currentOptions 为空时不应触发键盘选择", () => {
    renderQuizHook({ showAnswer: false, currentOptions: [] });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a" }),
      );
    });

    expect(setSelectedOption).not.toHaveBeenCalled();
  });

  it("在 input 元素内按键时不应触发快捷键", () => {
    renderQuizHook({ showAnswer: false });

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      );
    });

    expect(setSelectedOption).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});

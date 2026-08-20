// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizFocusLayout } from '../../src/components/Study/QuizFocusLayout';
import type { StudyCard } from '../../shared/types/common';

const mockMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  isIdle: true,
  error: null,
  data: undefined,
  variables: undefined,
  context: undefined,
  failureCount: 0,
  failureReason: null,
  status: 'idle' as const,
  reset: vi.fn(),
};

const baseCard: StudyCard = {
  id: 'card-1',
  knowledge_point_id: 'kp-1',
  user_id: 'user-1',
  graph_id: 'graph-1',
  question: '这是一道测试题',
  answer: '["选项A","选项C"]',
  card_type: 'multi_choice',
  options: ['选项A', '选项B', '选项C', '选项D'],
  explanation: '这是解析',
  next_review: '2026-01-01T00:00:00Z',
};

interface BasePropsOverrides {
  currentCardIndex?: number;
  quizCardsLength?: number;
  showAnswer?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

function createBaseProps(overrides: BasePropsOverrides = {}) {
  const {
    currentCardIndex = 0,
    quizCardsLength = 3,
    showAnswer = false,
    onPrev = vi.fn(),
    onNext = vi.fn(),
  } = overrides;

  return {
    isDark: false,
    isMobile: false,
    currentCard: baseCard,
    currentCardIndex,
    quizCardsLength,
    showAnswer,
    selectedOption: null,
    updateProgressMutation: mockMutation,
    onBackToDashboard: vi.fn(),
    onRate: vi.fn(),
    onOptionClick: vi.fn(),
    onMultiOptionClick: vi.fn(),
    onSetShowAnswer: vi.fn(),
    onPrev,
    onNext,
  };
}

describe('QuizFocusLayout', () => {
  describe('TR-4.1: 结构与 aria-label 验证', () => {
    it('两个 overflow-y-auto custom-scrollbar 子元素存在且 aria-label 非空', () => {
      const props = createBaseProps();
      renderWithProviders(<QuizFocusLayout {...props} />);

      const scrollRegions = document.querySelectorAll('.overflow-y-auto.custom-scrollbar');
      expect(scrollRegions.length).toBeGreaterThanOrEqual(2);

      const withAriaLabel = Array.from(scrollRegions).filter((el) => {
        const label = el.getAttribute('aria-label');
        return label !== null && label.trim().length > 0;
      });
      expect(withAriaLabel.length).toBeGreaterThanOrEqual(2);
    });

    it('网格容器含 h-full/max-w-7xl 且不含视口绝对高度；滚动区各带 min-h-0', () => {
      const props = createBaseProps();
      const { container } = renderWithProviders(<QuizFocusLayout {...props} />);

      const gridContainer = container.querySelector('.grid.grid-rows-\\[1fr_auto\\]');
      expect(gridContainer).not.toBeNull();
      const gridClass = gridContainer!.className;
      expect(gridClass).not.toContain('h-[88vh]');
      expect(gridClass).not.toContain('max-h-[920px]');
      expect(gridClass).toContain('h-full');
      expect(gridClass).toContain('max-w-7xl');
      expect(gridClass).toContain('mx-auto');
      expect(gridClass).toContain('w-full');

      const scrollRegions = container.querySelectorAll('.overflow-y-auto.custom-scrollbar');
      expect(scrollRegions.length).toBeGreaterThanOrEqual(2);
      const withMinH0 = Array.from(scrollRegions).filter((el) => {
        const className = (el as HTMLElement).className;
        return typeof className === 'string' && className.includes('min-h-0');
      });
      expect(withMinH0.length).toBeGreaterThanOrEqual(2);
    });

    it('底栏无 overflow 类名', () => {
      const props = createBaseProps();
      renderWithProviders(<QuizFocusLayout {...props} />);

      const stickyBottomElements = document.querySelectorAll('.sticky.bottom-0');
      expect(stickyBottomElements.length).toBeGreaterThanOrEqual(1);

      stickyBottomElements.forEach((el) => {
        const className = (el as HTMLElement).className;
        expect(className).not.toContain('overflow-y');
        expect(className).not.toContain('overflow-auto');
      });
    });
  });

  describe('TR-4.2: 无手势拖拽验证', () => {
    it('wrapper 不含 cursor-grab 类', () => {
      const props = createBaseProps();
      renderWithProviders(<QuizFocusLayout {...props} />);

      const allElements = document.querySelectorAll('*');
      const cursorGrabElements = Array.from(allElements).filter((el) => {
        const className = (el as HTMLElement).className;
        return typeof className === 'string' && className.includes('cursor-grab');
      });
      expect(cursorGrabElements.length).toBe(0);
    });

    it('wrapper 不含 drag 属性且 currentCardIndex 未被动修改', () => {
      const initialIndex = 1;
      let currentIndex = initialIndex;
      const onNext = vi.fn(() => {
        currentIndex += 1;
      });
      const onPrev = vi.fn(() => {
        currentIndex -= 1;
      });

      const props = createBaseProps({
        currentCardIndex: initialIndex,
        quizCardsLength: 3,
        onNext,
        onPrev,
      });

      renderWithProviders(<QuizFocusLayout {...props} />);

      const allElements = document.querySelectorAll('*');
      const dragElements = Array.from(allElements).filter((el) => {
        return el.hasAttribute('drag');
      });
      expect(dragElements.length).toBe(0);

      expect(currentIndex).toBe(initialIndex);
      expect(onNext).not.toHaveBeenCalled();
      expect(onPrev).not.toHaveBeenCalled();
    });
  });

  describe('TR-4.3: 键盘快捷键验证', () => {
    it('fireEvent keydown ArrowRight 调用 onNext 一次', () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const props = createBaseProps({
        currentCardIndex: 0,
        quizCardsLength: 3,
        onNext,
        onPrev,
      });

      renderWithProviders(<QuizFocusLayout {...props} />);

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onPrev).not.toHaveBeenCalled();
    });

    it('fireEvent keydown ArrowLeft 调用 onPrev 一次', () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const props = createBaseProps({
        currentCardIndex: 1,
        quizCardsLength: 3,
        onNext,
        onPrev,
      });

      renderWithProviders(<QuizFocusLayout {...props} />);

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(onPrev).toHaveBeenCalledTimes(1);
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  describe('TR-4.4: 上下题按钮禁用状态验证', () => {
    it('挂载时 currentCardIndex=0 → prev 按钮 disabled', () => {
      const props = createBaseProps({
        currentCardIndex: 0,
        quizCardsLength: 3,
      });

      renderWithProviders(<QuizFocusLayout {...props} />);

      const buttons = screen.getAllByRole('button');
      const navButtons = buttons.filter((btn) => {
        const ariaLabel = btn.getAttribute('aria-label') ?? '';
        const text = btn.textContent ?? '';
        return (
          ariaLabel.includes('Previous') ||
          ariaLabel.includes('上一题') ||
          ariaLabel.includes('Prev') ||
          text.includes('Previous') ||
          text.includes('上一题') ||
          text.includes('Prev')
        );
      });
      expect(navButtons.length).toBeGreaterThanOrEqual(1);
      const prevButton = navButtons[0];
      expect(prevButton).toBeDisabled();
    });

    it('currentCardIndex=quizCardsLength-1 → next 按钮 disabled', () => {
      const total = 3;
      const props = createBaseProps({
        currentCardIndex: total - 1,
        quizCardsLength: total,
      });

      renderWithProviders(<QuizFocusLayout {...props} />);

      const buttons = screen.getAllByRole('button');
      const navButtons = buttons.filter((btn) => {
        const ariaLabel = btn.getAttribute('aria-label') ?? '';
        const text = btn.textContent ?? '';
        const isNextLike =
          ariaLabel.includes('Next') ||
          ariaLabel.includes('下一题') ||
          ariaLabel.includes('下一张') ||
          text.includes('Next') ||
          text.includes('下一题') ||
          text.includes('下一张');
        const isPrevLike =
          ariaLabel.includes('Previous') ||
          ariaLabel.includes('上一题') ||
          ariaLabel.includes('Prev') ||
          text.includes('Previous') ||
          text.includes('上一题') ||
          text.includes('Prev');
        return isNextLike && !isPrevLike;
      });
      expect(navButtons.length).toBeGreaterThanOrEqual(1);
      const nextButton = navButtons[navButtons.length - 1];
      expect(nextButton).toBeDisabled();
    });
  });
});

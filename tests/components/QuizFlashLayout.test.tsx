// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizFlashLayout } from '../../src/components/Study/QuizFlashLayout';
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
  answer: '这是答案',
  card_type: 'multi_choice',
  options: ['选项A', '选项B', '选项C', '选项D'],
  explanation: '这是解析',
  next_review: '2026-01-01T00:00:00Z',
};

const baseProps = {
  isDark: false,
  isMobile: false,
  currentCard: baseCard,
  currentCardIndex: 0,
  quizCardsLength: 3,
  showAnswer: false,
  selectedOption: null,
  cardKey: 1,
  swipeDirection: null as 'left' | 'right' | null,
  quizCards: [baseCard],
  similarityWithPrev: null,
  updateProgressMutation: mockMutation,
  onBackToDashboard: vi.fn(),
  onRate: vi.fn(),
  onOptionClick: vi.fn(),
  onMultiOptionClick: vi.fn(),
  onDragEnd: vi.fn(),
  onSetShowAnswer: vi.fn(),
};

describe('QuizFlashLayout', () => {
  describe('TR-3.1: 题型胶囊位置验证', () => {
    it('不存在 absolute 且包含多选翻译文案的右上角 tiny pill', () => {
      renderWithProviders(<QuizFlashLayout {...baseProps} />);

      const multiChoiceText = screen.queryByText('多选');
      expect(multiChoiceText).toBeInTheDocument();

      const elements = document.querySelectorAll('*');
      const absoluteBadgeElements: HTMLElement[] = [];
      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const className = htmlEl.className;
        if (typeof className === 'string' && className.includes('absolute')) {
          const hasTopRight = className.includes('top-3') || className.includes('top-4') || className.includes('top-6');
          const hasRight = className.includes('right-3') || className.includes('right-4') || className.includes('right-6');
          const hasTinyText = className.includes('text-[10px]');
          if (hasTopRight && hasRight && hasTinyText) {
            absoluteBadgeElements.push(htmlEl);
          }
        }
      });

      const oldPillWithMultiChoice = absoluteBadgeElements.find(
        (el) => el.textContent?.includes('多选')
      );
      expect(oldPillWithMultiChoice).toBeUndefined();
    });

    it('题型胶囊渲染在 Question chip 附近兄弟节点', () => {
      renderWithProviders(<QuizFlashLayout {...baseProps} />);

      const questionChip = screen.getByText('题目', { exact: false });
      expect(questionChip).toBeInTheDocument();

      const parentContainer = questionChip.parentElement;
      expect(parentContainer).not.toBeNull();

      const siblingHasMultiChoice = Array.from(parentContainer!.children).some(
        (child) => child.textContent?.includes('多选')
      );
      expect(siblingHasMultiChoice).toBe(true);
    });
  });

  describe('TR-3.2: 样式类名验证', () => {
    it('主卡容器包含 max-w-3xl', () => {
      renderWithProviders(<QuizFlashLayout {...baseProps} />);
      const wrapper = document.querySelector('.max-w-3xl');
      expect(wrapper).not.toBeNull();
    });

    it('主卡区域包含 h-full w-full flex items-center justify-center 且不含视口绝对高度', () => {
      renderWithProviders(<QuizFlashLayout {...baseProps} />);
      const perspectiveDiv = document.querySelector('.perspective-1000');
      expect(perspectiveDiv).not.toBeNull();
      const className = perspectiveDiv!.className;
      expect(className).not.toContain('h-[78vh]');
      expect(className).not.toContain('max-h-[760px]');
      expect(className).not.toContain('h-[65vh]');
      expect(className).toContain('h-full');
      expect(className).toContain('w-full');
      expect(className).toContain('flex');
      expect(className).toContain('items-center');
      expect(className).toContain('justify-center');
    });

    it('题型胶囊字体类名包含 text-xs 与 md:text-[13px]', () => {
      renderWithProviders(<QuizFlashLayout {...baseProps} />);

      const allElements = document.querySelectorAll('*');
      let foundBadge: HTMLElement | null = null;
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const className = htmlEl.className;
        if (
          typeof className === 'string' &&
          className.includes('text-xs') &&
          className.includes('md:text-[13px]') &&
          htmlEl.textContent?.includes('多选')
        ) {
          foundBadge = htmlEl;
        }
      });

      expect(foundBadge).not.toBeNull();
      expect(foundBadge!.className).toContain('font-bold');
      expect(foundBadge!.className).toContain('inline-flex');
      expect(foundBadge!.className).toContain('items-center');
      expect(foundBadge!.className).toContain('gap-1');
      expect(foundBadge!.className).toContain('px-2.5');
      expect(foundBadge!.className).toContain('py-1');
    });
  });
});

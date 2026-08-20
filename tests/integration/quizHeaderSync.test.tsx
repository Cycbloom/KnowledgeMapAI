// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizFlashLayout } from '../../src/components/Study/QuizFlashLayout';
import { QuizFocusLayout } from '../../src/components/Study/QuizFocusLayout';
import { QuizViewActive } from '../../src/components/Study/QuizView';
import type { StudyCard } from '../../shared/types/common';
import * as quizLayoutPrefModule from '../../src/hooks/quiz/useQuizLayoutPref';

vi.mock('../../src/hooks/quiz/useQuizLayoutPref', () => ({
  useQuizLayoutPref: vi.fn(() => ({
    layoutMode: 'flash' as const,
    setLayoutMode: vi.fn(),
    isForcedFlash: false,
  })),
}));

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

const qaCard: StudyCard = {
  id: 'card-qa-1',
  knowledge_point_id: 'kp-1',
  user_id: 'user-1',
  graph_id: 'graph-1',
  question: '这是一道 QA 问答题',
  answer: '这是 QA 答案',
  card_type: 'qa',
  explanation: '这是解析内容',
  next_review: '2026-01-01T00:00:00Z',
};

const choiceCard: StudyCard = {
  id: 'card-choice-1',
  knowledge_point_id: 'kp-1',
  user_id: 'user-1',
  graph_id: 'graph-1',
  question: '这是一道单选题',
  answer: '选项A',
  card_type: 'choice',
  options: ['选项A', '选项B', '选项C', '选项D'],
  explanation: '这是解析内容',
  next_review: '2026-01-01T00:00:00Z',
};

const multiChoiceCard: StudyCard = {
  id: 'card-multi-1',
  knowledge_point_id: 'kp-1',
  user_id: 'user-1',
  graph_id: 'graph-1',
  question: '这是一道多选题',
  answer: '["选项A","选项C"]',
  card_type: 'multi_choice',
  options: ['选项A', '选项B', '选项C', '选项D'],
  explanation: '这是解析内容',
  next_review: '2026-01-01T00:00:00Z',
};

function createFlashBaseProps(overrides: Partial<Parameters<typeof QuizFlashLayout>[0]> = {}) {
  const currentCard = overrides.currentCard ?? choiceCard;
  return {
    isDark: false,
    isMobile: false,
    currentCard,
    currentCardIndex: 0,
    quizCardsLength: 3,
    showAnswer: false,
    selectedOption: null,
    cardKey: 1,
    swipeDirection: null as 'left' | 'right' | null,
    quizCards: [currentCard],
    similarityWithPrev: null,
    updateProgressMutation: mockMutation,
    onBackToDashboard: vi.fn(),
    onRate: vi.fn(),
    onOptionClick: vi.fn(),
    onMultiOptionClick: vi.fn(),
    onDragEnd: vi.fn(),
    onSetShowAnswer: vi.fn(),
    ...overrides,
  };
}

function createFocusBaseProps(overrides: Partial<Parameters<typeof QuizFocusLayout>[0]> = {}) {
  const currentCard = overrides.currentCard ?? multiChoiceCard;
  return {
    isDark: false,
    isMobile: false,
    currentCard,
    currentCardIndex: 0,
    quizCardsLength: 3,
    showAnswer: false,
    selectedOption: null,
    updateProgressMutation: mockMutation,
    onRate: vi.fn(),
    onOptionClick: vi.fn(),
    onMultiOptionClick: vi.fn(),
    onSetShowAnswer: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
}

function createViewActiveBaseProps(overrides: Partial<Parameters<typeof QuizViewActive>[0]> = {}) {
  const currentCard = overrides.currentCard ?? choiceCard;
  return {
    isDark: false,
    isMobile: false,
    currentCard,
    currentCardIndex: 0,
    quizCardsLength: 3,
    showAnswer: false,
    selectedOption: null,
    cardKey: 1,
    swipeDirection: null as 'left' | 'right' | null,
    quizCards: [currentCard],
    similarityWithPrev: null,
    updateProgressMutation: mockMutation,
    onBackToDashboard: vi.fn(),
    onRate: vi.fn(),
    onOptionClick: vi.fn(),
    onMultiOptionClick: vi.fn(),
    onDragEnd: vi.fn(),
    onSetShowAnswer: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
}

describe('quizHeaderSync 闪卡/专注组件 Header 同步', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(quizLayoutPrefModule, 'useQuizLayoutPref').mockReturnValue({
      layoutMode: 'flash',
      setLayoutMode: vi.fn(),
      isForcedFlash: false,
    });
  });

  describe('TR-3.1: QuizFlashLayout 内部 Header 删除与尺寸调整', () => {
    it('QA 模式：组件内部退出按钮计数=0；最外层 perspective-1000 父容器含 h-full 而非 h-[78vh]', () => {
      const props = createFlashBaseProps({ currentCard: qaCard, card_type: 'qa' } as never);
      const { container } = renderWithProviders(<QuizFlashLayout {...props} />);

      const exitButtons = screen.queryAllByRole('button', {
        name: /退出|返回中心|返回/,
      });
      expect(exitButtons).toHaveLength(0);

      const perspectiveDiv = container.querySelector('.perspective-1000');
      expect(perspectiveDiv).not.toBeNull();
      const perspectiveClass = perspectiveDiv!.className;
      expect(perspectiveClass).not.toContain('h-[78vh]');
      expect(perspectiveClass).not.toContain('max-h-[760px]');
      expect(perspectiveClass).toContain('h-full');
      expect(perspectiveClass).toContain('w-full');
      expect(perspectiveClass).toContain('flex');
      expect(perspectiveClass).toContain('items-center');
      expect(perspectiveClass).toContain('justify-center');

      const outermost = container.firstElementChild as HTMLElement;
      expect(outermost.className).toContain('h-full');
      expect(outermost.className).toContain('w-full');
      expect(outermost.className).toContain('flex');
      expect(outermost.className).toContain('items-center');
      expect(outermost.className).toContain('justify-center');
    });

    it('Choice 模式：组件内部退出按钮计数=0；最外层 wrapper 含 h-full 且不含视口绝对高度', () => {
      const props = createFlashBaseProps({ currentCard: choiceCard });
      const { container } = renderWithProviders(<QuizFlashLayout {...props} />);

      const exitButtons = screen.queryAllByRole('button', {
        name: /退出|返回中心|返回/,
      });
      expect(exitButtons).toHaveLength(0);

      const perspectiveDiv = container.querySelector('.perspective-1000');
      expect(perspectiveDiv).not.toBeNull();
      const perspectiveClass = perspectiveDiv!.className;
      expect(perspectiveClass).not.toMatch(/h-\[[\d]+vh\]/);
      expect(perspectiveClass).not.toMatch(/max-h-\[[\d]+px\]/);
      expect(perspectiveClass).toContain('h-full');
    });
  });

  describe('TR-3.2: QuizFocusLayout 尺寸调整与 min-h-0', () => {
    it('最外层 grid 容器含 h-full 且不含 h-[88vh]/max-h-[920px]；两个滚动区各带 min-h-0', () => {
      const props = createFocusBaseProps();
      const { container } = renderWithProviders(<QuizFocusLayout {...props} />);

      const gridContainer = container.querySelector('.grid.grid-rows-\\[1fr_auto\\]');
      expect(gridContainer).not.toBeNull();
      const gridClass = gridContainer!.className;
      expect(gridClass).not.toContain('h-[88vh]');
      expect(gridClass).not.toContain('max-h-[920px]');
      expect(gridClass).not.toContain('max-lg:h-[82vh]');
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
      expect(withMinH0.length).toBe(2);

      scrollRegions.forEach((el) => {
        const className = (el as HTMLElement).className;
        expect(className).toContain('min-h-0');
      });
    });
  });

  describe('TR-3.3: QuizViewActive 双层 Header 防护', () => {
    it('flash 模式下 QuizViewActive 内部不再出现"答题模式"或退出按钮 wrapper 头行', () => {
      vi.spyOn(quizLayoutPrefModule, 'useQuizLayoutPref').mockReturnValue({
        layoutMode: 'flash',
        setLayoutMode: vi.fn(),
        isForcedFlash: false,
      });

      const props = createViewActiveBaseProps();
      const { container } = renderWithProviders(<QuizViewActive {...props} />);

      const quizModeTextNodes = screen.queryAllByText(/答题模式|学习模式/);
      const layoutInternalCount = quizModeTextNodes.filter((node) => {
        let current = node.parentElement;
        while (current) {
          const cls = current.className ?? '';
          if (typeof cls === 'string' && (cls.includes('perspective-1000') || cls.includes('grid-rows-\\[1fr_auto\\]'))) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      });
      expect(layoutInternalCount).toHaveLength(0);

      const topLevelWrapper = container.querySelector('.w-full.h-full.flex.flex-col');
      expect(topLevelWrapper).toBeNull();

      const exitButtons = screen.queryAllByRole('button', {
        name: /退出|返回中心|返回/,
      });
      const insideLayoutExitButtons = exitButtons.filter((btn) => {
        let current = btn.parentElement;
        while (current) {
          const cls = (current as HTMLElement).className ?? '';
          if (typeof cls === 'string' && (cls.includes('perspective-1000') || cls.includes('grid-rows-\\[1fr_auto\\]'))) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      });
      expect(insideLayoutExitButtons).toHaveLength(0);

      const shellFragment = container.firstElementChild;
      expect(shellFragment?.childNodes.length).toBe(1);
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import React, { useState, type ReactElement } from 'react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizActiveShell } from '../../src/components/Study/QuizActiveShell';
import { QuizViewActive } from '../../src/components/Study/QuizView';
import type { StudyCard } from '../../shared/types/common';
import * as useIsMobileModule from '../../src/hooks/common/useIsMobile';
import { useQuizLayoutPref } from '../../src/hooks/quiz/useQuizLayoutPref';

const { mockStore } = vi.hoisted(() => {
  type Store = {
    value: 'flash' | 'focus';
    listeners: Set<(v: 'flash' | 'focus') => void>;
    reset: () => void;
  };
  const mockStore: Store = {
    value: 'flash',
    listeners: new Set(),
    reset() {
      this.value = 'flash';
      this.listeners.forEach((l) => l('flash'));
    },
  };
  return { mockStore };
});

vi.mock('../../src/hooks/quiz/useQuizLayoutPref', () => {
  return {
    useQuizLayoutPref: () => {
      const [mode, setMode] = useState(mockStore.value);

      React.useEffect(() => {
        const listener = (v: 'flash' | 'focus') => setMode(v);
        mockStore.listeners.add(listener);
        return () => {
          mockStore.listeners.delete(listener);
        };
      }, []);

      const setLayoutMode = React.useCallback((newMode: 'flash' | 'focus') => {
        mockStore.value = newMode;
        try {
          window.localStorage.setItem('km-quiz-layout', newMode);
        } catch {
          /* ignore */
        }
        mockStore.listeners.forEach((l) => l(newMode));
      }, []);

      return {
        layoutMode: mode,
        setLayoutMode,
        isForcedFlash: false,
      };
    },
  };
});

vi.mock('../../src/hooks/common/useIsMobile', () => ({
  useIsMobile: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 1024,
    screenHeight: 768,
    orientation: 'landscape' as const,
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
    onPrev,
    onNext,
  };
}

type QuizViewActiveProps = Parameters<typeof QuizViewActive>[0];

interface QuizActiveBranchProps {
  viewProps: QuizViewActiveProps;
}

function QuizActiveBranch({ viewProps }: QuizActiveBranchProps): ReactElement {
  const { layoutMode, setLayoutMode, isForcedFlash } = useQuizLayoutPref();

  return (
    <QuizActiveShell
      isDark={false}
      isMobile={false}
    >
      <QuizViewActive
        {...viewProps}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        isForcedFlash={isForcedFlash}
      />
    </QuizActiveShell>
  );
}

describe('Quiz Dual Layout Integration', () => {
  beforeEach(() => {
    localStorage.removeItem('km-quiz-layout');
    vi.clearAllMocks();
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      screenWidth: 1024,
      screenHeight: 768,
      orientation: 'landscape',
    });
    mockStore.reset();
  });

  describe('TR-5.1: Layout mode switching verification', () => {
    it('默认 layoutMode=flash → DOM 存在 cursor-grab 或 drag=x 特征，切换到 focus 后出现 grid-cols-5 与两个 overflow-y-auto custom-scrollbar', () => {
      const props = createBaseProps();
      renderWithProviders(<QuizActiveBranch viewProps={props} />);

      const allElements = document.querySelectorAll('*');
      const hasFlashFeature = Array.from(allElements).some((el) => {
        const htmlEl = el as HTMLElement;
        const className = htmlEl.className;
        const hasDragAttr = el.hasAttribute('drag') && el.getAttribute('drag') === 'x';
        const hasCursorGrab = typeof className === 'string' && className.includes('cursor-grab');
        return hasDragAttr || hasCursorGrab;
      });
      expect(hasFlashFeature).toBe(true);

      const focusButton = screen.getByRole('radio', { name: /focus|专注/i });
      expect(focusButton).toBeInTheDocument();
      fireEvent.click(focusButton);

      const gridWithCols = document.querySelector('[class*="grid-cols-5"], [class*="lg:grid-cols-5"]');
      expect(gridWithCols).not.toBeNull();

      const scrollRegions = document.querySelectorAll('.overflow-y-auto.custom-scrollbar');
      expect(scrollRegions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('TR-5.2: Focus mode keyboard shortcut verification', () => {
    it('Focus 模式下 fireEvent keydown ArrowRight → 传入 onNext 回调被调用一次', () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const props = createBaseProps({
        currentCardIndex: 0,
        quizCardsLength: 3,
        onNext,
        onPrev,
      });

      renderWithProviders(<QuizActiveBranch viewProps={props} />);

      const focusButton = screen.getByRole('radio', { name: /focus|专注/i });
      fireEvent.click(focusButton);

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onPrev).not.toHaveBeenCalled();
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizActiveShell } from '../../src/components/Study/QuizActiveShell';
import { QuizActiveHeader } from '../../src/components/Study/QuizActiveHeader';
import { QuizFlashLayout } from '../../src/components/Study/QuizFlashLayout';
import { QuizFocusLayout } from '../../src/components/Study/QuizFocusLayout';
import type { StudyCard } from '../../shared/types/common';
import * as quizLayoutPrefModule from '../../src/hooks/quiz/useQuizLayoutPref';
import * as useIsMobileModule from '../../src/hooks/common/useIsMobile';

vi.mock('../../src/hooks/quiz/useQuizLayoutPref', () => ({
  useQuizLayoutPref: vi.fn(() => ({
    layoutMode: 'flash' as const,
    setLayoutMode: vi.fn(),
    isForcedFlash: false,
  })),
}));

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
  const currentCard = overrides.currentCard ?? qaCard;
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

function createHeaderBaseProps(overrides: Partial<Parameters<typeof QuizActiveHeader>[0]> = {}) {
  return {
    isDark: false,
    isMobile: false,
    layoutMode: 'flash' as const,
    onChangeLayout: vi.fn(),
    isForcedFlash: false,
    currentCardIndex: 0,
    quizCardsLength: 3,
    onBackToDashboard: vi.fn(),
    showSliderHint: true,
    ...overrides,
  };
}

describe('quizActiveShell 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(quizLayoutPrefModule, 'useQuizLayoutPref').mockReturnValue({
      layoutMode: 'flash',
      setLayoutMode: vi.fn(),
      isForcedFlash: false,
    });
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      screenWidth: 1024,
      screenHeight: 768,
      orientation: 'landscape',
    });
  });

  describe('TR-4.1: 闪卡模式退出按钮唯一', () => {
    it('QuizActiveShell + QuizActiveHeader + QuizFlashLayout 一起渲染后，退出按钮长度===1', () => {
      const headerProps = createHeaderBaseProps({ layoutMode: 'flash', showSliderHint: true });
      const flashProps = createFlashBaseProps({ currentCard: qaCard });

      renderWithProviders(
        <QuizActiveShell
          isDark={false}
          isMobile={false}
          header={<QuizActiveHeader {...headerProps} />}
        >
          <QuizFlashLayout {...flashProps} />
        </QuizActiveShell>,
      );

      const exitButtons = screen.queryAllByRole('button', {
        name: /退出|Exit/,
      });
      expect(exitButtons).toHaveLength(1);
    });
  });

  describe('TR-4.2: 外层禁滚容器结构', () => {
    it('QuizActiveShell 最外层 class 同时含 h-[100dvh] overflow-hidden；main 内容区含 flex-1 min-h-0 overflow-hidden', () => {
      const headerProps = createHeaderBaseProps();
      const flashProps = createFlashBaseProps({ currentCard: qaCard });

      renderWithProviders(
        <QuizActiveShell
          isDark={false}
          isMobile={false}
          header={<QuizActiveHeader {...headerProps} />}
        >
          <QuizFlashLayout {...flashProps} />
        </QuizActiveShell>,
      );

      const shell = screen.getByTestId('active-shell');
      expect(shell).toBeInTheDocument();

      const shellClass = shell.className;
      expect(shellClass).toContain('h-[100dvh]');
      expect(shellClass).toContain('overflow-hidden');

      const main = shell.querySelector('main');
      expect(main).toBeInTheDocument();
      const mainClass = main?.className ?? '';
      expect(mainClass).toContain('flex-1');
      expect(mainClass).toContain('min-h-0');
      expect(mainClass).toContain('overflow-hidden');
    });
  });

  describe('TR-4.3: 专注模式双滚动容器', () => {
    it('QuizActiveShell 包 QuizFocusLayout 后 querySelectorAll .overflow-y-auto.custom-scrollbar 长度 ≥ 2', () => {
      const headerProps = createHeaderBaseProps({
        layoutMode: 'focus',
        showSliderHint: false,
      });
      const focusProps = createFocusBaseProps();

      const { container } = renderWithProviders(
        <QuizActiveShell
          isDark={false}
          isMobile={false}
          header={<QuizActiveHeader {...headerProps} />}
        >
          <QuizFocusLayout {...focusProps} />
        </QuizActiveShell>,
      );

      const scrollBars = container.querySelectorAll('.overflow-y-auto.custom-scrollbar');
      expect(scrollBars.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('TR-4.4: 移动端布局切换器隐藏', () => {
    it('mock useIsMobile 返回 isMobile=true；渲染后 layoutMode radiogroup 返回空或 aria-disabled=true', () => {
      vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        screenWidth: 375,
        screenHeight: 812,
        orientation: 'portrait',
      });

      const headerProps = createHeaderBaseProps({
        isMobile: true,
        layoutMode: 'flash',
        showSliderHint: true,
      });
      const flashProps = createFlashBaseProps({
        isMobile: true,
        currentCard: qaCard,
      });

      renderWithProviders(
        <QuizActiveShell
          isDark={false}
          isMobile={true}
          header={<QuizActiveHeader {...headerProps} />}
        >
          <QuizFlashLayout {...flashProps} />
        </QuizActiveShell>,
      );

      const radiogroups = screen.queryAllByRole('radiogroup', {
        name: /答题布局|Quiz Layout|layoutLabel/,
      });

      if (radiogroups.length > 0) {
        radiogroups.forEach((rg) => {
          const rgClass = rg.className;
          const hasMaxMdHidden = typeof rgClass === 'string' && rgClass.includes('max-md:hidden');
          const parent = rg.parentElement;
          const parentHasMaxMdHidden =
            parent && typeof parent.className === 'string' && parent.className.includes('max-md:hidden');
          expect(hasMaxMdHidden || parentHasMaxMdHidden).toBe(true);
        });
      } else {
        expect(radiogroups).toHaveLength(0);
      }
    });
  });
});

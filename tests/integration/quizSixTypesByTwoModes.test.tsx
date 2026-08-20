// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizFlashLayout } from '../../src/components/Study/QuizFlashLayout';
import { QuizFocusLayout } from '../../src/components/Study/QuizFocusLayout';
import { studyCardFactory } from '../helpers/factories';
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

const CARD_TYPE_LABELS: Record<StudyCard['card_type'], string> = {
  choice: '单选',
  multi_choice: '多选',
  true_false: '判断',
  fill_in_the_blank: '填空',
  qa: '问答',
  essay: '简答',
};

const CARD_TYPES: StudyCard['card_type'][] = [
  'choice',
  'multi_choice',
  'true_false',
  'fill_in_the_blank',
  'qa',
  'essay',
];

function buildCardByType(cardType: StudyCard['card_type']): StudyCard {
  const base: Partial<StudyCard> = {
    id: `card-${cardType}`,
    knowledge_point_id: 'kp-1',
    user_id: 'user-1',
    graph_id: 'graph-1',
    question: `请回答以下关于知识点的问题内容？[${cardType}]`,
    explanation: '🧠EXPLANATION_MARKER🧠：这是专门用于验证答案解析区是否正确渲染的解析文本内容',
    next_review: '2026-01-01T00:00:00Z',
    card_type: cardType,
  };

  switch (cardType) {
    case 'choice':
      return studyCardFactory({
        ...base,
        answer: '选项A',
        options: ['选项A', '选项B', '选项C', '选项D'],
      });
    case 'multi_choice':
      return studyCardFactory({
        ...base,
        answer: '["选项A","选项C"]',
        options: ['选项A', '选项B', '选项C', '选项D'],
      });
    case 'true_false':
      return studyCardFactory({
        ...base,
        answer: 'True',
      });
    case 'fill_in_the_blank':
      return studyCardFactory({
        ...base,
        answer: '填空的正确答案',
      });
    case 'qa':
      return studyCardFactory({
        ...base,
        answer: '问答题的完整参考答案',
      });
    case 'essay':
      return studyCardFactory({
        ...base,
        answer: '论述题的详细解答，包含多个要点和分析过程',
      });
  }
}

function buildFlashProps(card: StudyCard, showAnswer = false) {
  return {
    isDark: false,
    isMobile: false,
    currentCard: card,
    currentCardIndex: 0,
    quizCardsLength: 1,
    showAnswer,
    selectedOption: card.card_type === 'choice' ? card.answer : card.card_type === 'true_false' ? card.answer : null,
    cardKey: 1,
    swipeDirection: null as 'left' | 'right' | null,
    quizCards: [card],
    similarityWithPrev: null,
    updateProgressMutation: mockMutation,
    onBackToDashboard: vi.fn(),
    onRate: vi.fn(),
    onOptionClick: vi.fn(),
    onMultiOptionClick: vi.fn(),
    onDragEnd: vi.fn(),
    onSetShowAnswer: vi.fn(),
  };
}

function buildFocusProps(card: StudyCard, showAnswer = false) {
  return {
    isDark: false,
    isMobile: false,
    currentCard: card,
    currentCardIndex: 0,
    quizCardsLength: 1,
    showAnswer,
    selectedOption: card.card_type === 'choice' ? card.answer : card.card_type === 'true_false' ? card.answer : null,
    updateProgressMutation: mockMutation,
    onRate: vi.fn(),
    onOptionClick: vi.fn(),
    onMultiOptionClick: vi.fn(),
    onSetShowAnswer: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
  };
}

function assertBadgeExists(cardType: StudyCard['card_type']): void {
  const label = CARD_TYPE_LABELS[cardType];
  const badgeMatches = screen.getAllByText(label, { exact: true });
  expect(badgeMatches.length).toBeGreaterThanOrEqual(1);
  const badgeEl = badgeMatches[0] as HTMLElement;
  expect(badgeEl.closest('span')).not.toBeNull();
  const className = badgeEl.className;
  if (typeof className === 'string') {
    expect(className.includes('rounded-full') || className.includes('px-2.5')).toBe(true);
  }
}

function assertOptionAreaExists(cardType: StudyCard['card_type']): void {
  switch (cardType) {
    case 'choice': {
      const optionA = screen.queryByText('选项A', { exact: false });
      expect(optionA).toBeInTheDocument();
      break;
    }
    case 'multi_choice': {
      const optionA = screen.queryByText('选项A', { exact: false });
      expect(optionA).toBeInTheDocument();
      break;
    }
    case 'true_false': {
      const correctBtn = screen.queryByText('正确');
      const incorrectBtn = screen.queryByText('错误');
      const hasEither = correctBtn !== null || incorrectBtn !== null;
      expect(hasEither).toBe(true);
      break;
    }
    case 'fill_in_the_blank':
    case 'qa':
    case 'essay': {
      const showAnswerBtn = screen.queryByText('显示答案');
      expect(showAnswerBtn).toBeInTheDocument();
      break;
    }
  }
}

function assertFocusScrollRegions(): void {
  const scrollRegions = document.querySelectorAll('.overflow-y-auto.custom-scrollbar');
  expect(scrollRegions.length).toBeGreaterThanOrEqual(2);
}

function assertAnswerExplanationRenders(): void {
  const explanation = screen.queryByText('EXPLANATION_MARKER', { exact: false });
  expect(explanation).toBeInTheDocument();
}

describe('C-18: 6 题型 × 2 模式 = 12 渲染冒烟测试', () => {
  describe('Flash 模式（闪卡）', () => {
    CARD_TYPES.forEach((cardType) => {
      it(`[Flash] ${CARD_TYPE_LABELS[cardType]}：题型胶囊 + Option 区关键元素存在`, () => {
        const card = buildCardByType(cardType);
        const props = buildFlashProps(card, false);
        renderWithProviders(<QuizFlashLayout {...props} />);

        assertBadgeExists(cardType);
        assertOptionAreaExists(cardType);
      });

      it(`[Flash] ${CARD_TYPE_LABELS[cardType]}：showAnswer=true 时卡内答案解析区渲染`, () => {
        const card = buildCardByType(cardType);
        const props = buildFlashProps(card, true);
        renderWithProviders(<QuizFlashLayout {...props} />);

        assertAnswerExplanationRenders();
      });
    });
  });

  describe('Focus 模式（分栏精读）', () => {
    CARD_TYPES.forEach((cardType) => {
      it(`[Focus] ${CARD_TYPE_LABELS[cardType]}：题型胶囊 + Option 区 + ≥2 滚动区域存在`, () => {
        const card = buildCardByType(cardType);
        const props = buildFocusProps(card, false);
        renderWithProviders(<QuizFocusLayout {...props} />);

        assertBadgeExists(cardType);
        assertOptionAreaExists(cardType);
        assertFocusScrollRegions();
      });

      it(`[Focus] ${CARD_TYPE_LABELS[cardType]}：showAnswer=true 时右栏答案解析区渲染`, () => {
        const card = buildCardByType(cardType);
        const props = buildFocusProps(card, true);
        renderWithProviders(<QuizFocusLayout {...props} />);

        assertAnswerExplanationRenders();
      });
    });
  });
});

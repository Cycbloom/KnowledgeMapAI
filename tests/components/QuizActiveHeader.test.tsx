// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizActiveHeader } from '../../src/components/Study/QuizActiveHeader';

describe('QuizActiveHeader', () => {
  const defaultProps = {
    isDark: false,
    isMobile: false,
    layoutMode: 'flash' as const,
    onChangeLayout: vi.fn(),
    isForcedFlash: false,
    currentCardIndex: 0,
    quizCardsLength: 10,
    onBackToDashboard: vi.fn(),
  };

  describe('TR-1.1 闪卡模式', () => {
    it('退出按钮计数 = 1；进度 pill 文案匹配 "1 / 10"；小字含 slideHint 翻译', () => {
      renderWithProviders(
        <QuizActiveHeader
          {...defaultProps}
          layoutMode="flash"
          currentCardIndex={0}
          quizCardsLength={10}
          showSliderHint={true}
        />,
      );

      const exitButtons = screen.getAllByRole('button', {
        name: '退出',
      });
      expect(exitButtons).toHaveLength(1);

      expect(screen.getByText('1 / 10')).toBeInTheDocument();

      expect(screen.getByText('左右滑动切换卡片')).toBeInTheDocument();
    });
  });

  describe('TR-1.2 专注模式', () => {
    it('小字含 focusHint 翻译；切换器 enabled', () => {
      renderWithProviders(
        <QuizActiveHeader
          {...defaultProps}
          layoutMode="focus"
          isForcedFlash={false}
          showSliderHint={false}
        />,
      );

      expect(screen.getByText('方向键 ← → 切换题目')).toBeInTheDocument();

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).not.toBeDisabled();
      expect(radios[1]).toHaveAttribute('aria-disabled', 'false');
    });
  });

  describe('TR-1.3 移动端强制闪卡', () => {
    it('isMobile=true + isForcedFlash=true → 切换器 focus 选项 aria-disabled=true', () => {
      renderWithProviders(
        <QuizActiveHeader
          {...defaultProps}
          isMobile={true}
          isForcedFlash={true}
          layoutMode="flash"
          showSliderHint={true}
        />,
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(radios[0]).not.toBeDisabled();
      expect(radios[0]).toHaveAttribute('aria-disabled', 'false');

      expect(radios[1]).toBeDisabled();
      expect(radios[1]).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('A11y 可访问性', () => {
    it('退出按钮 aria-label 非空；中心标题 role=heading + aria-level=2 正确', () => {
      renderWithProviders(<QuizActiveHeader {...defaultProps} />);

      const exitButton = screen.getByRole('button', {
        name: '退出',
      });
      expect(exitButton).toHaveAttribute('aria-label');
      expect(exitButton.getAttribute('aria-label')).not.toBe('');

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveAttribute('aria-level', '2');
      expect(heading).toHaveTextContent('答题模式');
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizSidebar } from '../../src/components/Study/QuizSidebar';
import { studyCardFactory } from '../helpers/factories';
import type { StudyCard } from '../../shared/types/common';

const cards: StudyCard[] = [
  studyCardFactory({ id: 'card-1', question: '题目甲' }),
  studyCardFactory({ id: 'card-2', question: '题目乙' }),
  studyCardFactory({ id: 'card-3', question: '题目丙' }),
];

const defaultProps = {
  quizCards: cards,
  currentCardIndex: 0,
  layoutMode: 'flash' as const,
  onChangeLayout: vi.fn(),
  isForcedFlash: false,
  onBackToDashboard: vi.fn(),
  onSelectCard: vi.fn(),
  isCollapsed: false,
  onToggleCollapsed: vi.fn(),
};

describe('QuizSidebar', () => {
  describe('展开态', () => {
    it('渲染退出按钮、进度 pill(1 / 3)、布局切换器与题目列表', () => {
      renderWithProviders(<QuizSidebar {...defaultProps} />);

      const exitButton = screen.getByRole('button', { name: '退出' });
      expect(exitButton).toBeInTheDocument();

      expect(screen.getByText('1 / 3')).toBeInTheDocument();
      expect(screen.getByText('进度')).toBeInTheDocument();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(screen.getByRole('radio', { name: /闪卡模式/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /专注模式/i })).toBeInTheDocument();

      expect(screen.getByText('题目甲')).toBeInTheDocument();
      expect(screen.getByText('题目乙')).toBeInTheDocument();
      expect(screen.getByText('题目丙')).toBeInTheDocument();
    });

    it('进度条 aria-valuenow 反映当前进度百分比', () => {
      const props = { ...defaultProps, currentCardIndex: 1 };
      renderWithProviders(<QuizSidebar {...props} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '67');
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('点击题目列表项 → 回调携带对应索引', () => {
      const onSelectCard = vi.fn();
      renderWithProviders(
        <QuizSidebar {...defaultProps} onSelectCard={onSelectCard} />,
      );

      fireEvent.click(screen.getByText('题目乙'));
      expect(onSelectCard).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByText('题目丙'));
      expect(onSelectCard).toHaveBeenCalledWith(2);
    });

    it('点击折叠按钮 → 触发 onToggleCollapsed', () => {
      const onToggleCollapsed = vi.fn();
      renderWithProviders(
        <QuizSidebar
          {...defaultProps}
          onToggleCollapsed={onToggleCollapsed}
        />,
      );

      const collapseBtn = screen.getByRole('button', {
        name: '折叠侧边栏',
      });
      fireEvent.click(collapseBtn);
      expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    });
  });

  describe('折叠态', () => {
    it('渲染垂直进度、百分比与编号索引，不含题干文本', () => {
      renderWithProviders(
        <QuizSidebar {...defaultProps} isCollapsed={true} currentCardIndex={2} />,
      );

      expect(screen.queryByText('题目甲')).not.toBeInTheDocument();
      expect(screen.queryByText('退出')).not.toBeInTheDocument();

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '100');

      const expandBtn = screen.getByRole('button', {
        name: '展开侧边栏',
      });
      expect(expandBtn).toBeInTheDocument();

      const numberedButtons = screen.getAllByRole('button', {
        name: /^第 [1-3] 题$/,
      });
      expect(numberedButtons).toHaveLength(3);
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-label',
        '3 / 3',
      );
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('点击编号 → 回调携带对应索引', () => {
      const onSelectCard = vi.fn();
      renderWithProviders(
        <QuizSidebar
          {...defaultProps}
          isCollapsed={true}
          onSelectCard={onSelectCard}
        />,
      );

      const buttons = screen.getAllByRole('button', {
        name: /^第 [1-3] 题$/,
      });
      fireEvent.click(buttons[2]);
      expect(onSelectCard).toHaveBeenCalledWith(2);
    });
  });

  describe('布局切换', () => {
    it('点击专注模式 → onChangeLayout("focus")；isForcedFlash 时焦点项禁用', () => {
      const onChangeLayout = vi.fn();
      renderWithProviders(
        <QuizSidebar {...defaultProps} onChangeLayout={onChangeLayout} />,
      );

      fireEvent.click(screen.getByRole('radio', { name: /专注模式/i }));
      expect(onChangeLayout).toHaveBeenCalledWith('focus');
    });

    it('isForcedFlash=true → focus 选项 disabled 且点击不触发切换', () => {
      const onChangeLayout = vi.fn();
      renderWithProviders(
        <QuizSidebar
          {...defaultProps}
          isForcedFlash={true}
          onChangeLayout={onChangeLayout}
        />,
      );

      const focusRadio = screen.getByRole('radio', { name: /专注模式/i });
      expect(focusRadio).toBeDisabled();
      fireEvent.click(focusRadio);
      expect(onChangeLayout).not.toHaveBeenCalled();
    });
  });
});

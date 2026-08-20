// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizLayoutSwitcher } from '../../src/components/Study/QuizLayoutSwitcher';

describe('QuizLayoutSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('结构与 ARIA', () => {
    it('渲染 role=radiogroup 容器和两个 role=radio 按钮', () => {
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="flash" onChange={() => {}} />,
      );
      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toBeInTheDocument();
      expect(radiogroup).toHaveAttribute('aria-label');

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
    });

    it('选中项 aria-checked=true，未选中项 false', () => {
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="focus" onChange={() => {}} />,
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toHaveAttribute('aria-checked', 'false');
      expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    });

    it('选中项 tabIndex=0，其余 -1', () => {
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="flash" onChange={() => {}} />,
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toHaveAttribute('tabindex', '0');
      expect(radios[1]).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('文本与标签', () => {
    it('显示 flash 与 focus 两个布局选项的翻译文本', () => {
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="flash" onChange={() => {}} />,
      );
      expect(screen.getByText('闪卡模式')).toBeInTheDocument();
      expect(screen.getByText('专注模式')).toBeInTheDocument();
    });
  });

  describe('onChange 切换', () => {
    it('点击 focus 选项触发 onChange(focus)', () => {
      const onChange = vi.fn();
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="flash" onChange={onChange} />,
      );
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[1]);
      expect(onChange).toHaveBeenCalledExactlyOnceWith('focus');
    });

    it('点击 flash 选项触发 onChange(flash)', () => {
      const onChange = vi.fn();
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="focus" onChange={onChange} />,
      );
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[0]);
      expect(onChange).toHaveBeenCalledExactlyOnceWith('flash');
    });
  });

  describe('disabled 状态（移动端）', () => {
    it('disabled=true 时仅 focus 按钮禁用，flash 仍可点击', () => {
      const onChange = vi.fn();
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="flash" onChange={onChange} disabled />,
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeDisabled();
      expect(radios[0]).toHaveAttribute('aria-disabled', 'false');
      fireEvent.click(radios[0]);
      expect(onChange).toHaveBeenCalledWith('flash');

      expect(radios[1]).toBeDisabled();
      expect(radios[1]).toHaveAttribute('aria-disabled', 'true');
      vi.clearAllMocks();
      fireEvent.click(radios[1]);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('disabled=true 时 focus 选项 aria-disabled=true 且不可点击', () => {
      const onChange = vi.fn();
      renderWithProviders(
        <QuizLayoutSwitcher layoutMode="flash" onChange={onChange} disabled />,
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[1]).toBeDisabled();
      expect(radios[1]).toHaveAttribute('aria-disabled', 'true');
    });
  });
});

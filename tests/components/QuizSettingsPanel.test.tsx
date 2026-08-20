// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizSettingsPanel } from '../../src/components/Study/QuizSettingsPanel';
import { useQuizSettingsStore } from '../../src/store/useQuizSettingsStore';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
};

describe('QuizSettingsPanel', () => {
  beforeEach(() => {
    useQuizSettingsStore.setState(useQuizSettingsStore.getInitialState());
  });

  describe('渲染', () => {
    it('isOpen=true 时渲染设置面板各分区与恢复默认按钮', () => {
      renderWithProviders(<QuizSettingsPanel {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('学习中心设置')).toBeInTheDocument();
      expect(screen.getByText('字号')).toBeInTheDocument();
      expect(screen.getByText('行距')).toBeInTheDocument();
      expect(screen.getByText('内容宽度')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '恢复默认设置' }),
      ).toBeInTheDocument();
    });

    it('isOpen=false 时不渲染面板', () => {
      renderWithProviders(<QuizSettingsPanel {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('字号滑杆', () => {
    it('默认显示 16px，拖动后更新 store 与显示值', () => {
      renderWithProviders(<QuizSettingsPanel {...defaultProps} />);

      const slider = screen.getByRole('slider', { name: '字号' });
      expect(slider).toHaveValue('16');
      expect(useQuizSettingsStore.getState().fontSize).toBe(16);

      fireEvent.change(slider, { target: { value: '20' } });

      expect(useQuizSettingsStore.getState().fontSize).toBe(20);
      expect(slider).toHaveValue('20');
    });
  });

  describe('行距选择', () => {
    it('默认选中「标准」，点击「宽松」后更新 store', () => {
      renderWithProviders(<QuizSettingsPanel {...defaultProps} />);

      const normalRadio = screen.getByRole('radio', { name: '标准' });
      expect(normalRadio).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(screen.getByRole('radio', { name: '宽松' }));

      expect(useQuizSettingsStore.getState().lineHeight).toBe('relaxed');
      expect(screen.getByRole('radio', { name: '宽松' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(
        screen.getByRole('radio', { name: '标准' }),
      ).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('内容宽度选择', () => {
    it('默认选中「舒适」，点击「全宽」后更新 store', () => {
      renderWithProviders(<QuizSettingsPanel {...defaultProps} />);

      const comfortableRadio = screen.getByRole('radio', { name: '舒适' });
      expect(comfortableRadio).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(screen.getByRole('radio', { name: '全宽' }));

      expect(useQuizSettingsStore.getState().contentWidthMode).toBe('full');
      expect(screen.getByRole('radio', { name: '全宽' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });
  });

  describe('恢复默认', () => {
    it('修改字号后点击恢复默认 → 回到默认值', () => {
      renderWithProviders(<QuizSettingsPanel {...defaultProps} />);

      fireEvent.change(screen.getByRole('slider', { name: '字号' }), {
        target: { value: '24' },
      });
      expect(useQuizSettingsStore.getState().fontSize).toBe(24);

      fireEvent.click(screen.getByRole('button', { name: '恢复默认设置' }));

      expect(useQuizSettingsStore.getState()).toMatchObject({
        fontSize: 16,
        lineHeight: 'normal',
        contentWidthMode: 'comfortable',
      });
      expect(screen.getByRole('slider', { name: '字号' })).toHaveValue('16');
    });
  });

  describe('关闭', () => {
    it('点击关闭按钮触发 onClose', () => {
      const onClose = vi.fn();
      renderWithProviders(<QuizSettingsPanel {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: '关闭' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

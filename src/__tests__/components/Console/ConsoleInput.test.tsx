// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ConsoleInput, type ConsoleInputRef } from '../../../components/Console/ConsoleInput';
import i18n from '../../../i18n';

// Initialize i18n with Chinese translations so t() returns real strings
i18n.changeLanguage('zh-CN');

const mockGetAutocompleteSuggestions = vi.fn();
const mockHistory: Array<{ id: string; command: string; timestamp: number }> = [
  { id: '1', command: 'help', timestamp: Date.now() - 3000 },
  { id: '2', command: 'version', timestamp: Date.now() - 2000 },
  { id: '3', command: 'clear', timestamp: Date.now() - 1000 },
];

vi.mock('../../../services/console', () => ({
  commandRegistry: {
    execute: vi.fn(),
    find: vi.fn(),
    getAutocompleteSuggestions: (...args: unknown[]) => mockGetAutocompleteSuggestions(...args),
  },
}));

describe('ConsoleInput 历史命令导航功能', () => {
  let ref: React.RefObject<ConsoleInputRef>;
  let onChange: (value: string) => void;
  let onSubmit: (command: string) => void;

  beforeEach(() => {
    ref = React.createRef<ConsoleInputRef>();
    onChange = vi.fn();
    onSubmit = vi.fn();
    mockGetAutocompleteSuggestions.mockReturnValue([]);
  });

  describe('ArrowUp 导航历史命令', () => {
    it('按 ArrowUp 应该显示上一条历史命令', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onChange).toHaveBeenCalledWith('clear');
    });

    it('连续按 ArrowUp 应该遍历所有历史记录', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith('clear');
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith('version');
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith('help');
    });
  });

  describe('ArrowDown 导航和恢复', () => {
    it('按 ArrowDown 应该返回下一条历史命令', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onChange).toHaveBeenLastCalledWith('version');
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith('help');
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(onChange).toHaveBeenLastCalledWith('version');
    });
  });

  describe('空历史记录处理', () => {
    it('空历史记录时按 ArrowUp 不应该响应', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={[]}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('空历史记录时按 ArrowDown 不应该响应', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={[]}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('与自动补全的优先级协调', () => {
    it('有补全建议时 ArrowUp 应该导航补全列表而非历史', () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
        { value: 'history', description: '显示历史', type: 'command' },
      ]);

      render(
        <ConsoleInput
          ref={ref}
          value="h"
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(screen.getByText('help')).toBeInTheDocument();
    });

    it('关闭补全后恢复正常历史导航', async () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
      ]);

      const { rerender } = render(
        <ConsoleInput
          ref={ref}
          value="h"
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      await waitFor(() => {
        expect(screen.getByText('help')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      mockGetAutocompleteSuggestions.mockReturnValue([]);
      
      rerender(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onChange).toHaveBeenCalledWith('clear');
    });
  });

  describe('focus ref 方法', () => {
    it('focus 方法应该可以调用', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );
      
      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.focus).toBe('function');
    });

    it('调用 focus 不应该抛出错误', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );
      
      expect(() => {
        ref.current?.focus();
      }).not.toThrow();
    });
  });

  describe('加载状态', () => {
    it('加载状态时应该禁用输入框', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          isLoading={true}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/) as HTMLInputElement;
      
      expect(input.disabled).toBe(true);
    });

    it('加载状态时应该显示加载图标', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          isLoading={true}
        />
      );
      
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('确认模式', () => {
    it('确认模式激活时应该改变 placeholder', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          pendingConfirmActive={true}
        />
      );

      const input = screen.getByPlaceholderText(/输入 y 确认/);
      
      expect(input).toBeInTheDocument();
    });

    it('确认模式下按 Enter 提交 y 应该调用 onSubmit', () => {
      render(
        <ConsoleInput
          ref={ref}
          value="y"
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          pendingConfirmActive={true}
        />
      );

      const input = screen.getByPlaceholderText(/输入 y 确认/);
      
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onSubmit).toHaveBeenCalledWith('y');
    });

    it('确认模式下按 Escape 应该取消', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          pendingConfirmActive={true}
        />
      );

      const input = screen.getByPlaceholderText(/输入 y 确认/);
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      expect(onSubmit).toHaveBeenCalledWith('n');
    });
  });

  describe('主题切换', () => {
    it('浅色主题应该应用正确的样式', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );

      const container = document.querySelector('.bg-white');
      expect(container).toBeInTheDocument();
    });

    it('深色主题应该应用正确的样式', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={true}
        />
      );

      const container = document.querySelector('.bg-slate-900');
      expect(container).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('单条历史记录应该正常工作', () => {
      const singleHistory = [{ id: '1', command: 'only one', timestamp: Date.now() }];
      
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={singleHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onChange).toHaveBeenCalledWith('only one');
    });

    it('输入框值为空时可以导航历史', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
          history={mockHistory}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      expect(onChange).toHaveBeenCalledWith('clear');
    });
  });

  describe('搜索模式 (Ctrl+R)', () => {
    it('按 Ctrl+R 应该进入搜索模式', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'r', ctrlKey: true });
      
      expect(screen.getByPlaceholderText(/输入搜索关键词/)).toBeInTheDocument();
    });
  });

  describe('Enter 键提交', () => {
    it('按 Enter 应该提交非空命令', () => {
      render(
        <ConsoleInput
          ref={ref}
          value="test command"
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onSubmit).toHaveBeenCalledWith('test command');
    });

    it('不应该提交空命令', () => {
      render(
        <ConsoleInput
          ref={ref}
          value=""
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Tab 补全功能', () => {
    it('按 Tab 应该选择第一个补全建议', () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
      ]);

      render(
        <ConsoleInput
          ref={ref}
          value="hel"
          onChange={onChange}
          onSubmit={onSubmit}
          isDark={false}
        />
      );

      const input = screen.getByPlaceholderText(/输入命令/);
      
      fireEvent.keyDown(input, { key: 'Tab' });
      
      expect(onChange).toHaveBeenCalledWith('help ');
    });
  });
});

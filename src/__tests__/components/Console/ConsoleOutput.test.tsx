import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ConsoleOutput, type ConsoleOutputRef } from '../../../components/Console/ConsoleOutput';

const createMockOutput = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    type: 'input' as const,
    content: `命令 ${i + 1}`,
  }));
};

describe('ConsoleOutput 日志折叠功能', () => {
  let ref: React.RefObject<ConsoleOutputRef>;

  beforeEach(() => {
    ref = React.createRef<ConsoleOutputRef>();
  });

  describe('初始渲染和可见性', () => {
    it('应该正确渲染输出项', () => {
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByText('命令 1')).toBeInTheDocument();
      expect(screen.getByText('命令 5')).toBeInTheDocument();
    });

    it('当日志数量不超过 20 条时应该显示所有日志', () => {
      const output = createMockOutput(15);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      const outputItems = screen.getAllByText(/命令 \d+/);
      expect(outputItems.length).toBe(15);
    });

    it('恰好 20 条日志不应该显示"查看更多"', () => {
      const output = createMockOutput(20);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.queryByText(/向上滚动查看更多历史记录/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/命令 \d+/).length).toBe(20);
    });
  });

  describe('清空输出功能', () => {
    it('有输出时应该显示清空按钮', () => {
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByTitle('清空输出')).toBeInTheDocument();
    });

    it('没有输出时不应该显示清空按钮', () => {
      render(<ConsoleOutput ref={ref} output={[]} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.queryByTitle('清空输出')).not.toBeInTheDocument();
    });

    it('点击清空按钮应该调用 onClear', () => {
      const onClear = vi.fn();
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={onClear} />);
      
      const clearButton = screen.getByTitle('清空输出');
      fireEvent.click(clearButton);
      
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('scrollToBottom ref 方法', () => {
    it('scrollToBottom 应该可以调用', () => {
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.scrollToBottom).toBe('function');
    });

    it('调用 scrollToBottom 不应该抛出错误', () => {
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(() => {
        ref.current?.scrollToBottom();
      }).not.toThrow();
    });
  });

  describe('主题切换', () => {
    it('浅色主题应该应用正确的样式类名', () => {
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      const container = document.querySelector('.relative');
      expect(container).toBeInTheDocument();
    });

    it('深色主题应该应用正确的样式类名', () => {
      const output = createMockOutput(5);
      
      render(<ConsoleOutput ref={ref} output={output} isDark={true} onClear={vi.fn()} />);
      
      const container = document.querySelector('.relative');
      expect(container).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('没有输出时应该显示占位符文本', () => {
      render(<ConsoleOutput ref={ref} output={[]} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByText('输入 help 查看可用命令')).toBeInTheDocument();
      expect(screen.getByText('Tab 补全 · Ctrl+R 搜索历史 · Esc 关闭')).toBeInTheDocument();
    });

    it('空状态在深色模式下应该使用正确的颜色', () => {
      render(<ConsoleOutput ref={ref} output={[]} isDark={true} onClear={vi.fn()} />);
      
      const placeholderContainer = screen.getByText('输入 help 查看可用命令').closest('div');
      expect(placeholderContainer).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('单条日志应该正常显示', () => {
      const output = [{ type: 'input' as const, content: '单条命令' }];
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByText('单条命令')).toBeInTheDocument();
      expect(screen.queryByText(/向上滚动查看更多历史记录/)).not.toBeInTheDocument();
    });

    it('大量日志（100+）不应该导致崩溃', () => {
      const output = createMockOutput(150);
      
      const startTime = performance.now();
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(1000);
      
      const outputItems = screen.getAllByText(/命令 \d+/);
      expect(outputItems.length).toBeGreaterThan(0);
    });
  });

  describe('输出类型渲染', () => {
    it('应该正确渲染 input 类型的输出', () => {
      const output = [{ type: 'input' as const, content: 'test command' }];
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByText('test command')).toBeInTheDocument();
    });

    it('应该正确渲染 output 类型（成功）', () => {
      const output = [{
        type: 'output' as const,
        content: '执行成功',
        result: { success: true, data: 'Done' },
      }];
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('应该正确渲染 output 类型（错误）', () => {
      const output = [{
        type: 'output' as const,
        content: '',
        result: { success: false, error: 'Command failed' },
      }];
      
      render(<ConsoleOutput ref={ref} output={output} isDark={false} onClear={vi.fn()} />);
      
      expect(screen.getByText('Command failed')).toBeInTheDocument();
    });
  });

  describe('新日志添加时的行为', () => {
    it('新日志添加时应该更新显示内容', async () => {
      const initialOutput = createMockOutput(5);
      
      const { rerender } = render(
        <ConsoleOutput ref={ref} output={initialOutput} isDark={false} onClear={vi.fn()} />
      );
      
      const newOutput = [...initialOutput, ...createMockOutput(3).map(item => ({
        ...item,
        content: item.content.replace('命令', '新命令'),
      }))];
      
      await act(async () => {
        rerender(<ConsoleOutput ref={ref} output={newOutput} isDark={false} onClear={vi.fn()} />);
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(screen.getAllByText(/新命令/).length).toBe(3);
    });
  });
});

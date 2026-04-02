import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Console } from '../../../components/Console/Console';
import type { CommandContext } from '../../../services/console';

const mockContext: CommandContext = {
  userId: 'test-user-id',
  consoleId: 'test-console-id',
};

const mockExecute = vi.fn();
const mockFind = vi.fn();
const mockGetAutocompleteSuggestions = vi.fn();

vi.mock('../../../services/console', () => ({
  commandRegistry: {
    execute: (...args: unknown[]) => mockExecute(...args),
    find: (...args: unknown[]) => mockFind(...args),
    getAutocompleteSuggestions: (...args: unknown[]) => mockGetAutocompleteSuggestions(...args),
  },
}));

vi.mock('../../../hooks', () => ({
  useTheme: () => ({
    isDark: false,
    theme: 'light',
    themeMode: 'light',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
  },
});

describe('Console', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    context: mockContext,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockExecute.mockResolvedValue({ success: true, message: 'Command executed' });
    mockFind.mockReturnValue(undefined);
    mockGetAutocompleteSuggestions.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('控制台打开/关闭', () => {
    it('应该在 isOpen 为 true 时渲染', () => {
      render(<Console {...defaultProps} />);
      
      expect(screen.getByText('控制台')).toBeInTheDocument();
    });

    it('应该在 isOpen 为 false 时不渲染', () => {
      render(<Console {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('控制台')).not.toBeInTheDocument();
    });

    it('应该点击关闭按钮时调用 onClose', () => {
      render(<Console {...defaultProps} />);
      
      const closeButton = screen.getByTitle('关闭');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('应该按 Escape 键时调用 onClose', () => {
      render(<Console {...defaultProps} />);
      
      fireEvent.keyDown(window, { key: 'Escape' });
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('应该按 Ctrl+Shift+C 时调用 onClose', () => {
      render(<Console {...defaultProps} />);
      
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true, shiftKey: true });
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('应该点击外部区域时调用 onClose', () => {
      const { container } = render(<Console {...defaultProps} />);
      
      const consoleElement = container.querySelector('.fixed');
      if (consoleElement) {
        fireEvent.mouseDown(document.body);
      }
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('命令输入和执行', () => {
    it('应该显示输入提示', () => {
      render(<Console {...defaultProps} />);
      
      expect(screen.getByPlaceholderText(/输入命令/)).toBeInTheDocument();
    });

    it('应该能够输入命令', () => {
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'help' } });
      
      expect(input).toHaveValue('help');
    });

    it('应该按 Enter 执行命令', async () => {
      mockFind.mockReturnValue({
        name: 'help',
        permission: 'safe',
        handler: vi.fn().mockResolvedValue({ success: true, message: 'Help displayed' }),
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith('help', mockContext);
      });
    });

    it('应该显示命令执行结果', async () => {
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Command executed successfully',
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('Command executed successfully')).toBeInTheDocument();
      });
    });

    it('应该显示错误信息', async () => {
      mockExecute.mockResolvedValueOnce({
        success: false,
        error: 'Command failed',
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('Command failed')).toBeInTheDocument();
      });
    });

    it('应该不执行空命令', async () => {
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('应该清空输入框后执行命令', async () => {
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('历史记录功能', () => {
    it('应该显示历史记录按钮', () => {
      render(<Console {...defaultProps} />);
      
      expect(screen.getByTitle('历史记录')).toBeInTheDocument();
    });

    it('应该点击历史记录按钮显示历史面板', () => {
      render(<Console {...defaultProps} />);
      
      const historyButton = screen.getByTitle('历史记录');
      fireEvent.click(historyButton);
      
      expect(screen.getByText('历史记录')).toBeInTheDocument();
    });

    it('应该保存命令到历史记录', async () => {
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Done',
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });
      
      const historyButton = screen.getByTitle('历史记录');
      fireEvent.click(historyButton);
      
      await waitFor(() => {
        const historyItems = screen.getAllByText('help');
        expect(historyItems.length).toBeGreaterThan(0);
      });
    });

    it('应该点击历史记录项填充命令', async () => {
      mockLocalStorage.setItem(
        'knowledgeMap_consoleHistory',
        JSON.stringify([
          { id: '1', command: 'graph list', timestamp: Date.now(), result: { success: true } },
        ])
      );
      
      render(<Console {...defaultProps} />);
      
      const historyButton = screen.getByTitle('历史记录');
      fireEvent.click(historyButton);
      
      await waitFor(() => {
        expect(screen.getByText('graph list')).toBeInTheDocument();
      });
      
      const historyItem = screen.getByText('graph list');
      fireEvent.click(historyItem);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      expect(input).toHaveValue('graph list');
    });

    it('应该能够清空历史记录', async () => {
      mockLocalStorage.setItem(
        'knowledgeMap_consoleHistory',
        JSON.stringify([
          { id: '1', command: 'test', timestamp: Date.now() },
        ])
      );
      
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<Console {...defaultProps} />);
      
      const historyButton = screen.getByTitle('历史记录');
      fireEvent.click(historyButton);
      
      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument();
      });
      
      const clearButton = screen.getByTitle('清空历史');
      fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getByText('暂无历史记录')).toBeInTheDocument();
      });
    });
  });

  describe('自动补全功能', () => {
    it('应该显示自动补全建议', () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
        { value: 'history', description: '显示历史', type: 'command' },
      ]);
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'h' } });
      
      expect(screen.getByText('help')).toBeInTheDocument();
      expect(screen.getByText('history')).toBeInTheDocument();
    });

    it('应该按 Tab 选择建议', () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
      ]);
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'h' } });
      fireEvent.keyDown(input, { key: 'Tab' });
      
      expect(input).toHaveValue('help ');
    });

    it('应该按 Enter 选择建议', () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
      ]);
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'h' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(input).toHaveValue('help ');
    });

    it('应该按 Escape 关闭建议列表', async () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
      ]);
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'h' } });
      
      await waitFor(() => {
        expect(screen.getByText(/↑↓ 导航/)).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByText(/↑↓ 导航/)).not.toBeInTheDocument();
      });
    });

    it('应该用箭头键导航建议', () => {
      mockGetAutocompleteSuggestions.mockReturnValue([
        { value: 'help', description: '显示帮助', type: 'command' },
        { value: 'history', description: '显示历史', type: 'command' },
      ]);
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'h' } });
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(input).toHaveValue('history ');
    });
  });

  describe('权限确认', () => {
    it('应该对危险命令显示确认对话框', async () => {
      mockFind.mockReturnValue({
        name: 'delete',
        permission: 'danger',
        handler: vi.fn().mockResolvedValue({ success: true }),
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'delete all' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('危险操作确认')).toBeInTheDocument();
      });
    });

    it('应该对警告命令显示确认对话框', async () => {
      mockFind.mockReturnValue({
        name: 'reset',
        permission: 'warning',
        handler: vi.fn().mockResolvedValue({ success: true }),
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'reset' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('操作确认')).toBeInTheDocument();
      });
    });

    it('应该确认后执行危险命令', async () => {
      mockFind.mockReturnValue({
        name: 'delete',
        permission: 'danger',
        handler: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'delete all' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('危险操作确认')).toBeInTheDocument();
      });
      
      const confirmInput = screen.getByPlaceholderText(/输入 CONFIRM/);
      fireEvent.change(confirmInput, { target: { value: 'CONFIRM' } });
      
      const confirmButton = screen.getByText('确认').closest('button');
      if (confirmButton) {
        fireEvent.click(confirmButton);
      }
      
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });
    });

    it('应该取消后不执行命令', async () => {
      mockFind.mockReturnValue({
        name: 'delete',
        permission: 'danger',
        handler: vi.fn(),
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'delete all' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('危险操作确认')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);
      
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('清空输出', () => {
    it('应该显示清空按钮当有输出时', async () => {
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Test output',
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByTitle('清空输出')).toBeInTheDocument();
      });
    });

    it('应该清空输出', async () => {
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Test output',
      });
      
      render(<Console {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByText('Test output')).toBeInTheDocument();
      });
      
      const clearButton = screen.getByTitle('清空输出');
      fireEvent.click(clearButton);
      
      expect(screen.queryByText('Test output')).not.toBeInTheDocument();
    });
  });

  describe('最小化功能', () => {
    it('应该显示最小化按钮当提供 onToggleMinimize', () => {
      render(<Console {...defaultProps} onToggleMinimize={vi.fn()} />);
      
      expect(screen.getByTitle('最小化')).toBeInTheDocument();
    });

    it('应该调用 onToggleMinimize 当点击最小化按钮', () => {
      const onToggleMinimize = vi.fn();
      render(<Console {...defaultProps} onToggleMinimize={onToggleMinimize} />);
      
      const minimizeButton = screen.getByTitle('最小化');
      fireEvent.click(minimizeButton);
      
      expect(onToggleMinimize).toHaveBeenCalled();
    });
  });
});

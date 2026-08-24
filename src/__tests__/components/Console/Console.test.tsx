// @vitest-environment jsdom
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Console } from '../../../components/Console/Console';
import type { CommandContext } from '../../../services/console';
import { renderWithProviders } from '../../../../tests/helpers/renderWithProviders';
import { useConsoleStore } from '../../../store/useConsoleStore';
import i18n from '../../../i18n';

// Initialize i18n with Chinese translations so t() returns real strings
i18n.changeLanguage('zh-CN');

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

vi.mock('../../../utils/asyncConfirm', () => ({
  asyncConfirm: vi.fn().mockResolvedValue(true),
}));

// crypto.randomUUID polyfill for jsdom (used by addToHistory)
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${  Math.random().toString(36).substring(7)}`,
  },
});

describe('Console', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    context: mockContext,
  };

  beforeEach(() => {
    // Targeted reset of the only store Console directly uses.
    useConsoleStore.setState(useConsoleStore.getInitialState());
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ success: true, message: 'Command executed' });
    mockFind.mockReturnValue(undefined);
    mockGetAutocompleteSuggestions.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('控制台打开/关闭', () => {
    it('应该在 isOpen 为 true 时渲染', () => {
      renderWithProviders(<Console {...defaultProps} />);

      expect(screen.getByText('控制台')).toBeInTheDocument();
    });

    it('应该在 isOpen 为 false 时不渲染', () => {
      renderWithProviders(<Console {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('控制台')).not.toBeInTheDocument();
    });

    it('应该点击关闭按钮时调用 onClose', () => {
      renderWithProviders(<Console {...defaultProps} />);

      const closeButton = screen.getByTitle('关闭');
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('应该按 Escape 键时调用 onClose', () => {
      renderWithProviders(<Console {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('命令执行集成流程', () => {
    it('应该按 Enter 执行命令并调用 commandRegistry.execute', async () => {
      mockFind.mockReturnValue({
        name: 'help',
        permission: 'safe',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith('help', mockContext);
      });
    });

    it('应该显示命令执行结果', async () => {
      mockFind.mockReturnValue({ name: 'test', permission: 'safe' });
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Command executed successfully',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Command executed successfully')).toBeInTheDocument();
      });
    });

    it('应该显示错误信息', async () => {
      mockFind.mockReturnValue({ name: 'test', permission: 'safe' });
      mockExecute.mockResolvedValueOnce({
        success: false,
        error: 'Command failed',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Command failed')).toBeInTheDocument();
      });
    });

    it('应该清空输入框后执行命令', async () => {
      mockFind.mockReturnValue({ name: 'help', permission: 'safe' });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('执行命令后应该只产生一条输入回显', async () => {
      mockFind.mockReturnValue({ name: 'test', permission: 'safe' });
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Test output',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Test output')).toBeInTheDocument();
      });

      const outputs = useConsoleStore.getState().output;
      const inputEchoes = outputs.filter(item => item.type === 'input');
      expect(inputEchoes).toHaveLength(1);
      expect(inputEchoes[0]?.content).toBe('test');
    });
  });

  describe('历史记录功能', () => {
    it('应该显示历史记录按钮', () => {
      renderWithProviders(<Console {...defaultProps} />);

      expect(screen.getByTitle('历史记录')).toBeInTheDocument();
    });

    it('应该点击历史记录按钮显示历史面板', () => {
      renderWithProviders(<Console {...defaultProps} />);

      const historyButton = screen.getByTitle('历史记录');
      fireEvent.click(historyButton);

      expect(screen.getByText('历史记录')).toBeInTheDocument();
    });

    it('应该保存命令到历史记录', async () => {
      mockFind.mockReturnValue({ name: 'help', permission: 'safe' });
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Done',
      });

      renderWithProviders(<Console {...defaultProps} />);

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
      useConsoleStore.setState({
        history: [
          { id: '1', command: 'graph list', timestamp: Date.now(), result: { success: true } },
        ],
      });

      renderWithProviders(<Console {...defaultProps} />);

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
      useConsoleStore.setState({
        history: [
          { id: '1', command: 'test', timestamp: Date.now(), result: { success: true } },
        ],
      });

      renderWithProviders(<Console {...defaultProps} />);

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

  describe('权限确认', () => {
    it('应该对危险命令显示确认提示', async () => {
      mockFind.mockReturnValue({
        name: 'delete',
        permission: 'danger',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'delete all' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/危险操作确认/)).toBeInTheDocument();
      });
    });

    it('应该对警告命令显示确认提示', async () => {
      mockFind.mockReturnValue({
        name: 'reset',
        permission: 'warning',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'reset' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/操作确认/)).toBeInTheDocument();
      });
    });

    it('应该输入 y 确认后执行危险命令', async () => {
      mockFind.mockReturnValue({
        name: 'delete',
        permission: 'danger',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'delete all' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/危险操作确认/)).toBeInTheDocument();
      });

      // Input switches to confirm mode with y/n placeholder
      const confirmInput = screen.getByPlaceholderText(/输入 y 确认/);
      fireEvent.change(confirmInput, { target: { value: 'y' } });
      fireEvent.keyDown(confirmInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith('delete all', mockContext);
      });
    });

    it('应该输入 n 取消后不执行命令', async () => {
      mockFind.mockReturnValue({
        name: 'delete',
        permission: 'danger',
      });

      renderWithProviders(<Console {...defaultProps} />);

      const input = screen.getByPlaceholderText(/输入命令/);
      fireEvent.change(input, { target: { value: 'delete all' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText(/危险操作确认/)).toBeInTheDocument();
      });

      const confirmInput = screen.getByPlaceholderText(/输入 y 确认/);
      fireEvent.change(confirmInput, { target: { value: 'n' } });
      fireEvent.keyDown(confirmInput, { key: 'Enter' });

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('清空输出', () => {
    it('应该清空输出', async () => {
      mockFind.mockReturnValue({ name: 'test', permission: 'safe' });
      mockExecute.mockResolvedValueOnce({
        success: true,
        message: 'Test output',
      });

      renderWithProviders(<Console {...defaultProps} />);

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
      renderWithProviders(<Console {...defaultProps} onToggleMinimize={vi.fn()} />);

      expect(screen.getByTitle('最小化')).toBeInTheDocument();
    });

    it('应该调用 onToggleMinimize 当点击最小化按钮', () => {
      const onToggleMinimize = vi.fn();
      renderWithProviders(<Console {...defaultProps} onToggleMinimize={onToggleMinimize} />);

      const minimizeButton = screen.getByTitle('最小化');
      fireEvent.click(minimizeButton);

      expect(onToggleMinimize).toHaveBeenCalled();
    });
  });
});

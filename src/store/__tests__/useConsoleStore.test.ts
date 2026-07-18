// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useConsoleStore, type OutputItem } from '../useConsoleStore';

describe('useConsoleStore', () => {
  beforeEach(() => {
    useConsoleStore.setState({
      isOpen: false,
      isMinimized: false,
      input: '',
      history: [],
      output: [],
      isLoading: false,
      confirmState: {
        isOpen: false,
        type: 'warning',
        title: '',
        message: '',
        onConfirm: () => {},
      },
      pendingConfirm: {
        active: false,
        command: '',
        message: '',
        onConfirm: () => {},
        onCancel: () => {},
      },
    });
  });

  it('应该有正确的初始状态', () => {
    const state = useConsoleStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.isMinimized).toBe(false);
    expect(state.input).toBe('');
    expect(state.history).toEqual([]);
    expect(state.output).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.confirmState.isOpen).toBe(false);
    expect(state.pendingConfirm.active).toBe(false);
  });

  it('应该能通过 open 打开控制台', () => {
    useConsoleStore.getState().open();
    const state = useConsoleStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.isMinimized).toBe(false);
  });

  it('应该能通过 close 关闭控制台', () => {
    useConsoleStore.getState().open();
    useConsoleStore.getState().close();
    expect(useConsoleStore.getState().isOpen).toBe(false);
  });

  it('应该能通过 toggle 切换控制台开关', () => {
    expect(useConsoleStore.getState().isOpen).toBe(false);
    useConsoleStore.getState().toggle();
    expect(useConsoleStore.getState().isOpen).toBe(true);
    useConsoleStore.getState().toggle();
    expect(useConsoleStore.getState().isOpen).toBe(false);
  });

  it('应该能通过 toggleMinimize 切换最小化', () => {
    expect(useConsoleStore.getState().isMinimized).toBe(false);
    useConsoleStore.getState().toggleMinimize();
    expect(useConsoleStore.getState().isMinimized).toBe(true);
  });

  it('应该能通过 addToHistory 添加历史记录', () => {
    useConsoleStore.getState().addToHistory('help');
    const history = useConsoleStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0].command).toBe('help');
    expect(history[0].id).toBeDefined();
    expect(history[0].timestamp).toBeGreaterThan(0);
  });

  it('addToHistory 应对相同命令去重并置顶', () => {
    useConsoleStore.getState().addToHistory('help');
    useConsoleStore.getState().addToHistory('status');
    useConsoleStore.getState().addToHistory('help');
    const history = useConsoleStore.getState().history;
    expect(history).toHaveLength(2);
    expect(history[0].command).toBe('help');
    expect(history[1].command).toBe('status');
  });

  it('应该能通过 clearHistory 清空历史记录', () => {
    useConsoleStore.getState().addToHistory('help');
    useConsoleStore.getState().addToHistory('status');
    useConsoleStore.getState().clearHistory();
    expect(useConsoleStore.getState().history).toEqual([]);
  });

  it('应该能通过 addOutput 添加输出项', () => {
    const item: OutputItem = { type: 'input', content: 'test command' };
    useConsoleStore.getState().addOutput(item);
    expect(useConsoleStore.getState().output).toHaveLength(1);
    expect(useConsoleStore.getState().output[0]).toEqual(item);
  });

  it('应该能通过 clearOutput 清空输出', () => {
    useConsoleStore.getState().addOutput({ type: 'input', content: 'cmd' });
    useConsoleStore.getState().clearOutput();
    expect(useConsoleStore.getState().output).toEqual([]);
  });

  it('应该能通过 setPendingConfirm 设置待确认状态并清空输入', () => {
    useConsoleStore.getState().setInput('some input');
    useConsoleStore.getState().setPendingConfirm({
      active: true,
      command: 'delete',
      message: '确认删除？',
      onConfirm: () => {},
      onCancel: () => {},
    });
    const state = useConsoleStore.getState();
    expect(state.pendingConfirm.active).toBe(true);
    expect(state.pendingConfirm.command).toBe('delete');
    expect(state.input).toBe('');
  });

  it('应该能通过 cancelConfirm 重置确认状态', () => {
    useConsoleStore.getState().setConfirmState({
      isOpen: true,
      type: 'danger',
      title: '警告',
      message: '确定继续？',
      onConfirm: () => {},
    });
    useConsoleStore.getState().cancelConfirm();
    const state = useConsoleStore.getState();
    expect(state.confirmState.isOpen).toBe(false);
    expect(state.confirmState.type).toBe('warning');
  });
});

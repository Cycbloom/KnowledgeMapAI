// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useFocusStore } from '../useFocusStore';
import { DEFAULT_FOCUS_SETTINGS } from '../../constants/focusSettings';

describe('useFocusStore', () => {
  beforeEach(() => {
    useFocusStore.setState({
      focusDuration: DEFAULT_FOCUS_SETTINGS.focusDuration,
      shortBreakDuration: DEFAULT_FOCUS_SETTINGS.shortBreakDuration,
      longBreakDuration: DEFAULT_FOCUS_SETTINGS.longBreakDuration,
      longBreakInterval: DEFAULT_FOCUS_SETTINGS.longBreakInterval,
      autoStartBreak: DEFAULT_FOCUS_SETTINGS.autoStartBreak,
      autoStartPomodoro: DEFAULT_FOCUS_SETTINGS.autoStartPomodoro,
      soundEnabled: DEFAULT_FOCUS_SETTINGS.soundEnabled,
      notificationEnabled: DEFAULT_FOCUS_SETTINGS.notificationEnabled,
      isInFocusMode: false,
      highlightEnabled: false,
      highlightIntensity: 0.5,
      currentNodeId: null,
    });
  });

  it('应该有正确的初始状态', () => {
    const state = useFocusStore.getState();
    expect(state.focusDuration).toBe(25);
    expect(state.shortBreakDuration).toBe(5);
    expect(state.longBreakDuration).toBe(15);
    expect(state.longBreakInterval).toBe(4);
    expect(state.autoStartBreak).toBe(true);
    expect(state.autoStartPomodoro).toBe(false);
    expect(state.soundEnabled).toBe(true);
    expect(state.notificationEnabled).toBe(true);
    expect(state.isInFocusMode).toBe(false);
    expect(state.highlightEnabled).toBe(false);
    expect(state.highlightIntensity).toBe(0.5);
    expect(state.currentNodeId).toBe(null);
  });

  it('应该能通过 updateSettings 部分更新设置', () => {
    useFocusStore.getState().updateSettings({ focusDuration: 30, soundEnabled: false });
    const state = useFocusStore.getState();
    expect(state.focusDuration).toBe(30);
    expect(state.soundEnabled).toBe(false);
    // 未更新的字段应保持不变
    expect(state.shortBreakDuration).toBe(5);
    expect(state.notificationEnabled).toBe(true);
  });

  it('应该能通过 enterFocusMode 进入专注模式', () => {
    useFocusStore.getState().enterFocusMode('node-1');
    const state = useFocusStore.getState();
    expect(state.isInFocusMode).toBe(true);
    expect(state.currentNodeId).toBe('node-1');
  });

  it('enterFocusMode 不传 nodeId 时 currentNodeId 应为 null', () => {
    useFocusStore.getState().enterFocusMode();
    const state = useFocusStore.getState();
    expect(state.isInFocusMode).toBe(true);
    expect(state.currentNodeId).toBe(null);
  });

  it('应该能通过 exitFocusMode 退出专注模式', () => {
    useFocusStore.getState().enterFocusMode('node-1');
    useFocusStore.getState().exitFocusMode();
    expect(useFocusStore.getState().isInFocusMode).toBe(false);
  });

  it('应该能通过 setHighlightEnabled 切换高亮', () => {
    useFocusStore.getState().setHighlightEnabled(true);
    expect(useFocusStore.getState().highlightEnabled).toBe(true);
    useFocusStore.getState().setHighlightEnabled(false);
    expect(useFocusStore.getState().highlightEnabled).toBe(false);
  });

  it('应该能通过 setHighlightIntensity 更新高亮强度', () => {
    useFocusStore.getState().setHighlightIntensity(0.8);
    expect(useFocusStore.getState().highlightIntensity).toBe(0.8);
  });
});

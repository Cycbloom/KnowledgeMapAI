// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTimerStore } from '../useTimerStore';
import { useFocusStore } from '../useFocusStore';
import { DEFAULT_FOCUS_SETTINGS } from '../../constants/focusSettings';

describe('useTimerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // 重置 timer store 到初始状态
    const focusDuration = DEFAULT_FOCUS_SETTINGS.focusDuration;
    useTimerStore.setState({
      taskId: null,
      subtaskId: null,
      queueLevel: 0,
      mode: 'focus',
      timeLeft: focusDuration * 60,
      totalTime: focusDuration * 60,
      isActive: false,
      isPaused: false,
      completedSessions: 0,
      startTimeRef: null,
      progress: 0,
      onFocusSessionComplete: undefined,
    });

    // 重置 focus store 到默认设置（transitionToNextMode 依赖此 store）
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

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('应该有正确的初始状态', () => {
    const state = useTimerStore.getState();
    expect(state.taskId).toBe(null);
    expect(state.subtaskId).toBe(null);
    expect(state.queueLevel).toBe(0);
    expect(state.mode).toBe('focus');
    expect(state.isActive).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.completedSessions).toBe(0);
    expect(state.timeLeft).toBe(DEFAULT_FOCUS_SETTINGS.focusDuration * 60);
    expect(state.totalTime).toBe(DEFAULT_FOCUS_SETTINGS.focusDuration * 60);
    expect(state.progress).toBe(0);
    expect(state.startTimeRef).toBe(null);
  });

  it('应该能通过 start 启动计时器', () => {
    useTimerStore.getState().start('task-1', 30);
    const state = useTimerStore.getState();
    expect(state.taskId).toBe('task-1');
    expect(state.subtaskId).toBe(null);
    expect(state.isActive).toBe(true);
    expect(state.isPaused).toBe(false);
    expect(state.totalTime).toBe(30 * 60);
    expect(state.timeLeft).toBe(30 * 60);
    expect(state.mode).toBe('focus');
    expect(state.startTimeRef).toBeInstanceOf(Date);
    expect(state.progress).toBe(0);
  });

  it('应该能通过 start 设置 queueLevel', () => {
    useTimerStore.getState().start('task-1', 25, 2);
    expect(useTimerStore.getState().queueLevel).toBe(2);
  });

  it('应该能通过 pause 暂停计时器', () => {
    useTimerStore.getState().start('task-1', 25);
    useTimerStore.getState().pause();
    const state = useTimerStore.getState();
    expect(state.isPaused).toBe(true);
    expect(state.isActive).toBe(true);
  });

  it('未启动时 pause 不应产生效果', () => {
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().isPaused).toBe(false);
  });

  it('应该能通过 resume 恢复已暂停的计时器', () => {
    useTimerStore.getState().start('task-1', 25);
    useTimerStore.getState().pause();
    useTimerStore.getState().resume();
    const state = useTimerStore.getState();
    expect(state.isPaused).toBe(false);
    expect(state.isActive).toBe(true);
  });

  it('应该能通过 tick 减少剩余时间并更新进度', () => {
    useTimerStore.getState().start('task-1', 25);
    const initialTime = useTimerStore.getState().timeLeft;
    useTimerStore.getState().tick();
    const state = useTimerStore.getState();
    expect(state.timeLeft).toBe(initialTime - 1);
    expect(state.progress).toBeGreaterThan(0);
  });

  it('未激活时 tick 不应产生效果', () => {
    const initialTime = useTimerStore.getState().timeLeft;
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().timeLeft).toBe(initialTime);
  });

  it('应该能通过 setSubtask 设置子任务', () => {
    useTimerStore.getState().setSubtask('subtask-1');
    expect(useTimerStore.getState().subtaskId).toBe('subtask-1');
  });

  it('应该能通过 reset 重置当前模式的计时器', () => {
    useTimerStore.getState().start('task-1', 25);
    useTimerStore.getState().tick();
    useTimerStore.getState().reset();
    const state = useTimerStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.timeLeft).toBe(DEFAULT_FOCUS_SETTINGS.focusDuration * 60);
    expect(state.progress).toBe(0);
    expect(state.startTimeRef).toBe(null);
  });

  it('应该能通过 complete 完成 focus 会话并切换到短休息', async () => {
    useTimerStore.getState().start('task-1', 25);
    await useTimerStore.getState().complete();
    const state = useTimerStore.getState();
    expect(state.completedSessions).toBe(1);
    expect(state.mode).toBe('shortBreak');
    expect(state.timeLeft).toBe(DEFAULT_FOCUS_SETTINGS.shortBreakDuration * 60);
    expect(state.totalTime).toBe(DEFAULT_FOCUS_SETTINGS.shortBreakDuration * 60);
  });

  it('应该能通过 setOnFocusSessionComplete 注册回调并在完成时触发', async () => {
    const cb = vi.fn();
    useTimerStore.getState().start('task-1', 25);
    useTimerStore.getState().tick(); // timeLeft 减少 1，elapsed = 1
    useTimerStore.getState().setOnFocusSessionComplete(cb);
    await useTimerStore.getState().complete();
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('应该能通过 switchTask 切换任务', () => {
    useTimerStore.getState().start('task-1', 25);
    useTimerStore.getState().switchTask('task-2', 45, 1);
    const state = useTimerStore.getState();
    expect(state.taskId).toBe('task-2');
    expect(state.subtaskId).toBe(null);
    expect(state.queueLevel).toBe(1);
    expect(state.totalTime).toBe(45 * 60);
    expect(state.timeLeft).toBe(45 * 60);
    expect(state.isActive).toBe(true);
  });

  it('应该能通过 nextSubtask 切换到下一子任务', () => {
    useTimerStore.getState().start('task-1', 25);
    useTimerStore.getState().nextSubtask('subtask-2', 20);
    const state = useTimerStore.getState();
    expect(state.subtaskId).toBe('subtask-2');
    expect(state.totalTime).toBe(20 * 60);
    expect(state.timeLeft).toBe(20 * 60);
    expect(state.isActive).toBe(true);
    expect(state.mode).toBe('focus');
  });
});

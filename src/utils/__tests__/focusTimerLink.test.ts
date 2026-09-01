// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTimerStore } from "../../store/useTimerStore";
import { useFocusStore } from "../../store/useFocusStore";
import { DEFAULT_FOCUS_SETTINGS } from "../../constants/focusSettings";
import {
  startFocusTimerForTask,
  pauseFocusTimerForTask,
} from "../focusTimerLink";

describe("focusTimerLink", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    const focusDuration = DEFAULT_FOCUS_SETTINGS.focusDuration;
    useTimerStore.setState({
      taskId: null,
      subtaskId: null,
      queueLevel: 0,
      mode: "focus",
      timeLeft: focusDuration * 60,
      totalTime: focusDuration * 60,
      isActive: false,
      isPaused: false,
      completedSessions: 0,
      startTimeRef: null,
      progress: 0,
      onFocusSessionComplete: undefined,
    });
    useFocusStore.setState({
      focusDuration: DEFAULT_FOCUS_SETTINGS.focusDuration,
      shortBreakDuration: DEFAULT_FOCUS_SETTINGS.shortBreakDuration,
      longBreakDuration: DEFAULT_FOCUS_SETTINGS.longBreakDuration,
      longBreakInterval: DEFAULT_FOCUS_SETTINGS.longBreakInterval,
      autoStartBreak: DEFAULT_FOCUS_SETTINGS.autoStartBreak,
      autoStartPomodoro: DEFAULT_FOCUS_SETTINGS.autoStartPomodoro,
      soundEnabled: DEFAULT_FOCUS_SETTINGS.soundEnabled,
      notificationEnabled: DEFAULT_FOCUS_SETTINGS.notificationEnabled,
      highlightEnabled: DEFAULT_FOCUS_SETTINGS.highlightEnabled,
      highlightIntensity: DEFAULT_FOCUS_SETTINGS.highlightIntensity,
      isInFocusMode: false,
      currentNodeId: null,
    });
  });

  it("无运行中番茄钟时，进入学习启动该任务番茄钟并绑定子任务", () => {
    startFocusTimerForTask("task-1", "sub-1");

    const state = useTimerStore.getState();
    expect(state.taskId).toBe("task-1");
    expect(state.subtaskId).toBe("sub-1");
    expect(state.mode).toBe("focus");
    expect(state.isActive).toBe(true);
    expect(state.isPaused).toBe(false);
    expect(state.timeLeft).toBe(DEFAULT_FOCUS_SETTINGS.focusDuration * 60);
  });

  it("同一任务已在倒计时时不打断", () => {
    useTimerStore.getState().start("task-1", 25);
    // 消耗一部分时间
    useTimerStore.setState({ timeLeft: 20 * 60 });

    startFocusTimerForTask("task-1");

    const state = useTimerStore.getState();
    expect(state.timeLeft).toBe(20 * 60); // 未被重置
    expect(state.isActive).toBe(true);
  });

  it("同一任务已暂停（离开学习冻结）时恢复倒计时", () => {
    useTimerStore.getState().start("task-1", 25);
    useTimerStore.setState({ timeLeft: 20 * 60 });
    useTimerStore.getState().pause();

    startFocusTimerForTask("task-1");

    const state = useTimerStore.getState();
    expect(state.isPaused).toBe(false);
    expect(state.isActive).toBe(true);
    expect(state.timeLeft).toBe(20 * 60); // 保留进度
  });

  it("其它任务正在运行时切换到新任务番茄钟", () => {
    useTimerStore.getState().start("task-old", 25);

    startFocusTimerForTask("task-new", "sub-2");

    const state = useTimerStore.getState();
    expect(state.taskId).toBe("task-new");
    expect(state.subtaskId).toBe("sub-2");
    expect(state.timeLeft).toBe(DEFAULT_FOCUS_SETTINGS.focusDuration * 60);
  });

  it("离开学习时暂停该任务番茄钟（保留进度）", () => {
    useTimerStore.getState().start("task-1", 25);
    useTimerStore.setState({ timeLeft: 20 * 60 });

    pauseFocusTimerForTask("task-1");

    const state = useTimerStore.getState();
    expect(state.isPaused).toBe(true);
    expect(state.timeLeft).toBe(20 * 60); // 进度保留
  });

  it("番茄钟属于其它任务时不暂停", () => {
    useTimerStore.getState().start("task-other", 25);

    pauseFocusTimerForTask("task-1");

    const state = useTimerStore.getState();
    expect(state.taskId).toBe("task-other");
    expect(state.isPaused).toBe(false);
    expect(state.isActive).toBe(true);
  });
});

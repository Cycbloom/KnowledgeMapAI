import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { TimerMode } from "@shared/types";
import { DEFAULT_SETTINGS, useFocusStore } from "./useFocusStore";
import { frontendEventBus } from "../services/timer/FrontendEventBus";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface TimerState {
  taskId: string | null;
  subtaskId: string | null; // 当前执行的子任务 ID
  queueLevel: number;
  mode: TimerMode;
  timeLeft: number; // seconds
  totalTime: number; // seconds
  isActive: boolean;
  isPaused: boolean;
  completedSessions: number;
  startTimeRef: Date | null;
  progress: number; // 0-100, derived from totalTime & timeLeft
  /** 每次 focus 番茄完成时回调，传入本次 focus 的已跑秒数 */
  onFocusSessionComplete?: (elapsedSeconds: number) => void;
}

interface TimerActions {
  start: (taskId: string, duration: number, queueLevel?: number) => void;
  pause: () => void;
  resume: () => void;
  complete: () => Promise<void>;
  /** Skip to the next phase in the Pomodoro cycle, saving current progress. */
  skipToNext: () => void;
  switchTask: (
    newTaskId: string,
    duration: number,
    queueLevel?: number,
  ) => void;
  /** Reset the current mode's timer to its full duration without switching modes. */
  reset: () => void;
  tick: () => void;
  /** Set the current subtask ID (without changing timer state). */
  setSubtask: (subtaskId: string | null) => void;
  /** Switch to the next subtask, restarting the timer with a new duration. Preserves completedSessions. */
  nextSubtask: (subtaskId: string, duration: number) => void;
  /** 注册 focus 番茄完成回调（面板用来保存子任务 actual_duration） */
  setOnFocusSessionComplete: (
    cb: ((elapsedSeconds: number) => void) | undefined,
  ) => void;
}

// ---------------------------------------------------------------------------
// Computed getter (exposed via store property)
// ---------------------------------------------------------------------------

function computeProgress(totalTime: number, timeLeft: number): number {
  if (totalTime <= 0) return 0;
  return ((totalTime - timeLeft) / totalTime) * 100;
}

// ---------------------------------------------------------------------------
// Interval management (module-level, not in store)
// ---------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;

function startInterval(): void {
  clearTimerInterval();
  intervalId = setInterval(() => {
    useTimerStore.getState().tick();
  }, 1000);
}

function clearTimerInterval(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// ---------------------------------------------------------------------------
// Mode transition logic
// ---------------------------------------------------------------------------

function transitionToNextMode(
  completedMode: TimerMode,
  completedSessions: number,
): Partial<TimerState> {
  const {
    shortBreakDuration,
    longBreakDuration,
    focusDuration,
    longBreakInterval,
    autoStartBreak,
    autoStartPomodoro,
  } = useFocusStore.getState();

  if (completedMode === "focus") {
    const isLongBreak =
      completedSessions > 0 && completedSessions % longBreakInterval === 0;
    const breakDuration = isLongBreak ? longBreakDuration : shortBreakDuration;
    const nextMode: TimerMode = isLongBreak ? "longBreak" : "shortBreak";
    const totalTime = breakDuration * 60;
    return {
      mode: nextMode,
      timeLeft: totalTime,
      totalTime,
      isActive: autoStartBreak,
      isPaused: false,
      startTimeRef: autoStartBreak ? new Date() : null,
      progress: 0,
    };
  }

  // break completed → back to focus
  const totalTime = focusDuration * 60;
  return {
    mode: "focus",
    timeLeft: totalTime,
    totalTime,
    isActive: autoStartPomodoro,
    isPaused: false,
    startTimeRef: autoStartPomodoro ? new Date() : null,
    progress: 0,
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const focusDuration = DEFAULT_SETTINGS.focusDuration;

const initialState: TimerState = {
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
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useTimerStore = create<TimerState & TimerActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      start: (taskId, duration, queueLevel = 0) => {
        clearTimerInterval();

        const totalTime = duration * 60;
        set({
          taskId,
          subtaskId: null,
          queueLevel,
          mode: "focus",
          timeLeft: totalTime,
          totalTime,
          isActive: true,
          isPaused: false,
          startTimeRef: new Date(),
          progress: 0,
        });

        startInterval();
      },

      pause: () => {
        const { isActive, isPaused } = get();
        if (!isActive || isPaused) return;

        set({ isPaused: true });
        clearTimerInterval();
      },

      resume: () => {
        const { isActive, isPaused } = get();
        if (!isActive || !isPaused) return;

        set({ isPaused: false });
        startInterval();
      },

      complete: async () => {
        const {
          totalTime,
          timeLeft,
          taskId,
          mode,
          completedSessions,
          startTimeRef,
        } = get();

        const elapsedDuration = totalTime - timeLeft;
        const completedTaskId = taskId;
        const completedMode = mode;

        // Publish event for network side-effects (handled by storeIntegrations)
        if (startTimeRef) {
          frontendEventBus.publish("focus_session_completed", {
            taskId: completedTaskId,
            startTimeRef,
            elapsedDuration,
            completedSessions,
            mode: completedMode,
          });
        }

        // focus 番茄完成时通知面板保存子任务 actual_duration
        if (completedMode === "focus") {
          const { onFocusSessionComplete } = get();
          onFocusSessionComplete?.(elapsedDuration);
        }

        const newCompletedSessions =
          completedMode === "focus" ? completedSessions + 1 : completedSessions;

        const transition = transitionToNextMode(
          completedMode,
          newCompletedSessions,
        );

        clearTimerInterval();

        set({
          completedSessions: newCompletedSessions,
          ...transition,
        });

        if (transition.isActive) {
          startInterval();
        }
      },

      skipToNext: () => {
        const {
          totalTime,
          timeLeft,
          taskId,
          mode,
          completedSessions,
          startTimeRef,
        } = get();

        // Save current session if at least 1 minute elapsed
        const elapsedDuration = totalTime - timeLeft;
        if (elapsedDuration > 60 && startTimeRef) {
          frontendEventBus.publish("focus_session_completed", {
            taskId,
            startTimeRef,
            elapsedDuration,
            completedSessions,
            mode,
          });
        }

        const newCompletedSessions =
          mode === "focus" ? completedSessions + 1 : completedSessions;

        const transition = transitionToNextMode(mode, newCompletedSessions);

        clearTimerInterval();

        set({
          completedSessions: newCompletedSessions,
          ...transition,
        });

        if (transition.isActive) {
          startInterval();
        }
      },

      switchTask: (newTaskId, duration, queueLevel = 0) => {
        clearTimerInterval();

        const totalTime = duration * 60;
        set({
          taskId: newTaskId,
          subtaskId: null,
          queueLevel,
          timeLeft: totalTime,
          totalTime,
          mode: "focus",
          isActive: true,
          isPaused: false,
          startTimeRef: new Date(),
          progress: 0,
        });

        startInterval();
      },

      reset: () => {
        clearTimerInterval();

        const { mode } = get();
        const { focusDuration, shortBreakDuration, longBreakDuration } =
          useFocusStore.getState();
        let duration = focusDuration;
        if (mode === "shortBreak") duration = shortBreakDuration;
        if (mode === "longBreak") duration = longBreakDuration;

        const totalTime = duration * 60;
        set({
          subtaskId: null,
          timeLeft: totalTime,
          totalTime,
          isActive: false,
          isPaused: false,
          startTimeRef: null,
          progress: 0,
        });
      },

      setSubtask: (subtaskId) => {
        set({ subtaskId });
      },

      setOnFocusSessionComplete: (cb) => {
        set({ onFocusSessionComplete: cb });
      },

      nextSubtask: (subtaskId, duration) => {
        clearTimerInterval();

        const totalTime = duration * 60;
        set({
          subtaskId,
          mode: "focus",
          timeLeft: totalTime,
          totalTime,
          isActive: true,
          isPaused: false,
          startTimeRef: new Date(),
          progress: 0,
        });

        startInterval();
      },

      tick: () => {
        const { isActive, isPaused, timeLeft, totalTime } = get();
        if (!isActive || isPaused) return;

        if (timeLeft <= 1) {
          // Timer reached zero — trigger complete flow
          set({ timeLeft: 0, progress: computeProgress(totalTime, 0) });
          // complete is async but we fire-and-forget from tick
          get().complete();
          return;
        }

        const newTimeLeft = timeLeft - 1;
        set({
          timeLeft: newTimeLeft,
          progress: computeProgress(totalTime, newTimeLeft),
        });
      },
    }),
    { name: "TimerStore" },
  ),
);

// ---------------------------------------------------------------------------
// Document title sync — updates the browser tab title while timer is active
// ---------------------------------------------------------------------------

const DEFAULT_TITLE = document.title;

useTimerStore.subscribe((state, prevState) => {
  if (
    state.isActive === prevState.isActive &&
    state.timeLeft === prevState.timeLeft
  ) {
    return;
  }

  if (!state.isActive) {
    document.title = DEFAULT_TITLE;
    return;
  }

  const mins = Math.floor(state.timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = (state.timeLeft % 60).toString().padStart(2, "0");
  const modeLabel = state.mode === "focus" ? "专注中" : "休息中";
  document.title = `${mins}:${secs} - ${modeLabel}`;
});

export { useTimerStore };

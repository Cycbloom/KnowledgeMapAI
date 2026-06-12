import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { TimerMode } from "@shared/types";
import type { TaskStartedPayload } from "@shared/types/events";
import { useFocusStore } from "./useFocusStore";
import { api } from "../services/api";
import { frontendEventBus } from "../services/timer/FrontendEventBus";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface TimerState {
  taskId: string | null;
  queueLevel: number;
  mode: TimerMode;
  timeLeft: number; // seconds
  totalTime: number; // seconds
  isActive: boolean;
  isPaused: boolean;
  completedSessions: number;
  startTimeRef: Date | null;
  progress: number; // 0-100, derived from totalTime & timeLeft
}

interface TimerActions {
  start: (taskId: string, duration: number, queueLevel?: number) => void;
  pause: () => void;
  resume: () => void;
  complete: () => Promise<void>;
  /** Skip to the next phase in the Pomodoro cycle, saving current progress. */
  skipToNext: () => void;
  /**
   * @deprecated Use skipToNext() instead. Manual mode switching resets the timer
   * and loses progress, which is a poor UX. The Pomodoro cycle should progress
   * naturally via complete() or skipToNext().
   */
  setMode: (newMode: TimerMode) => void;
  switchTask: (newTaskId: string, duration: number, queueLevel?: number) => void;
  /** Reset the current mode's timer to its full duration without switching modes. */
  reset: () => void;
  tick: () => void;
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
// Scheduler integration (optional, not enabled by default)
// ---------------------------------------------------------------------------

let schedulerUnsubscribe: (() => void) | null = null;

function getTimeSliceForQueueLevel(queueLevel: number): number {
  if (queueLevel === 0) return 15;
  if (queueLevel === 1) return 25;
  return 45;
}

function initSchedulerIntegration(): void {
  const handler = (payload: TaskStartedPayload) => {
    const timeSliceMinutes = getTimeSliceForQueueLevel(payload.queueLevel);
    useTimerStore.getState().start(payload.taskId, timeSliceMinutes, payload.queueLevel);
  };

  schedulerUnsubscribe = frontendEventBus.subscribe("task_started", handler);
}

function destroySchedulerIntegration(): void {
  if (schedulerUnsubscribe) {
    schedulerUnsubscribe();
    schedulerUnsubscribe = null;
  }
}

// ---------------------------------------------------------------------------
// Focus session persistence helpers
// ---------------------------------------------------------------------------

async function saveFocusSession(
  taskId: string | null,
  startTimeRef: Date | null,
  elapsedSeconds: number,
  completedSessions: number,
  mode: TimerMode,
): Promise<void> {
  if (!startTimeRef) return;
  try {
    await api.scheduler.createFocusSession({
      task_id: taskId ?? undefined,
      started_at: startTimeRef.toISOString(),
      ended_at: new Date().toISOString(),
      duration: Math.round(elapsedSeconds / 60),
      pomodoro_count: completedSessions + 1,
      is_break: mode !== "focus",
    });
  } catch {
    // Failed to save focus session — non-critical
  }
}

async function tickTaskExecution(
  taskId: string | null,
  mode: TimerMode,
  elapsedSeconds: number,
): Promise<void> {
  if (mode !== "focus" || !taskId) return;
  try {
    await api.scheduler.tickExecution(taskId, Math.round(elapsedSeconds));
  } catch {
    // Execution tick failed — non-critical
  }
}

// ---------------------------------------------------------------------------
// Mode transition logic
// ---------------------------------------------------------------------------

function transitionToNextMode(
  completedMode: TimerMode,
  completedSessions: number,
): Partial<TimerState> {
  const { shortBreakDuration, longBreakDuration, focusDuration } =
    useFocusStore.getState();

  if (completedMode === "focus") {
    const isLongBreak = completedSessions > 0 && completedSessions % 4 === 0;
    const breakDuration = isLongBreak ? longBreakDuration : shortBreakDuration;
    const nextMode: TimerMode = isLongBreak ? "longBreak" : "shortBreak";
    const totalTime = breakDuration * 60;
    return {
      mode: nextMode,
      timeLeft: totalTime,
      totalTime,
      isActive: true,
      isPaused: false,
      startTimeRef: new Date(),
      progress: 0,
    };
  }

  // break completed → back to focus
  const totalTime = focusDuration * 60;
  return {
    mode: "focus",
    timeLeft: totalTime,
    totalTime,
    isActive: true,
    isPaused: false,
    startTimeRef: new Date(),
    progress: 0,
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const { focusDuration } = /* evaluated once at module load */ (() => {
  try {
    return useFocusStore.getState();
  } catch {
    return { focusDuration: 25 };
  }
})();

const initialState: TimerState = {
  taskId: null,
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
        const { totalTime, timeLeft, taskId, mode, completedSessions, startTimeRef } =
          get();

        const elapsedDuration = totalTime - timeLeft;
        const completedTaskId = taskId;
        const completedMode = mode;

        await saveFocusSession(
          completedTaskId,
          startTimeRef,
          elapsedDuration,
          completedSessions,
          completedMode,
        );

        await tickTaskExecution(completedTaskId, completedMode, elapsedDuration);

        const newCompletedSessions =
          completedMode === "focus" ? completedSessions + 1 : completedSessions;

        const transition = transitionToNextMode(completedMode, newCompletedSessions);

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
        const { totalTime, timeLeft, taskId, mode, completedSessions, startTimeRef } =
          get();

        // Save current session if at least 1 minute elapsed
        const elapsedDuration = totalTime - timeLeft;
        if (elapsedDuration > 60 && startTimeRef) {
          saveFocusSession(taskId, startTimeRef, elapsedDuration, completedSessions, mode);
          tickTaskExecution(taskId, mode, elapsedDuration);
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

      setMode: (newMode) => {
        clearTimerInterval();

        const { focusDuration: fd, shortBreakDuration: sbd, longBreakDuration: lbd } =
          useFocusStore.getState();
        let duration = fd;
        if (newMode === "shortBreak") duration = sbd;
        if (newMode === "longBreak") duration = lbd;

        const totalTime = duration * 60;
        set({
          mode: newMode,
          timeLeft: totalTime,
          totalTime,
          isActive: false,
          isPaused: false,
          startTimeRef: null,
          progress: 0,
        });
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
          timeLeft: totalTime,
          totalTime,
          isActive: false,
          isPaused: false,
          startTimeRef: null,
          progress: 0,
        });
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
  if (state.isActive === prevState.isActive && state.timeLeft === prevState.timeLeft) {
    return;
  }

  if (!state.isActive) {
    document.title = DEFAULT_TITLE;
    return;
  }

  const mins = Math.floor(state.timeLeft / 60).toString().padStart(2, "0");
  const secs = (state.timeLeft % 60).toString().padStart(2, "0");
  const modeLabel = state.mode === "focus" ? "专注中" : "休息中";
  document.title = `${mins}:${secs} - ${modeLabel}`;
});

export { useTimerStore, initSchedulerIntegration, destroySchedulerIntegration };

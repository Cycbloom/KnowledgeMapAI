/**
 * Store Integrations
 *
 * 统一管理 Store 间的事件协调，避免 Store 之间直接互相引用。
 * 所有 Store 间耦合逻辑集中在此文件中。
 */
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { useNoiseStore } from "./useNoiseStore";
import { useTimerStore } from "./useTimerStore";
import { api } from "../services/api";
import type { FocusSessionCompletedPayload } from "../services/FrontendEventTypes";

// 退出专注模式时，重置白噪音
frontendEventBus.subscribe("focus_exit", () => {
  useNoiseStore.getState().setNoise("none");
});

// 专注设置变更时，同步到 TimerStore
frontendEventBus.subscribe("focus_settings_changed", (settings) => {
  useTimerStore.getState().syncFocusSettings(settings);
});

// Timer focus session 完成时，持久化到后端
frontendEventBus.subscribe("focus_session_completed", (payload: FocusSessionCompletedPayload) => {
  const { taskId, startTimeRef, elapsedDuration, completedSessions, mode } = payload;

  // Save focus session
  if (startTimeRef) {
    api.scheduler.createFocusSession({
      task_id: taskId ?? undefined,
      started_at: startTimeRef.toISOString(),
      ended_at: new Date().toISOString(),
      duration: Math.round(elapsedDuration / 60),
      pomodoro_count: completedSessions + 1,
      is_break: mode !== "focus",
      mode: mode as "focus" | "shortBreak" | "longBreak",
    }).catch(() => {
      // Failed to save focus session — non-critical
    });
  }

  // Tick task execution
  if (mode === "focus" && taskId) {
    api.scheduler.tickExecution(taskId, Math.round(elapsedDuration)).catch(() => {
      // Execution tick failed — non-critical
    });
  }
});
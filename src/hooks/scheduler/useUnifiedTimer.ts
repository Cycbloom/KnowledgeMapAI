import { useState, useEffect, useCallback } from "react";
import { timerService } from "../../services/timer/TimerService";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { useFocusStore, type TimerMode } from "../../store/useFocusStore";
import type {
  TimerTickPayload,
  TimerPausedPayload,
  TimerCompletedPayload,
  TimerModeChangedPayload,
  TimerSkipToBreakPayload,
} from "@shared/types/events";

interface UseUnifiedTimerReturn {
  taskId: string | null;
  queueLevel: number;
  mode: TimerMode;
  timeLeft: number;
  totalTime: number;
  isActive: boolean;
  isPaused: boolean;
  completedSessions: number;
  progress: number;
  start: (taskId: string, duration: number, queueLevel?: number) => void;
  pause: () => void;
  resume: () => void;
  complete: () => Promise<void>;
  skipToBreak: () => void;
  switchTask: (taskId: string, duration: number, queueLevel?: number) => void;
  setMode: (mode: TimerMode) => void;
}

export function useUnifiedTimer(): UseUnifiedTimerReturn {
  useFocusStore();

  const initialState = timerService.getState();
  const [taskId, setTaskId] = useState<string | null>(initialState.taskId);
  const [queueLevel, setQueueLevel] = useState<number>(initialState.queueLevel);
  const [mode, setModeState] = useState<TimerMode>(initialState.mode);
  const [timeLeft, setTimeLeft] = useState<number>(initialState.timeLeft);
  const [totalTime, setTotalTime] = useState<number>(initialState.totalTime);
  const [isActive, setIsActive] = useState<boolean>(initialState.isActive);
  const [isPaused, setIsPaused] = useState<boolean>(initialState.isPaused);
  const [completedSessions, setCompletedSessions] = useState<number>(
    initialState.completedSessions,
  );
  const [progress, setProgress] = useState<number>(initialState.progress);

  const syncAllState = useCallback(() => {
    const state = timerService.getState();
    setTaskId(state.taskId);
    setQueueLevel(state.queueLevel);
    setModeState(state.mode);
    setTimeLeft(state.timeLeft);
    setTotalTime(state.totalTime);
    setIsActive(state.isActive);
    setIsPaused(state.isPaused);
    setCompletedSessions(state.completedSessions);
    setProgress(state.progress);
  }, []);

  useEffect(() => {
    const onTick = (payload: unknown) => {
      const p = payload as TimerTickPayload;
      setTaskId(p.taskId);
      setTimeLeft(p.timeLeft);
      setTotalTime(p.totalTime);
      setProgress(p.progress);
      setModeState(p.mode as TimerMode);
      setIsActive(p.isActive);
      setIsPaused(p.isPaused);
      setCompletedSessions(p.completedSessions);
    };

    const onStarted = (_payload: unknown) => {
      syncAllState();
    };

    const onPaused = (payload: unknown) => {
      const p = payload as TimerPausedPayload;
      setIsPaused(true);
      setTimeLeft(p.timeLeft);
    };

    const onResumed = (_payload: unknown) => {
      setIsPaused(false);
    };

    const onCompleted = (payload: unknown) => {
      const p = payload as TimerCompletedPayload;
      setIsActive(false);
      setIsPaused(false);
      setCompletedSessions(p.completedSessions);
      setTimeLeft(timerService.getState().timeLeft);
    };

    const onModeChanged = (payload: unknown) => {
      const p = payload as TimerModeChangedPayload;
      setModeState(p.newMode as TimerMode);
      setTimeLeft(p.timeLeft);
      setTotalTime(p.totalTime);
    };

    const onSkipToBreak = (payload: unknown) => {
      const p = payload as TimerSkipToBreakPayload;
      setModeState(p.toMode as TimerMode);
      setTimeLeft(p.breakDuration);
      setTotalTime(p.breakDuration);
      setIsActive(true);
      setIsPaused(false);
    };

    const onReset = (_payload: unknown) => {
      syncAllState();
    };

    const unsubTick = frontendEventBus.subscribe("timer_tick", onTick);
    const unsubStarted = frontendEventBus.subscribe("timer_started", onStarted);
    const unsubPaused = frontendEventBus.subscribe("timer_paused", onPaused);
    const unsubResumed = frontendEventBus.subscribe("timer_resumed", onResumed);
    const unsubCompleted = frontendEventBus.subscribe(
      "timer_completed",
      onCompleted,
    );
    const unsubModeChanged = frontendEventBus.subscribe(
      "timer_mode_changed",
      onModeChanged,
    );
    const unsubSkipToBreak = frontendEventBus.subscribe(
      "timer_skip_to_break",
      onSkipToBreak,
    );
    const unsubReset = frontendEventBus.subscribe("timer_reset", onReset);

    return () => {
      unsubTick();
      unsubStarted();
      unsubPaused();
      unsubResumed();
      unsubCompleted();
      unsubModeChanged();
      unsubSkipToBreak();
      unsubReset();
    };
  }, [syncAllState]);

  const start = useCallback(
    (newTaskId: string, duration: number, newQueueLevel?: number) => {
      timerService.start(newTaskId, duration, newQueueLevel);
    },
    [],
  );

  const pause = useCallback(() => {
    timerService.pause();
  }, []);

  const resume = useCallback(() => {
    timerService.resume();
  }, []);

  const complete = useCallback(async () => {
    await timerService.complete();
  }, []);

  const skipToBreak = useCallback(() => {
    timerService.skipToBreak();
  }, []);

  const switchTask = useCallback(
    (newTaskId: string, duration: number, newQueueLevel?: number) => {
      timerService.switchTask(newTaskId, duration, newQueueLevel);
    },
    [],
  );

  const setMode = useCallback((newMode: TimerMode) => {
    timerService.setMode(newMode);
  }, []);

  return {
    taskId,
    queueLevel,
    mode,
    timeLeft,
    totalTime,
    isActive,
    isPaused,
    completedSessions,
    progress,
    start,
    pause,
    resume,
    complete,
    skipToBreak,
    switchTask,
    setMode,
  };
}

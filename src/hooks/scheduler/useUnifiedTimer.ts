import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../services/api";
import { useFocusStore, type TimerMode } from "../../store/useFocusStore";

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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function useUnifiedTimer(): UseUnifiedTimerReturn {
  const {
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    soundEnabled,
  } = useFocusStore();

  const [taskId, setTaskId] = useState<string | null>(null);
  const [queueLevel, setQueueLevel] = useState<number>(0);
  const [mode, setModeState] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState<number>(focusDuration * 60);
  const [totalTime, setTotalTime] = useState<number>(focusDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as never)["webkitAudioContext"])();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 300);
    } catch {
      // Audio not available
    }
  }, [soundEnabled]);

  const saveFocusSession = useCallback(async (elapsedSeconds: number) => {
    if (!startTimeRef.current) return;

    try {
      await api.scheduler.createFocusSession({
        task_id: taskId ?? undefined,
        started_at: startTimeRef.current.toISOString(),
        ended_at: new Date().toISOString(),
        duration: Math.round(elapsedSeconds / 60),
        pomodoro_count: completedSessions + 1,
        is_break: mode !== "focus",
      });
    } catch (error) {
      console.error("Failed to save focus session:", error);
    }
  }, [taskId, completedSessions, mode]);

  const onTimerEnd = useCallback(async () => {
    clearTimer();
    setIsActive(false);
    setIsPaused(false);

    const elapsedDuration = totalTime - timeLeft;
    await saveFocusSession(elapsedDuration);

    playNotificationSound();

    if (mode === "focus") {
      setCompletedSessions((prev) => prev + 1);
    }

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(mode === "focus" ? "专注时间结束！" : "休息时间结束！", {
        body: mode === "focus" ? "该休息一下了" : "继续加油吧！",
      });
    }
  }, [totalTime, timeLeft, mode, clearTimer, saveFocusSession, playNotificationSound]);

  useEffect(() => {
    if (!isActive || isPaused) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimer();
  }, [isActive, isPaused, onTimerEnd, clearTimer]);

  useEffect(() => {
    if (isActive && !isPaused) {
      document.title = `${formatTime(timeLeft)} - ${mode === "focus" ? "专注中" : "休息中"}`;
    } else {
      document.title = "KnowledgeMap";
    }

    return () => {
      document.title = "KnowledgeMap";
    };
  }, [isActive, isPaused, timeLeft, mode]);

  const start = useCallback((newTaskId: string, duration: number, newQueueLevel?: number) => {
    clearTimer();
    setTaskId(newTaskId);
    setQueueLevel(newQueueLevel ?? 0);
    setModeState("focus");
    setTimeLeft(duration * 60);
    setTotalTime(duration * 60);
    setIsActive(true);
    setIsPaused(false);
    startTimeRef.current = new Date();
  }, [clearTimer]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const complete = useCallback(async () => {
    const elapsedDuration = totalTime - timeLeft;
    await saveFocusSession(elapsedDuration);
    clearTimer();
    setIsActive(false);
    setIsPaused(false);
    setTaskId(null);
    setTimeLeft(focusDuration * 60);
    setTotalTime(focusDuration * 60);
  }, [totalTime, timeLeft, focusDuration, saveFocusSession, clearTimer]);

  const skipToBreak = useCallback(() => {
    clearTimer();
    const breakDuration =
      completedSessions > 0 && completedSessions % 4 === 0
        ? longBreakDuration
        : shortBreakDuration;
    const nextMode: TimerMode = mode === "focus" ? "shortBreak" : "focus";
    setModeState(nextMode);
    setTimeLeft(breakDuration * 60);
    setTotalTime(breakDuration * 60);
    setIsActive(true);
    setIsPaused(false);
    startTimeRef.current = new Date();
  }, [completedSessions, shortBreakDuration, longBreakDuration, mode, clearTimer]);

  const switchTask = useCallback((newTaskId: string, duration: number, newQueueLevel?: number) => {
    clearTimer();
    setTaskId(newTaskId);
    setQueueLevel(newQueueLevel ?? 0);
    setTimeLeft(duration * 60);
    setTotalTime(duration * 60);
    setModeState("focus");
    setIsActive(true);
    setIsPaused(false);
    startTimeRef.current = new Date();
  }, [clearTimer]);

  const setMode = useCallback((newMode: TimerMode) => {
    clearTimer();
    let duration = focusDuration;
    if (newMode === "shortBreak") duration = shortBreakDuration;
    if (newMode === "longBreak") duration = longBreakDuration;
    setModeState(newMode);
    setTimeLeft(duration * 60);
    setTotalTime(duration * 60);
    setIsActive(false);
    setIsPaused(false);
  }, [focusDuration, shortBreakDuration, longBreakDuration, clearTimer]);

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

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

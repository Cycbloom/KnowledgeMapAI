import { frontendEventBus } from "./FrontendEventBus";
import { useFocusStore, type TimerMode } from "../../store/useFocusStore";
import { api } from "../api";
import type {
  TimerStartedPayload,
  TimerTickPayload,
  TimerPausedPayload,
  TimerResumedPayload,
  TimerCompletedPayload,
  TimerModeChangedPayload,
  TimerSkipToBreakPayload,
  TimerResetPayload,
  TaskStartedPayload,
} from "../../../shared/types/events";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

class TimerService {
  private _taskId: string | null = null;
  private _queueLevel: number = 0;
  private _mode: TimerMode = "focus";
  private _timeLeft: number = 0;
  private _totalTime: number = 0;
  private _isActive: boolean = false;
  private _isPaused: boolean = false;
  private _completedSessions: number = 0;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _startTimeRef: Date | null = null;
  private _schedulerUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initSchedulerIntegration();
  }

  get taskId(): string | null {
    return this._taskId;
  }

  get queueLevel(): number {
    return this._queueLevel;
  }

  get mode(): TimerMode {
    return this._mode;
  }

  get timeLeft(): number {
    return this._timeLeft;
  }

  get totalTime(): number {
    return this._totalTime;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get completedSessions(): number {
    return this._completedSessions;
  }

  get progress(): number {
    if (this._totalTime <= 0) return 0;
    return ((this._totalTime - this._timeLeft) / this._totalTime) * 100;
  }

  private clearTimerInterval(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private updatePageTitle(): void {
    if (this._isActive && !this._isPaused) {
      const modeLabel = this._mode === "focus" ? "专注中" : "休息中";
      document.title = `${formatTime(this._timeLeft)} - ${modeLabel}`;
    } else {
      document.title = "KnowledgeMap";
    }
  }

  private playNotificationSound(): void {
    const { soundEnabled } = useFocusStore.getState();
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext ?? (window as never)["webkitAudioContext"];
      const ctx = new AudioCtx();
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
  }

  private sendBrowserNotification(): void {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const title = this._mode === "focus" ? "专注时间结束！" : "休息时间结束！";
    const body = this._mode === "focus" ? "该休息一下了" : "继续加油吧！";
    new Notification(title, { body });
  }

  private async saveFocusSession(elapsedSeconds: number): Promise<void> {
    if (!this._startTimeRef) return;
    try {
      await api.scheduler.createFocusSession({
        task_id: this._taskId ?? undefined,
        started_at: this._startTimeRef.toISOString(),
        ended_at: new Date().toISOString(),
        duration: Math.round(elapsedSeconds / 60),
        pomodoro_count: this._completedSessions + 1,
        is_break: this._mode !== "focus",
      });
    } catch {
      // Failed to save focus session
    }
  }

  private startInterval(): void {
    this.clearTimerInterval();
    this._intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick(): void {
    if (!this._isActive || this._isPaused) return;

    if (this._timeLeft <= 1) {
      this._timeLeft = 0;
      this.onTimerEnd();
      return;
    }

    this._timeLeft -= 1;
    this.updatePageTitle();

    frontendEventBus.publish("timer_tick", {
      taskId: this._taskId,
      timeLeft: this._timeLeft,
      totalTime: this._totalTime,
      progress: this.progress,
      mode: this._mode,
      isActive: this._isActive,
      isPaused: this._isPaused,
      completedSessions: this._completedSessions,
    } satisfies TimerTickPayload);
  }

  private async onTimerEnd(): Promise<void> {
    const elapsedDuration = this._totalTime - this._timeLeft;
    const completedMode = this._mode;
    const completedTaskId = this._taskId;

    this.clearTimerInterval();
    this._isActive = false;
    this._isPaused = false;

    await this.saveFocusSession(elapsedDuration);

    this.playNotificationSound();

    if (completedMode === "focus") {
      this._completedSessions += 1;
    }

    this.sendBrowserNotification();
    document.title = "KnowledgeMap";

    frontendEventBus.publish("timer_completed", {
      taskId: completedTaskId,
      mode: completedMode,
      duration: elapsedDuration,
      completedSessions: this._completedSessions,
    } satisfies TimerCompletedPayload);
  }

  start(taskId: string, duration: number, queueLevel?: number): void {
    this.clearTimerInterval();

    this._taskId = taskId;
    this._queueLevel = queueLevel ?? 0;
    this._mode = "focus";
    this._timeLeft = duration * 60;
    this._totalTime = duration * 60;
    this._isActive = true;
    this._isPaused = false;
    this._startTimeRef = new Date();

    this.startInterval();
    this.updatePageTitle();

    frontendEventBus.publish("timer_started", {
      taskId: this._taskId,
      queueLevel: this._queueLevel,
      mode: this._mode,
      duration: this._totalTime,
    } satisfies TimerStartedPayload);
  }

  pause(): void {
    if (!this._isActive || this._isPaused) return;

    this._isPaused = true;
    this.clearTimerInterval();
    document.title = "KnowledgeMap";

    frontendEventBus.publish("timer_paused", {
      taskId: this._taskId,
      timeLeft: this._timeLeft,
      mode: this._mode,
    } satisfies TimerPausedPayload);
  }

  resume(): void {
    if (!this._isActive || !this._isPaused) return;

    this._isPaused = false;
    this.startInterval();
    this.updatePageTitle();

    frontendEventBus.publish("timer_resumed", {
      taskId: this._taskId,
      timeLeft: this._timeLeft,
      mode: this._mode,
    } satisfies TimerResumedPayload);
  }

  async complete(): Promise<void> {
    const elapsedDuration = this._totalTime - this._timeLeft;
    await this.saveFocusSession(elapsedDuration);

    this.clearTimerInterval();
    this._isActive = false;
    this._isPaused = false;
    this._taskId = null;

    const { focusDuration } = useFocusStore.getState();
    this._timeLeft = focusDuration * 60;
    this._totalTime = focusDuration * 60;
    this._startTimeRef = null;

    document.title = "KnowledgeMap";

    frontendEventBus.publish("timer_completed", {
      taskId: null,
      mode: this._mode,
      duration: elapsedDuration,
      completedSessions: this._completedSessions,
    } satisfies TimerCompletedPayload);
  }

  skipToBreak(): void {
    this.clearTimerInterval();

    const { shortBreakDuration, longBreakDuration } = useFocusStore.getState();
    const breakDuration =
      this._completedSessions > 0 && this._completedSessions % 4 === 0
        ? longBreakDuration
        : shortBreakDuration;

    const previousMode = this._mode;
    const nextMode: TimerMode = previousMode === "focus" ? "shortBreak" : "focus";

    this._mode = nextMode;
    this._timeLeft = breakDuration * 60;
    this._totalTime = breakDuration * 60;
    this._isActive = true;
    this._isPaused = false;
    this._startTimeRef = new Date();

    this.startInterval();
    this.updatePageTitle();

    frontendEventBus.publish("timer_skip_to_break", {
      fromMode: previousMode,
      toMode: nextMode,
      breakDuration: breakDuration * 60,
    } satisfies TimerSkipToBreakPayload);
  }

  switchTask(newTaskId: string, duration: number, queueLevel?: number): void {
    this.clearTimerInterval();

    this._taskId = newTaskId;
    this._queueLevel = queueLevel ?? 0;
    this._timeLeft = duration * 60;
    this._totalTime = duration * 60;
    this._mode = "focus";
    this._isActive = true;
    this._isPaused = false;
    this._startTimeRef = new Date();

    this.startInterval();
    this.updatePageTitle();

    frontendEventBus.publish("timer_started", {
      taskId: this._taskId,
      queueLevel: this._queueLevel,
      mode: this._mode,
      duration: this._totalTime,
    } satisfies TimerStartedPayload);
  }

  setMode(newMode: TimerMode): void {
    this.clearTimerInterval();

    const { focusDuration, shortBreakDuration, longBreakDuration } = useFocusStore.getState();
    let duration = focusDuration;
    if (newMode === "shortBreak") duration = shortBreakDuration;
    if (newMode === "longBreak") duration = longBreakDuration;

    const previousMode = this._mode;
    this._mode = newMode;
    this._timeLeft = duration * 60;
    this._totalTime = duration * 60;
    this._isActive = false;
    this._isPaused = false;
    this._startTimeRef = null;

    document.title = "KnowledgeMap";

    frontendEventBus.publish("timer_mode_changed", {
      previousMode,
      newMode,
      timeLeft: this._timeLeft,
      totalTime: this._totalTime,
    } satisfies TimerModeChangedPayload);
  }

  reset(): void {
    this.clearTimerInterval();

    const { focusDuration } = useFocusStore.getState();
    this._taskId = null;
    this._queueLevel = 0;
    this._mode = "focus";
    this._timeLeft = focusDuration * 60;
    this._totalTime = focusDuration * 60;
    this._isActive = false;
    this._isPaused = false;
    this._completedSessions = 0;
    this._startTimeRef = null;

    document.title = "KnowledgeMap";

    frontendEventBus.publish("timer_reset", {
      mode: this._mode,
      timeLeft: this._timeLeft,
      totalTime: this._totalTime,
    } satisfies TimerResetPayload);
  }

  private getTimeSliceForQueueLevel(queueLevel: number): number {
    if (queueLevel === 0) return 15;
    if (queueLevel === 1) return 25;
    return 45;
  }

  initSchedulerIntegration(): void {
    const handler = (payload: unknown) => {
      const data = payload as TaskStartedPayload;
      const timeSliceMinutes = this.getTimeSliceForQueueLevel(data.queueLevel);
      this.start(data.taskId, timeSliceMinutes, data.queueLevel);
    };

    this._schedulerUnsubscribe = frontendEventBus.subscribe("task_started", handler);
  }

  destroySchedulerIntegration(): void {
    if (this._schedulerUnsubscribe) {
      this._schedulerUnsubscribe();
      this._schedulerUnsubscribe = null;
    }
  }

  getState(): {
    taskId: string | null;
    queueLevel: number;
    mode: TimerMode;
    timeLeft: number;
    totalTime: number;
    isActive: boolean;
    isPaused: boolean;
    completedSessions: number;
    progress: number;
  } {
    return {
      taskId: this._taskId,
      queueLevel: this._queueLevel,
      mode: this._mode,
      timeLeft: this._timeLeft,
      totalTime: this._totalTime,
      isActive: this._isActive,
      isPaused: this._isPaused,
      completedSessions: this._completedSessions,
      progress: this.progress,
    };
  }
}

export const timerService = new TimerService();

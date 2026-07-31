import i18next from 'i18next';
import type { UserTask } from '@shared/types';
import type { SSETaskUpdatePayload } from '../services/FrontendEventTypes';
import { frontendEventBus } from '../services/timer/FrontendEventBus';

class SchedulerNotificationService {
  private permissionGranted: boolean = false;

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('此浏览器不支持通知功能');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';
      return this.permissionGranted;
    }

    return false;
  }

  sendNotification(title: string, options?: NotificationOptions): void {
    if (!this.permissionGranted) {
      console.warn('通知权限未授予');
      return;
    }

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: false,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  notifyTaskStart(task: UserTask): void {
    this.sendNotification(i18next.t('scheduler.notifications.taskStartTitle', { title: task.title }), {
      body: i18next.t('scheduler.notifications.taskStartBody', {
        priority: task.priority,
        duration: task.estimated_duration || i18next.t('scheduler.notifications.notSet'),
      }),
      tag: `task-start-${task.id}`,
    });
  }

  notifyTaskComplete(task: UserTask): void {
    this.sendNotification(i18next.t('scheduler.notifications.taskCompleteTitle', { title: task.title }), {
      body: i18next.t('scheduler.notifications.taskCompleteBody', {
        duration: task.actual_duration || i18next.t('scheduler.notifications.notRecorded'),
      }),
      tag: `task-complete-${task.id}`,
    });
  }

  notifyTimeSliceEnd(task: UserTask, nextQueue: number): void {
    const queueNames = [
      i18next.t('scheduler.notifications.queueExecution'),
      i18next.t('scheduler.notifications.queuePreparation'),
      i18next.t('scheduler.notifications.queueTodo'),
    ];
    this.sendNotification(i18next.t('scheduler.notifications.timeSliceEndTitle', { title: task.title }), {
      body: i18next.t('scheduler.notifications.timeSliceEndBody', {
        queueName: queueNames[nextQueue] || i18next.t('scheduler.notifications.queueFallback', { index: nextQueue }),
      }),
      tag: `time-slice-${task.id}`,
    });
  }

  notifyBreak(): void {
    this.sendNotification(i18next.t('scheduler.notifications.breakTitle'), {
      body: i18next.t('scheduler.notifications.breakBody'),
      tag: 'break-start',
    });
  }

  notifyBreakEnd(): void {
    this.sendNotification(i18next.t('scheduler.notifications.breakEndTitle'), {
      body: i18next.t('scheduler.notifications.breakEndBody'),
      tag: 'break-end',
    });
  }

  notifyDeadline(task: UserTask): void {
    this.sendNotification(i18next.t('scheduler.notifications.deadlineTitle', { title: task.title }), {
      body: i18next.t('scheduler.notifications.deadlineBody'),
      tag: `deadline-${task.id}`,
      requireInteraction: true,
    });
  }
}

class SchedulerSoundService {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  init(): void {
    if (this.audioContext) {
      return;
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        this.audioContext = new AudioContextCtor();
      }
    } catch (e) {
      console.warn('无法初始化音频上下文:', e);
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.enabled || !this.audioContext) {
      return;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  private playSequence(notes: { frequency: number; duration: number; delay: number }[]): void {
    notes.forEach((note) => {
      setTimeout(() => {
        this.playTone(note.frequency, note.duration);
      }, note.delay);
    });
  }

  playStart(): void {
    this.init();
    this.playSequence([
      { frequency: 523.25, duration: 0.15, delay: 0 },
      { frequency: 659.25, duration: 0.15, delay: 150 },
      { frequency: 783.99, duration: 0.2, delay: 300 },
    ]);
  }

  playComplete(): void {
    this.init();
    this.playSequence([
      { frequency: 783.99, duration: 0.1, delay: 0 },
      { frequency: 880.0, duration: 0.1, delay: 100 },
      { frequency: 987.77, duration: 0.1, delay: 200 },
      { frequency: 1046.5, duration: 0.3, delay: 300 },
    ]);
  }

  playAlert(): void {
    this.init();
    this.playSequence([
      { frequency: 880.0, duration: 0.1, delay: 0 },
      { frequency: 880.0, duration: 0.1, delay: 200 },
      { frequency: 880.0, duration: 0.1, delay: 400 },
    ]);
  }

  playBreak(): void {
    this.init();
    this.playSequence([
      { frequency: 392.0, duration: 0.2, delay: 0 },
      { frequency: 440.0, duration: 0.2, delay: 200 },
      { frequency: 392.0, duration: 0.2, delay: 400 },
    ]);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

class DeadlineChecker {
  private notifiedTasks: Set<string> = new Set();
  private tasks: UserTask[] = [];
  private unsubscribers: (() => void)[] = [];

  startCheck(tasks: UserTask[]): void {
    this.stopCheck();
    this.tasks = tasks;
    this.checkExistingTasks();

    const unsub1 = frontendEventBus.subscribe('sse_task_update', (payload: SSETaskUpdatePayload) => {
      this.handleTaskUpdate(payload);
    });

    this.unsubscribers = [unsub1];
  }

  stopCheck(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.tasks = [];
    this.notifiedTasks.clear();
  }

  private handleTaskUpdate(payload: SSETaskUpdatePayload): void {
    const task = this.tasks.find(t => t.id === payload.taskId);
    if (!task) return;
    this.checkTaskDeadline(task);
  }

  private checkExistingTasks(): void {
    this.tasks.forEach(task => {
      this.checkTaskDeadline(task);
    });
  }

  private checkTaskDeadline(task: UserTask): void {
    if (!task.deadline || task.status === 'completed' || task.status === 'cancelled') return;

    const deadlineDate = new Date(task.deadline);
    const now = new Date();
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const minutesUntilDeadline = timeDiff / (1000 * 60);

    if (minutesUntilDeadline <= 30 && minutesUntilDeadline > 0) {
      if (!this.notifiedTasks.has(task.id)) {
        this.notifiedTasks.add(task.id);
        this.playDeadlineNotification(task);
      }
    }

    if (minutesUntilDeadline <= 0) {
      this.notifiedTasks.delete(task.id);
    }
  }

  private playDeadlineNotification(task: UserTask): void {
    schedulerNotificationService.notifyDeadline(task);
    schedulerSoundService.playAlert();
  }
}

export const schedulerNotificationService = new SchedulerNotificationService();
export const schedulerSoundService = new SchedulerSoundService();
export const deadlineChecker = new DeadlineChecker();

export { SchedulerNotificationService, SchedulerSoundService, DeadlineChecker };

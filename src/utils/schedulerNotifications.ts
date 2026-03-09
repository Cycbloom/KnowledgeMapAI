import type { ScheduledTask } from '@shared/types';

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

  notifyTaskStart(task: ScheduledTask): void {
    this.sendNotification(`任务开始: ${task.title}`, {
      body: `优先级: ${task.priority} | 预计时长: ${task.estimated_duration || '未设置'}分钟`,
      tag: `task-start-${task.id}`,
    });
  }

  notifyTaskComplete(task: ScheduledTask): void {
    this.sendNotification(`任务完成: ${task.title}`, {
      body: `实际用时: ${task.actual_duration || '未记录'}分钟`,
      tag: `task-complete-${task.id}`,
    });
  }

  notifyTimeSliceEnd(task: ScheduledTask, nextQueue: number): void {
    const queueNames = ['执行队列', '准备队列', '待办队列'];
    this.sendNotification(`时间片结束: ${task.title}`, {
      body: `任务已移至 ${queueNames[nextQueue] || `队列 ${nextQueue}`}`,
      tag: `time-slice-${task.id}`,
    });
  }

  notifyBreak(): void {
    this.sendNotification('休息时间', {
      body: '请休息一下，放松身心',
      tag: 'break-start',
    });
  }

  notifyBreakEnd(): void {
    this.sendNotification('休息结束', {
      body: '准备继续下一个任务',
      tag: 'break-end',
    });
  }

  notifyDeadline(task: ScheduledTask): void {
    this.sendNotification(`截止日期提醒: ${task.title}`, {
      body: '任务即将到期，请尽快完成',
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
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  private checkInterval: NodeJS.Timeout | null = null;
  private notifiedTasks: Set<string> = new Set();

  startCheck(tasks: ScheduledTask[], onDeadline: (task: ScheduledTask) => void): void {
    this.stopCheck();

    const check = () => {
      const now = new Date();

      tasks.forEach((task) => {
        if (task.deadline && task.status !== 'completed' && task.status !== 'cancelled') {
          const deadlineDate = new Date(task.deadline);
          const timeDiff = deadlineDate.getTime() - now.getTime();
          const minutesUntilDeadline = timeDiff / (1000 * 60);

          if (minutesUntilDeadline <= 30 && minutesUntilDeadline > 0) {
            if (!this.notifiedTasks.has(task.id)) {
              this.notifiedTasks.add(task.id);
              onDeadline(task);
            }
          }

          if (minutesUntilDeadline <= 0) {
            this.notifiedTasks.delete(task.id);
          }
        }
      });
    };

    check();
    this.checkInterval = setInterval(check, 60000);
  }

  stopCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.notifiedTasks.clear();
  }
}

export const schedulerNotificationService = new SchedulerNotificationService();
export const schedulerSoundService = new SchedulerSoundService();
export const deadlineChecker = new DeadlineChecker();

export { SchedulerNotificationService, SchedulerSoundService, DeadlineChecker };

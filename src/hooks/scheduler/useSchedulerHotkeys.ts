import { useEffect, useCallback } from 'react';

export interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export interface SchedulerHotkeysOptions {
  onNewTask?: () => void;
  onStartPause?: () => void;
  onComplete?: () => void;
  onClose?: () => void;
  onQueue0?: () => void;
  onQueue1?: () => void;
  onQueue2?: () => void;
  onToggleFocusMode?: () => void;
  onToggleMiniMode?: () => void;
  enabled?: boolean;
}

export const useSchedulerHotkeys = (options: SchedulerHotkeysOptions) => {
  const {
    onNewTask,
    onStartPause,
    onComplete,
    onClose,
    onQueue0,
    onQueue1,
    onQueue2,
    onToggleFocusMode,
    onToggleMiniMode,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      const isInput = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      if (event.key === 'n' && !isInput && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onNewTask?.();
        return;
      }

      if (event.key === ' ') {
        if (!isInput) {
          event.preventDefault();
          onStartPause?.();
        }
        return;
      }

      if (event.key === 'c' && !isInput && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onComplete?.();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === '1' && !isInput) {
        event.preventDefault();
        onQueue0?.();
        return;
      }

      if (event.key === '2' && !isInput) {
        event.preventDefault();
        onQueue1?.();
        return;
      }

      if (event.key === '3' && !isInput) {
        event.preventDefault();
        onQueue2?.();
        return;
      }

      if (event.key === 'f' && !isInput && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onToggleFocusMode?.();
        return;
      }

      if (event.key === 'm' && !isInput && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onToggleMiniMode?.();
        return;
      }
    },
    [
      enabled,
      onNewTask,
      onStartPause,
      onComplete,
      onClose,
      onQueue0,
      onQueue1,
      onQueue2,
      onToggleFocusMode,
      onToggleMiniMode,
    ]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);

  const hotkeys: HotkeyConfig[] = [
    { key: 'N', action: () => onNewTask?.(), description: '新建任务' },
    { key: 'Space', action: () => onStartPause?.(), description: '开始/暂停任务' },
    { key: 'C', action: () => onComplete?.(), description: '完成任务' },
    { key: 'Esc', action: () => onClose?.(), description: '关闭弹窗' },
    { key: '1', action: () => onQueue0?.(), description: '切换到Q0队列' },
    { key: '2', action: () => onQueue1?.(), description: '切换到Q1队列' },
    { key: '3', action: () => onQueue2?.(), description: '切换到Q2队列' },
    { key: 'F', action: () => onToggleFocusMode?.(), description: '切换专注模式' },
    { key: 'M', action: () => onToggleMiniMode?.(), description: '切换迷你模式' },
  ];

  return { hotkeys };
};

export const HOTKEY_LIST = [
  { key: 'N', description: '新建任务' },
  { key: 'Space', description: '开始/暂停任务' },
  { key: 'C', description: '完成任务' },
  { key: 'Esc', description: '关闭弹窗/退出专注模式' },
  { key: '1', description: '切换到Q0队列视图' },
  { key: '2', description: '切换到Q1队列视图' },
  { key: '3', description: '切换到Q2队列视图' },
  { key: 'F', description: '切换专注模式' },
  { key: 'M', description: '切换迷你模式' },
];

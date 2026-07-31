import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

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
  const { t } = useTranslation();
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
    { key: 'N', action: () => onNewTask?.(), description: t('scheduler.hotkeys.newTask') },
    { key: 'Space', action: () => onStartPause?.(), description: t('scheduler.hotkeys.startPauseTask') },
    { key: 'C', action: () => onComplete?.(), description: t('scheduler.hotkeys.completeTask') },
    { key: 'Esc', action: () => onClose?.(), description: t('scheduler.hotkeys.closePopup') },
    { key: '1', action: () => onQueue0?.(), description: t('scheduler.hotkeys.switchQ0') },
    { key: '2', action: () => onQueue1?.(), description: t('scheduler.hotkeys.switchQ1') },
    { key: '3', action: () => onQueue2?.(), description: t('scheduler.hotkeys.switchQ2') },
    { key: 'F', action: () => onToggleFocusMode?.(), description: t('scheduler.hotkeys.toggleFocusMode') },
    { key: 'M', action: () => onToggleMiniMode?.(), description: t('scheduler.hotkeys.toggleMiniMode') },
  ];

  return { hotkeys };
};

export const HOTKEY_LIST = [
  { key: 'N', description: i18next.t('scheduler.hotkeys.newTask') },
  { key: 'Space', description: i18next.t('scheduler.hotkeys.startPauseTask') },
  { key: 'C', description: i18next.t('scheduler.hotkeys.completeTask') },
  { key: 'Esc', description: i18next.t('scheduler.hotkeys.closePopupExitFocus') },
  { key: '1', description: i18next.t('scheduler.hotkeys.switchQ0View') },
  { key: '2', description: i18next.t('scheduler.hotkeys.switchQ1View') },
  { key: '3', description: i18next.t('scheduler.hotkeys.switchQ2View') },
  { key: 'F', description: i18next.t('scheduler.hotkeys.toggleFocusMode') },
  { key: 'M', description: i18next.t('scheduler.hotkeys.toggleMiniMode') },
];

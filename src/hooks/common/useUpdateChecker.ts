import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '@/config/electronConfig';

export interface UpdateProgress {
  percent: number;
  speed: number;
  transferred: number;
  total: number;
}

export interface UpdateInfo {
  version?: string;
  releaseNotes?: string | Record<string, unknown>;
  releaseName?: string;
  releaseDate?: string;
  [key: string]: unknown;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    info: null,
    progress: null,
    error: null,
  });

  useEffect(() => {
    if (!isElectron()) return;

    const unsubscribers: (() => void)[] = [];

    const api = window.electronAPI?.update;
    if (!api) return;

    unsubscribers.push(
      api.onChecking(() => {
        setState({ status: 'checking', info: null, progress: null, error: null });
      }),
    );

    unsubscribers.push(
      api.onAvailable((info) => {
        setState({ status: 'available', info, progress: null, error: null });
      }),
    );

    unsubscribers.push(
      api.onNotAvailable(() => {
        setState({ status: 'not-available', info: null, progress: null, error: null });
        const timer = setTimeout(() => {
          setState({ status: 'idle', info: null, progress: null, error: null });
        }, 3000);
        unsubscribers.push(() => clearTimeout(timer));
      }),
    );

    unsubscribers.push(
      api.onError((data) => {
        setState({ status: 'error', info: null, progress: null, error: data.error });
      }),
    );

    unsubscribers.push(
      api.onDownloadProgress((progress) => {
        setState((prev) => ({
          ...prev,
          status: 'downloading',
          progress,
          error: null,
        }));
      }),
    );

    unsubscribers.push(
      api.onDownloaded((info) => {
        setState({ status: 'downloaded', info, progress: null, error: null });
      }),
    );

    const menuApi = window.electronAPI?.menu;
    if (menuApi) {
      unsubscribers.push(
        menuApi.onAction((data) => {
          if (data.action === 'checkUpdates') {
            api.check();
          }
        }),
      );
    }

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  }, []);

  const checkForUpdates = useCallback(() => {
    if (!isElectron()) return;
    window.electronAPI?.update.check();
  }, []);

  const confirmDownload = useCallback(() => {
    if (!isElectron()) return;
    window.electronAPI?.update.confirmDownload();
  }, []);

  const confirmInstall = useCallback(() => {
    if (!isElectron()) return;
    window.electronAPI?.update.installConfirmed();
  }, []);

  const dismiss = useCallback(() => {
    setState({ status: 'idle', info: null, progress: null, error: null });
  }, []);

  return {
    ...state,
    checkForUpdates,
    confirmDownload,
    confirmInstall,
    dismiss,
  };
}
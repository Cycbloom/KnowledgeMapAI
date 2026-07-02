import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { frontendEventBus } from '../../services/timer/FrontendEventBus';
import type { SSEStatusChangedPayload } from '../../services/FrontendEventTypes';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type SSEConnectionStatus = SSEStatusChangedPayload['status'];

export const SSEStatusIndicator = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = frontendEventBus.subscribe('sse_status_changed', (payload: SSEStatusChangedPayload) => {
      setStatus(payload.status);
      setError(payload.error ?? null);
    });
    return unsubscribe;
  }, []);

  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          label: t('layout.sse.connected'),
          tooltip: t('layout.sse.connectedTooltip')
        };
      case 'connecting':
        return {
          icon: Loader2,
          color: 'text-primary-500',
          bgColor: 'bg-primary-100 dark:bg-primary-900/30',
          label: t('layout.sse.connecting'),
          tooltip: error || t('layout.sse.connectingTooltip')
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          label: t('layout.sse.error'),
          tooltip: error || t('layout.sse.errorTooltip')
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          label: t('layout.sse.disconnected'),
          tooltip: t('layout.sse.disconnectedTooltip')
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (status === 'disconnected') {
    return null;
  }

  return (
    <div
      className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', statusInfo.bgColor, statusInfo.color)}
      title={statusInfo.tooltip}
      aria-live="polite"
      aria-atomic="true"
    >
      <StatusIcon size={14} className={status === 'connecting' ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{statusInfo.label}</span>
    </div>
  );
};

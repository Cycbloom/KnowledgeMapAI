import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

export const SSEStatusIndicator = () => {
  const { t } = useTranslation();
  const { sseStatus, sseError } = useStore();

  const getStatusInfo = () => {
    switch (sseStatus) {
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
          color: 'text-blue-500',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          label: t('layout.sse.connecting'),
          tooltip: sseError || t('layout.sse.connectingTooltip')
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          label: t('layout.sse.error'),
          tooltip: sseError || t('layout.sse.errorTooltip')
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

  if (sseStatus === 'disconnected') {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
      title={statusInfo.tooltip}
    >
      <StatusIcon size={14} className={sseStatus === 'connecting' ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{statusInfo.label}</span>
    </div>
  );
};
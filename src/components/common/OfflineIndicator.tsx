import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from '@/lib/utils';
import { WifiOff } from "lucide-react";
import { useNetworkStatus, useTheme } from "../../hooks";

export const OfflineIndicator: React.FC = () => {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const { isDark } = useTheme();

  if (isOnline) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border animate-bounce-in backdrop-blur-sm transition-all duration-300',
        isDark
          ? 'bg-red-900/90 text-red-100 border-red-800'
          : 'bg-red-500/90 text-white border-red-600',
      )}
    >
      <WifiOff size={18} />
      <span className="text-sm font-medium">{t('toast.common.offlineMode')}</span>
    </div>
  );
};

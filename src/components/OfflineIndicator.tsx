import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTheme } from '../hooks/useTheme';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useNetworkStatus();
  const { isDark } = useTheme();

  if (isOnline) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border animate-bounce-in ${
      isDark 
        ? 'bg-red-900/90 text-red-100 border-red-800' 
        : 'bg-red-500/90 text-white border-red-600'
    } backdrop-blur-sm transition-all duration-300`}>
      <WifiOff size={18} />
      <span className="text-sm font-medium">离线模式：部分 AI 功能不可用</span>
    </div>
  );
};

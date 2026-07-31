import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSyncStatus } from '../../hooks/common/useSyncStatus';
import { SyncDetailPanel } from './SyncDetailPanel';
import { cn } from '@/lib/utils';
import { useReducedMotionOrPreference } from '../../hooks/common/useReducedMotionOrPreference';

type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

function getSyncState(status: ReturnType<typeof useSyncStatus>['status']): SyncState {
  if (!status) return 'offline';
  if (!status.isOnline) return 'offline';
  if (status.error) return 'error';
  if (status.pendingPush > 0) return 'syncing';
  return 'synced';
}

export function SyncStatusIndicator() {
  const { t } = useTranslation();
  const { status, isLocalAvailable, manualSync } = useSyncStatus();
  const [showPanel, setShowPanel] = useState(false);
  const { reduceMotion } = useReducedMotionOrPreference();

  const stateConfig = useMemo<Record<SyncState, { icon: typeof Check; color: string; label: string; spin?: boolean }>>(
    () => ({
      synced: { icon: Check, color: 'text-green-500', label: t('common.syncStatus.synced') },
      syncing: { icon: RefreshCw, color: 'text-blue-500', label: t('common.syncStatus.syncing'), spin: true },
      offline: { icon: WifiOff, color: 'text-gray-400', label: t('common.syncStatus.offline') },
      error: { icon: AlertCircle, color: 'text-red-500', label: t('common.syncStatus.error') },
    }),
    [t],
  );

  // Don't render if local DB is not available (web mode or dev mode)
  if (!isLocalAvailable) return null;

  const state = getSyncState(status);
  const config = stateConfig[state];
  const Icon = config.icon;
  const shouldSpin = config.spin && !reduceMotion;

  return (
    <div className="relative" aria-live="polite" aria-atomic="true">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-white/10 transition-colors', config.color)}
        title={config.label}
      >
        <motion.div
          animate={shouldSpin ? { rotate: 360 } : {}}
          transition={shouldSpin ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Icon className="w-3.5 h-3.5" />
        </motion.div>
        <span className="hidden sm:inline">{config.label}</span>
        {status?.pendingPush ? (
          <span className="bg-blue-500 text-white rounded-full px-1 text-[10px] min-w-[16px] text-center">
            {status.pendingPush}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {showPanel && (
          <SyncDetailPanel
            status={status}
            onSync={manualSync}
            onClose={() => setShowPanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

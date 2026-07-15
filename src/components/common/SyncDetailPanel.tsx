import { motion } from 'framer-motion';
import { X, RefreshCw, Clock, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import type { SyncStatus } from '../../../shared/types/ipc';
import { formatDate } from '../../utils/formatters';

interface SyncDetailPanelProps {
  status: SyncStatus | null;
  onSync: () => Promise<boolean>;
  onClose: () => void;
}

export function SyncDetailPanel({ status, onSync, onClose }: SyncDetailPanelProps) {
  const handleSync = async () => {
    await onSync();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50"
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">同步状态</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Last sync time */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>
            {status?.lastSyncAt
              ? `上次同步: ${formatDate(status.lastSyncAt, 'short-datetime')}`
              : '尚未同步'}
          </span>
        </div>

        {/* Pending counts */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 text-sm">
            <ArrowUp className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">
              待推送: <span className="font-medium text-gray-900 dark:text-gray-100">{status?.pendingPush ?? 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowDown className="w-4 h-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">
              待拉取: <span className="font-medium text-gray-900 dark:text-gray-100">{status?.pendingPull ?? 0}</span>
            </span>
          </div>
        </div>

        {/* Conflicts */}
        {status?.conflicts ? (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>{status.conflicts} 个同步冲突</span>
          </div>
        ) : null}

        {/* Error */}
        {status?.error ? (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
            {status.error}
          </div>
        ) : null}

        {/* Manual sync button */}
        <button
          onClick={handleSync}
          disabled={!status?.isOnline}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          立即同步
        </button>
      </div>
    </motion.div>
  );
}

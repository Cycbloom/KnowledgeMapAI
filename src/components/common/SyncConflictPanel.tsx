import { motion } from 'framer-motion';
import { AlertTriangle, Cloud, Monitor, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { formatDate } from '../../utils/formatters';
import { useFocusTrap, useEscapeKey } from '../../hooks';

interface ConflictItem {
  id: string;
  tableName: string;
  recordId: string;
  localData: string;
  remoteData: string;
  createdAt: string;
}

interface SyncConflictPanelProps {
  conflicts: ConflictItem[];
  onResolve: (conflictId: string, resolution: 'local' | 'remote') => void;
  onClose: () => void;
}

export function SyncConflictPanel({ conflicts, onResolve, onClose }: SyncConflictPanelProps) {
  const { t } = useTranslation();
  const hasConflicts = conflicts.length > 0;
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: hasConflicts });
  useEscapeKey(() => onClose(), hasConflicts);
  const titleId = useId();
  if (conflicts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('common.syncConflict.title', { count: conflicts.length })}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-4">
          {conflicts.map(conflict => (
            <div key={conflict.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t('common.syncConflict.tableLabel')}: {conflict.tableName} | {t('common.syncConflict.recordIdLabel')}: {conflict.recordId.slice(0, 8)}... |
                {t('common.syncConflict.timeLabel')}: {formatDate(conflict.createdAt, 'short-datetime')}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Local version */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-sm font-medium text-blue-600">
                    <Monitor className="w-4 h-4" />
                    {t('common.syncConflict.localVersion')}
                  </div>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-auto max-h-32">
                    {formatJson(conflict.localData)}
                  </pre>
                  <button
                    onClick={() => onResolve(conflict.id, 'local')}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Check className="w-3 h-3" />
                    {t('common.syncConflict.keepLocal')}
                  </button>
                </div>

                {/* Remote version */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                    <Cloud className="w-4 h-4" />
                    {t('common.syncConflict.remoteVersion')}
                  </div>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-auto max-h-32">
                    {formatJson(conflict.remoteData)}
                  </pre>
                  <button
                    onClick={() => onResolve(conflict.id, 'remote')}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
                  >
                    <Check className="w-3 h-3" />
                    {t('common.syncConflict.keepRemote')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatJson(jsonStr: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2);
  } catch {
    return jsonStr;
  }
}

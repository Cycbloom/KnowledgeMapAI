import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, RefreshCw, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';
import { useTheme } from '@/hooks';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';
import type { TaskRuntimeProgress } from '@shared/types/common';

export interface LevelTestNotice {
  status: 'generating' | 'success' | 'error' | 'timeout';
  current?: number;
  total?: number;
  /** 任务运行时进度（含 stageLabel 的题量信息与百分比），用于按题目数量展示 */
  progress?: TaskRuntimeProgress;
  /** 发起来源，用于跳转测验时保留返回行为 */
  from?: 'graph' | 'learning';
  nodeId: string;
  graphId: string;
}

interface LevelTestNotificationProps {
  notice: LevelTestNotice | null;
  onClose: () => void;
  onStart: () => void;
}

export const LevelTestNotification: React.FC<LevelTestNotificationProps> = ({
  notice,
  onClose,
  onStart,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          transition={transitionOverride ?? { duration: 0.2 }}
          className={cn(
            'fixed bottom-4 right-4 z-modal-overlay w-80 rounded-lg shadow-xl border backdrop-blur-sm',
            isDark
              ? 'bg-slate-800/95 border-slate-700 text-slate-200'
              : 'bg-white/95 border-slate-200 text-slate-800',
          )}
          role="alert"
          aria-live="polite"
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {notice.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : notice.status === 'generating' ? (
                  <RefreshCw className="w-5 h-5 text-primary-500 shrink-0 animate-spin" />
                ) : notice.status === 'timeout' ? (
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="text-sm font-medium">
                  {notice.status === 'success'
                    ? t('nodeDetail.levelTestReady')
                    : notice.status === 'generating'
                      ? (notice.progress?.stageLabel ?? t('nodeDetail.levelTestGenerating'))
                      : notice.status === 'timeout'
                        ? t('nodeDetail.levelTestGenerateTimeout')
                        : t('nodeDetail.levelTestGenerateFailed')}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'p-1 rounded transition-colors shrink-0',
                  isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100',
                )}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {notice.status === 'generating' &&
              typeof notice.progress?.percent === 'number' && (
                <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 mb-3">
                  <div
                    className="h-full bg-primary-500 dark:bg-primary-400 transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, notice.progress.percent))}%`,
                    }}
                  />
                </div>
              )}

            {notice.status === 'success' && (
              <button
                type="button"
                onClick={onStart}
                className="w-full py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
              >
                {t('nodeDetail.levelTestStartQuiz')}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LevelTestNotification;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';
import { useTheme } from '@/hooks';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';
import type { GoalDialogVariantNotice } from '../../store/useGoalDialogVariantNotificationStore';

interface GoalDialogVariantNotificationProps {
  notice: GoalDialogVariantNotice | null;
  onClose: () => void;
  onContinue: () => void;
}

/**
 * 「生成候选学习路径」后台任务完成通知（右下角弹窗）。
 *
 * 候选路径由后台任务异步生成（AI 较耗时），面板提交后即可关闭。任务完成后
 * 由此通知引导用户回到图谱地图，打开面板续接（选中变体 → 保存路径）。
 */
export const GoalDialogVariantNotification: React.FC<
  GoalDialogVariantNotificationProps
> = ({ notice, onClose, onContinue }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={
            reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }
          }
          animate={
            reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
          }
          exit={
            reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }
          }
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
                  <Route className="w-5 h-5 text-primary-500 shrink-0 animate-pulse" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="text-sm font-medium">
                  {notice.status === 'success'
                    ? t(
                        'graphMap.crossGraph.goalDialog.notification.completed',
                        { count: notice.variantCount ?? 0 },
                      )
                    : notice.status === 'generating'
                      ? t(
                          'graphMap.crossGraph.goalDialog.notification.generating',
                        )
                      : t('graphMap.crossGraph.goalDialog.notification.failed')}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'p-1 rounded transition-colors shrink-0',
                  isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100',
                )}
                aria-label={t('common.aria.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {notice.status === 'success' && (
              <button
                type="button"
                onClick={onContinue}
                className="w-full py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
              >
                {t('graphMap.crossGraph.goalDialog.notification.continue')}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoalDialogVariantNotification;
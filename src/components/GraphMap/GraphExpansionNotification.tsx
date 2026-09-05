import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X, Sparkles, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';
import { useTheme } from '@/hooks';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';
import type { GraphExpansionNotice } from '../../store/useGraphExpansionNotificationStore';

interface GraphExpansionNotificationProps {
  notice: GraphExpansionNotice | null;
  onClose: () => void;
  onContinue: () => void;
}

/**
 * AI 智能拓展（深度/宽度）后台任务完成通知（右下角弹窗）。
 *
 * 拓展是后台任务，用户提交后即可关闭面板或离开当前界面。任务完成后由此通知
 * 引导用户跳回发起界面查看新增图谱/节点，避免结果被忽略。
 */
export const GraphExpansionNotification: React.FC<
  GraphExpansionNotificationProps
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
                  <Loader2 className="w-5 h-5 text-primary-500 shrink-0 animate-spin" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="text-sm font-medium">
                  {notice.status === 'success'
                    ? notice.mode === 'depth'
                      ? t('graphEditor.graphMap.aiExpansion.notification.completedDeep', {
                          nodes: notice.count?.nodes ?? 0,
                        })
                      : t('graphEditor.graphMap.aiExpansion.notification.completedWidth', {
                          graphs: notice.count?.graphs ?? 0,
                          nodes: notice.count?.nodes ?? 0,
                        })
                    : notice.status === 'generating'
                      ? notice.progress != null
                        ? t('graphEditor.graphMap.aiExpansion.notification.generatingProgress', {
                            progress: notice.progress,
                          })
                        : t('graphEditor.graphMap.aiExpansion.notification.generating')
                      : t('graphEditor.graphMap.aiExpansion.notification.failed')}
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
                className="w-full py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                {notice.mode === 'depth'
                  ? t('graphEditor.graphMap.aiExpansion.notification.viewNodes')
                  : t('graphEditor.graphMap.aiExpansion.notification.viewGraphs')}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GraphExpansionNotification;
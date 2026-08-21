import { useTranslation } from 'react-i18next';

interface FocusTopicBadgeProps {
  focusTopic?: string | null;
  variant?: 'pill' | 'text';
}

export function FocusTopicBadge({ focusTopic, variant = 'pill' }: FocusTopicBadgeProps) {
  const { t } = useTranslation();
  if (!focusTopic || typeof focusTopic !== 'string' || focusTopic.trim().length === 0) {
    return null;
  }
  const label = t('study.quiz.focusTopic', '考察点');
  if (variant === 'text') {
    return (
      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate leading-tight" title={focusTopic}>
        {label}：{focusTopic}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="uppercase tracking-widest text-[10px] md:text-[11px] font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
        {label}
      </span>
      <span className="text-sm md:text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-200 line-clamp-2" title={focusTopic}>
        {focusTopic}
      </span>
    </div>
  );
}

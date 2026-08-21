import { useTranslation } from 'react-i18next';

interface FocusTopicBadgeProps {
  focusTopic?: string | null;
  variant?: 'pill' | 'text';
  isActive?: boolean;
  /**
   * 当置于 flex 同行布局中作为"弹性左端元素"时启用：
   * 组件会占满剩余空间并在考察点过长时省略截断，不会挤压右侧兄弟元素（如题型/难度 badge）
   */
  grow?: boolean;
}

export function FocusTopicBadge({ focusTopic, variant = 'pill', isActive = false, grow = false }: FocusTopicBadgeProps) {
  const { t } = useTranslation();
  if (!focusTopic || typeof focusTopic !== 'string' || focusTopic.trim().length === 0) {
    return null;
  }
  const label = t('study.quiz.focusTopic', '考察点');
  if (variant === 'text') {
    const colorClass = isActive
      ? 'text-white/85'
      : 'text-slate-500 dark:text-slate-400';
    return (
      <div className={`text-[11px] font-medium truncate leading-tight ${colorClass}`} title={focusTopic}>
        {label}：{focusTopic}
      </div>
    );
  }
  // pill 模式：grow 时占满空间并对内容做省略
  const containerBase = 'flex items-center gap-1.5 min-w-0';
  const containerGrow = grow ? 'flex-1' : '';
  const containerWrap = grow ? 'flex-nowrap' : 'flex-wrap';
  return (
    <div className={`${containerBase} ${containerGrow} ${containerWrap}`}>
      <span className="shrink-0 uppercase tracking-widest text-[10px] md:text-[11px] font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
        {label}
      </span>
      <span
        className={`text-sm md:text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-200 min-w-0 ${
          grow ? 'truncate' : 'line-clamp-2'
        }`}
        title={focusTopic}
      >
        {focusTopic}
      </span>
    </div>
  );
}

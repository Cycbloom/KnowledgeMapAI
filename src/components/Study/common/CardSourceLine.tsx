import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';

interface CardSourceLineProps {
  knowledgePointTitle?: string | null;
  graphTitle?: string | null;
  className?: string;
}

export function CardSourceLine({ knowledgePointTitle, graphTitle, className }: CardSourceLineProps) {
  const { t } = useTranslation();
  const kp = knowledgePointTitle?.trim();
  const graph = graphTitle?.trim();
  if (!kp && !graph) return null;
  const parts = [kp, graph].filter((p): p is string => Boolean(p));
  const label = t('study.cardSource.source', '来源');
  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 text-[11px] leading-tight text-slate-500 dark:text-slate-400 ${className ?? ''}`}
      title={`${label}：${parts.join(' · ')}`}
    >
      <BookOpen size={12} className="shrink-0 opacity-60" aria-hidden="true" />
      <span className="shrink-0 opacity-70">{label}：</span>
      <span className="truncate">{parts.join(' · ')}</span>
    </div>
  );
}

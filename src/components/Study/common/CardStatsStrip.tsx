import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyCard } from '@shared/types';
import { Brain, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/utils/formatters';

export type CardStatsStripVariant = 'full' | 'masteryOnly';

interface CardStatsStripProps {
  card: StudyCard;
  isDark: boolean;
  isMobile?: boolean;
  /**
   * 'full'        — 内部渲染：掌握度行 + 时间元信息行（默认，兼容旧用法）
   * 'masteryOnly' — 只渲染掌握度行，时间行由外部按自定义顺序放置（通过 CardDatesLine 复用）
   */
  variant?: CardStatsStripVariant;
}

interface CardDatesLineProps {
  card: StudyCard;
  isDark: boolean;
  isMobile?: boolean;
  className?: string;
}

type Tone = 'sky' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate';

const TONE_MAP: Record<Tone, {
  textLight: string;
  textDark: string;
  pillBgLight: string;
  pillBgDark: string;
  barBgLight: string;
  barBgDark: string;
  barFillLight: string;
  barFillDark: string;
}> = {
  sky: {
    textLight: 'text-sky-700',
    textDark: 'text-sky-400',
    pillBgLight: 'bg-sky-50',
    pillBgDark: 'bg-sky-950/40',
    barBgLight: 'bg-sky-100/70',
    barBgDark: 'bg-sky-900/40',
    barFillLight: 'bg-sky-500',
    barFillDark: 'bg-sky-400',
  },
  amber: {
    textLight: 'text-amber-700',
    textDark: 'text-amber-400',
    pillBgLight: 'bg-amber-50',
    pillBgDark: 'bg-amber-950/40',
    barBgLight: 'bg-amber-100/70',
    barBgDark: 'bg-amber-900/40',
    barFillLight: 'bg-amber-500',
    barFillDark: 'bg-amber-400',
  },
  emerald: {
    textLight: 'text-emerald-700',
    textDark: 'text-emerald-400',
    pillBgLight: 'bg-emerald-50',
    pillBgDark: 'bg-emerald-950/40',
    barBgLight: 'bg-emerald-100/70',
    barBgDark: 'bg-emerald-900/40',
    barFillLight: 'bg-emerald-500',
    barFillDark: 'bg-emerald-400',
  },
  rose: {
    textLight: 'text-rose-700',
    textDark: 'text-rose-400',
    pillBgLight: 'bg-rose-50',
    pillBgDark: 'bg-rose-950/40',
    barBgLight: 'bg-rose-100/70',
    barBgDark: 'bg-rose-900/40',
    barFillLight: 'bg-rose-500',
    barFillDark: 'bg-rose-400',
  },
  violet: {
    textLight: 'text-violet-700',
    textDark: 'text-violet-400',
    pillBgLight: 'bg-violet-50',
    pillBgDark: 'bg-violet-950/40',
    barBgLight: 'bg-violet-100/70',
    barBgDark: 'bg-violet-900/40',
    barFillLight: 'bg-violet-500',
    barFillDark: 'bg-violet-400',
  },
  slate: {
    textLight: 'text-slate-600',
    textDark: 'text-slate-400',
    pillBgLight: 'bg-slate-50',
    pillBgDark: 'bg-slate-800/50',
    barBgLight: 'bg-slate-100/70',
    barBgDark: 'bg-slate-700/50',
    barFillLight: 'bg-slate-400',
    barFillDark: 'bg-slate-500',
  },
} as const;

function pickToneClasses(tone: Tone, isDark: boolean) {
  const t = TONE_MAP[tone];
  return {
    text: isDark ? t.textDark : t.textLight,
    pillBg: isDark ? t.pillBgDark : t.pillBgLight,
    barBg: isDark ? t.barBgDark : t.barBgLight,
    barFill: isDark ? t.barFillDark : t.barFillLight,
  };
}

/**
 * Stability → 长期掌握度基准（0~1 归一化），对数饱和映射：
 *  S = 0     → 0%     （New/从未复习）
 *  S ≈ 1 天  → ~24%   （初学，Hard 档刚复习完的典型值）
 *  S ≈ 7 天  → ~50%   （熟悉，Good 档的典型值）
 *  S ≈ 30 天 → ~74%   （熟练）
 *  S ≈ 90 天 → ~86%   （接近精通）
 *  S = 365 天→ ~95%   （精通天花板）
 *  S → ∞     → 100%   （渐近）
 *
 * 选 log1p 饱和而非线性，是因为 FSRS 的 S 是指数增长（Good 档通常从 1→7→30→90…），
 * log1p 正好把指数增长的 S 映射到用户感知线性的进度条百分位。
 */
function stabilityToMasteryBaseline(stability: number): number {
  const s = Number.isFinite(stability) ? Math.max(0, stability) : 0;
  const HALF_LIFE_S = 7; // S=7 天映射到 ~50% 基准（对应熟悉档中心）
  return Math.max(0, Math.min(1, Math.log1p(s / HALF_LIFE_S) / Math.log(2)));
}

/**
 * 当前"掌握程度"综合得分（0~1，驱动进度条百分比与等级标签）
 * = 长期掌握水平（S 归一化 baseline）× 当前瞬时可回忆概率（时间衰减 R=exp(-Δt/S)）
 *
 * 这样两点语义同时满足：
 *  1) 刚复习完（Δt≈0，R≈1）：得分 = baseline，由 S 决定 → Hard→S小→低%，Easy→S大→高%
 *     ✓ 用户点"困难"不会再显示 100% 精通
 *  2) 过了几天（Δt>0，R 衰减）：得分 = baseline × R，进度条自然下降
 *     ✓ 时间流逝会"掉进度"，催促用户回到复习区间
 *
 * Fallback：若 S 非法/为 0，则退回 DB 存的 fsrs_retrievability（纯瞬时回忆概率），
 * 新卡（New）S=0 时显示 0% 初学。
 */
function computeEffectiveMastery(card: StudyCard, nowMs: number): number {
  const s = Number(card.fsrs_stability);
  const lastRaw = card.fsrs_last_review ?? card.last_reviewed;
  if (Number.isFinite(s) && s > 0) {
    const baseline = stabilityToMasteryBaseline(s);
    let decay = 1;
    if (lastRaw) {
      const diffMs = nowMs - new Date(lastRaw).getTime();
      const ΔtDays = Math.max(0, diffMs) / (24 * 60 * 60 * 1000);
      decay = Math.exp(-ΔtDays / s);
      if (!Number.isFinite(decay)) decay = 0;
    }
    return Math.max(0, Math.min(1, baseline * decay));
  }
  const stored = Number(card.fsrs_retrievability);
  if (Number.isFinite(stored)) return Math.max(0, Math.min(1, stored));
  return 0;
}

function getMasteryInfo(card: StudyCard, nowMs: number): {
  labelKey: string;
  tone: Tone;
  percent: number;
  retrievedFromLiveCalc: boolean;
} {
  const m = computeEffectiveMastery(card, nowMs);
  const percent = Math.round(m * 100);
  if (m < 0.25) return { labelKey: 'scheduler.review.mastery.beginner', tone: 'rose', percent, retrievedFromLiveCalc: m > 0 };
  if (m < 0.45) return { labelKey: 'scheduler.review.mastery.introductory', tone: 'amber', percent, retrievedFromLiveCalc: true };
  if (m < 0.65) return { labelKey: 'scheduler.review.mastery.familiar', tone: 'sky', percent, retrievedFromLiveCalc: true };
  if (m < 0.82) return { labelKey: 'scheduler.review.mastery.proficient', tone: 'violet', percent, retrievedFromLiveCalc: true };
  return { labelKey: 'scheduler.review.mastery.master', tone: 'emerald', percent, retrievedFromLiveCalc: true };
}

export function CardStatsStrip({
  card,
  isDark,
  isMobile = false,
  variant = 'full',
}: CardStatsStripProps) {
  const { t } = useTranslation();
  const nowMs = useMemo(() => new Date().getTime(), [card.fsrs_last_review, card.last_reviewed, card.fsrs_stability]);

  const mastery = useMemo(() => getMasteryInfo(card, nowMs), [card, nowMs]);
  const masteryTone = pickToneClasses(mastery.tone, isDark);

  const iconSize = isMobile ? 12 : 14;
  const baseMuted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex flex-col ${variant === 'full' ? 'gap-2' : 'gap-0'} w-full`}>
      {/* 掌握度条组件（独占整行，flex-1 占满所有可用宽度，右侧留给父级 space-between 放题型难度 badge）*/}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Brain size={iconSize} className={`shrink-0 ${masteryTone.text}`} />
        <span className={`text-[11px] md:text-xs font-medium shrink-0 ${baseMuted}`}>
          {t('scheduler.review.masteryLevel')}
        </span>
        <span
          className={`text-[11px] md:text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-md ${masteryTone.pillBg} ${masteryTone.text}`}
        >
          {t(mastery.labelKey as never)}
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div
            className={`flex-1 h-1.5 md:h-2 rounded-full overflow-hidden shrink ${masteryTone.barBg}`}
            role="progressbar"
            aria-valuenow={mastery.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${t('scheduler.review.masteryLevel')} ${mastery.percent}%`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${masteryTone.barFill}`}
              style={{ width: `${mastery.percent}%` }}
            />
          </div>
          <span className={`text-[11px] md:text-xs font-semibold tabular-nums shrink-0 ${masteryTone.text}`}>
            {mastery.percent}%
          </span>
        </div>
      </div>

      {variant === 'full' ? (
        <CardDatesLine card={card} isDark={isDark} isMobile={isMobile} />
      ) : null}
    </div>
  );
}

/**
 * 单独渲染复习时间信息（可被父级灵活放到任意位置）。
 * —— 语义修复：
 *   · 无任何时间字段（纯新卡从未复习过）整行隐藏，不造伪语义
 *   · 上次复习：永远正向表述「复习于 X」
 *   · 下次复习：如果 nextReview 在未来 → 「将于 X 后复习」；如果在过去 → 明确标为「已逾期 X」（红色警示图标）
 */
export function CardDatesLine({ card, isDark, isMobile = false, className = '' }: CardDatesLineProps) {
  const { t } = useTranslation();
  const lastReviewed = card.fsrs_last_review ?? card.last_reviewed;
  const nextReview = card.next_review;
  const nowMs = useMemo(() => new Date().getTime(), [nextReview, lastReviewed]);
  if (!lastReviewed && !nextReview) return null;

  const baseMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const baseStrong = isDark ? 'text-slate-200' : 'text-slate-700';
  const dotColor = isDark ? 'bg-slate-600' : 'bg-slate-300';

  // 下次复习时间的时态判定
  let nextMode: 'future' | 'overdue' | 'none' = 'none';
  let nextDeltaLabel = '';
  let nextFullTooltip = '';
  if (nextReview) {
    const diff = new Date(nextReview).getTime() - nowMs;
    nextFullTooltip = formatDate(nextReview, 'full-datetime');
    if (diff > 0) {
      nextMode = 'future';
      nextDeltaLabel = formatDate(nextReview, 'relative');
    } else {
      nextMode = 'overdue';
      nextDeltaLabel = formatDate(nextReview, 'relative');
    }
  }

  const overdueText = isDark ? 'text-rose-400' : 'text-rose-600';
  const futureText = isDark ? 'text-emerald-400' : 'text-emerald-600';

  return (
    <div className={`flex items-center gap-2 flex-wrap text-[11px] md:text-xs ${baseMuted} ${className}`.trim()}>
      {lastReviewed ? (
        <span className="inline-flex items-center gap-1" title={formatDate(lastReviewed, 'full-datetime')}>
          <Clock size={isMobile ? 10 : 12} className="shrink-0" />
          <span>
            <span className={`${baseStrong} font-medium`}>
              {t('nodeDetail.lastReview')}
            </span>
            <span className="ml-1">{formatDate(lastReviewed, 'relative')}</span>
          </span>
        </span>
      ) : null}

      {lastReviewed && nextMode !== 'none' ? (
        <span className={`inline-block w-1 h-1 rounded-full shrink-0 ${dotColor} align-middle`} />
      ) : null}

      {nextMode === 'future' ? (
        <span className="inline-flex items-center gap-1" title={nextFullTooltip}>
          <Calendar size={isMobile ? 10 : 12} className="shrink-0" />
          <span>
            <span className={`${baseStrong} font-medium`}>
              {t('scheduler.review.nextReview')}
            </span>
            <span className={`ml-1 ${futureText} font-semibold`}>
              {nextDeltaLabel}
            </span>
          </span>
        </span>
      ) : null}

      {nextMode === 'overdue' ? (
        <span
          className={`inline-flex items-center gap-1 ${overdueText} font-semibold`}
          title={nextFullTooltip}
        >
          <AlertTriangle size={isMobile ? 10 : 12} className="shrink-0" />
          <span>
            {t('scheduler.review.overdue', '已过期')}
            <span className="ml-1">{nextDeltaLabel}</span>
          </span>
        </span>
      ) : null}
    </div>
  );
}

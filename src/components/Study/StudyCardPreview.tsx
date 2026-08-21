import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Calendar, Eye, Play, Trash2, Edit2, CheckSquare, Square, Gauge } from 'lucide-react';
import { StudyCard } from '../../types';
import { formatDate } from '../../utils/formatters';
import { badgeToneClasses, getCardTypeBadgeMeta, type BadgeTone } from '../../utils/quizBadgeMeta';
import { getDifficultyBadgeMeta } from '../../utils/quizDifficultyMeta';
import { stabilityToMasteryBaseline } from '@shared/utils/fsrs/masteryContract';


interface StudyCardPreviewProps {
  card: StudyCard;
  isDark: boolean;
  onPreview?: (card: StudyCard) => void;
  onPractice?: (card: StudyCard) => void;
  onEdit?: (card: StudyCard) => void;
  onDelete?: (card: StudyCard) => void;
  onSelect?: (card: StudyCard) => void;
  selected?: boolean;
  selectionMode?: boolean;
  compact?: boolean; // For denser lists if needed
  deletePending?: boolean; // Whether the delete action is in-flight (disable + spinner)
}

const StudyCardPreviewComponent: React.FC<StudyCardPreviewProps> = ({
  card,
  isDark,
  onPreview,
  onPractice,
  onEdit,
  onDelete,
  onSelect,
  selected = false,
  selectionMode = false,
  deletePending = false,
}) => {
  const { t } = useTranslation();

  // ---------- Local helpers ----------
  const isNewCard = (card.review_count ?? 0) === 0;
  // Capture a single "now" at mount-time — avoids calling Date.now() during render (impure).
  // The overdue display is intentionally stable within a single mount; re-check only when card prop changes.
  const [mountedAt] = useState<number>(() => {
    if (typeof Date !== 'undefined' && typeof Date.now === 'function') {
      // eslint-disable-next-line react-hooks/purity
      return Date.now();
    }
    return 0;
  });
  const nextReviewTs = card.next_review ? new Date(card.next_review).getTime() : null;
  const isOverdue = !!nextReviewTs && nextReviewTs < mountedAt;

  // Show focus topic only when it exists AND is not a copy-paste of the question (fixture artifact).
  const hasDistinctFocusTopic =
    typeof card.focus_topic === 'string' &&
    card.focus_topic.trim().length > 0 &&
    card.focus_topic.trim().toLowerCase() !== card.question.trim().toLowerCase().slice(0, card.focus_topic.trim().length);

  // Card-type badge meta (colored pill, strong visual identity for quick scanning)
  const cardTypeMeta = getCardTypeBadgeMeta(card.card_type);
  const CardTypeIcon = cardTypeMeta.Icon;

  // Difficulty badge meta (1=easy 2=medium 3=hard)
  const difficultyMeta = getDifficultyBadgeMeta(card.difficulty);

  // Mastery → 5-tier semantic tone (matches shared DECAY_CONFIG thresholds: 0.18/0.36/0.54/0.72)
  const displayMastery = (() => {
    if (isNewCard) return 0;
    const stability = Number(card.fsrs_stability ?? 0);
    const retrievability = Number(card.fsrs_retrievability ?? 0);
    const baseline = Number.isFinite(stability) && stability > 0
      ? stabilityToMasteryBaseline(stability)
      : 0;
    // Baseline × decay (approximation, fallback to retrievability if present, else pure baseline)
    return retrievability > 0
      ? baseline * retrievability
      : baseline;
  })();
  const masteryTone: BadgeTone = (() => {
    if (displayMastery >= 0.72) return 'emerald';
    if (displayMastery >= 0.54) return 'teal';
    if (displayMastery >= 0.36) return 'amber';
    if (displayMastery >= 0.18) return 'orange';
    return 'rose';
  })();
  const masteryLabel = t('study.cardPreview.mastery', '掌握度');
  const masteryTooltip = `${masteryLabel}：${Math.round(displayMastery * 100)}%`;

  // ---------- Render ----------
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      aria-labelledby={`study-card-${card.id}-title`}
      className={`group relative flex h-full flex-col rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-xl overflow-hidden ${
        selected
          ? isDark
            ? 'border-primary-500 bg-primary-900/20 ring-2 ring-primary-500/30'
            : 'border-primary-200 bg-primary-50 ring-2 ring-primary-100'
          : isDark
            ? 'border-slate-700 bg-slate-800 hover:border-primary-500/40'
            : 'border-gray-100 bg-white hover:border-primary-200 shadow-sm'
      }`}
      onClick={() => { if (selectionMode && onSelect) onSelect(card); }}
    >
      {/* Selection checkbox */}
      {(selectionMode || onSelect) && (
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelect) onSelect(card);
            }}
            className={`flex h-9 w-9 min-w-[36px] min-h-[36px] items-center justify-center rounded-lg transition-colors ${
              selected ? 'text-primary-500' : 'text-gray-300 hover:text-gray-400'
            }`}
            aria-label={selected ? t('common.aria.selected') : t('common.aria.select')}
          >
            {selected ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>
        </div>
      )}

      {/* =========================================================
          ROW 1 — 四属性紧凑一行：题型 · 难度 · 掌握度 · 日期
          移除了「新内容/已学习」状态胶囊（用户认为是冗余信息）。
          使用 nowrap + ml-auto 防止日期被挤到第二行，保持始终单行。
         ========================================================= */}
      <div className="flex items-center gap-1.5 px-4 pt-4 pr-4">
        {/* 1) 题型徽章 */}
        <span className={badgeToneClasses(cardTypeMeta.tone, isDark, 'ring').replace('px-2.5', 'px-2').replace('py-1', 'py-0.5')}>
          <CardTypeIcon size={12} aria-hidden="true" />
          <span className="truncate font-semibold text-[11px]">
            {t(cardTypeMeta.labelKey, { defaultValue: card.card_type })}
          </span>
        </span>

        {/* 2) 难度徽章（有难度时才显示，无则留空不破坏节奏） */}
        {difficultyMeta && (
          <span className={badgeToneClasses(difficultyMeta.tone, isDark, 'ring').replace('px-2.5', 'px-2').replace('py-1', 'py-0.5')}>
            <Gauge size={12} aria-hidden="true" />
            <span className="truncate font-semibold text-[11px]">
              {t(difficultyMeta.labelKey, { defaultValue: difficultyMeta.labelKey })}
            </span>
          </span>
        )}

        {/* 3) 掌握度 chip — ml-auto 把自身和日期推到右侧 */}
        <span
          className={`inline-flex ml-auto items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ${
            isDark ? 'bg-slate-700/60 text-slate-300 ring-1 ring-slate-600/50' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-100'
          }`}
          title={masteryTooltip}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ring-1.5 ring-offset-0.5 shrink-0 ${
              masteryTone === 'emerald' ? 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900' :
              masteryTone === 'teal' ? 'bg-teal-500 ring-teal-200 dark:ring-teal-900' :
              masteryTone === 'amber' ? 'bg-amber-500 ring-amber-200 dark:ring-amber-900' :
              masteryTone === 'orange' ? 'bg-orange-500 ring-orange-200 dark:ring-orange-900' :
              'bg-rose-500 ring-rose-200 dark:ring-rose-900'
            }`}
          />
          <span className="font-bold tabular-nums shrink-0">{Math.round(displayMastery * 100)}%</span>
        </span>

        {/* 4) 日期 chip */}
        <span
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium ring-1 shrink-0 ${
            isOverdue
              ? isDark ? 'bg-orange-950/30 text-orange-300 ring-orange-800/50' : 'bg-orange-50 text-orange-700 ring-orange-100'
              : isDark ? 'bg-slate-700/60 text-slate-400 ring-slate-600/40' : 'bg-slate-50 text-slate-500 ring-slate-100'
          }`}
          title={card.next_review ? formatDate(card.next_review, 'full') : t('study.cardPreview.notStarted', '未开始复习')}
        >
          <Calendar size={11} aria-hidden="true" className="shrink-0" />
          <span className="shrink-0">
            {nextReviewTs && card.next_review
              ? (() => {
                  const days = Math.round((nextReviewTs - mountedAt) / 86400000);
                  if (days === 0) return t('study.cardPreview.dueToday', '今天');
                  if (days < 0) return t('study.cardPreview.overdueDays', { count: Math.abs(days), defaultValue: `逾期${Math.abs(days)}天` });
                  if (days === 1) return t('study.cardPreview.dueTomorrow', '明天');
                  return formatDate(card.next_review, 'short');
                })()
              : t('study.cardPreview.notStarted', '未开始')}
          </span>
        </span>
      </div>

      {/* =========================================================
          ROW 2 — 内容主体  (题干 + 答案，视觉靠近)
          如果有独立考察点 → 放在题干上方作为知识点标签
          如果考察点与题干重复 → 彻底不显示，避免噪音堆叠
         ========================================================= */}
      <div className="px-4 py-3.5 flex-1 flex flex-col justify-center">
        {hasDistinctFocusTopic && (
          <div className="mb-2 flex items-center gap-1.5 min-w-0">
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                isDark
                  ? 'bg-emerald-900/40 text-emerald-400 ring-1 ring-emerald-800/40'
                  : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
              }`}
            >
              {t('study.quiz.focusTopic', '考察点')}
            </span>
            <span
              className="truncate text-xs font-semibold leading-tight text-slate-600 dark:text-slate-300"
              title={card.focus_topic ?? ''}
            >
              {card.focus_topic}
            </span>
          </div>
        )}

        <h3
          id={`study-card-${card.id}-title`}
          className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-50"
          title={card.question}
        >
          {card.question}
        </h3>

        <p
          className={`mt-1.5 line-clamp-2 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}
          title={typeof card.answer === 'string' ? card.answer : undefined}
        >
          {typeof card.answer === 'string' && card.answer.length > 0 ? (
            card.answer
          ) : (
            <span className="italic opacity-60">{t('study.cardPreview.noAnswer', '（暂无答案摘要）')}</span>
          )}
        </p>
      </div>

      {/* =========================================================
          ROW 3 — 操作行  (辅助操作组  ↔  主 CTA)
          左：ghost 容器装预览/编辑/删除（次要操作，不抢视觉）
          右：练习按钮（主 CTA，实心胶囊）
         ========================================================= */}
      <div className={`px-4 pb-4 pt-1 flex items-center justify-between gap-2 ${
        isDark ? 'border-t border-slate-700/40' : 'border-t border-gray-50'
      }`}>
        {/* LEFT: secondary action group */}
        {(onPreview || onEdit || onDelete) ? (
          <div
            className={`inline-flex items-center p-0.5 rounded-lg ring-1 gap-0.5 ${
              isDark ? 'bg-slate-700/40 ring-slate-600/50' : 'bg-gray-50 ring-gray-200'
            }`}
            role="group"
            aria-label={t('study.cardPreview.button.group.secondary', '卡片辅助操作')}
          >
            {onPreview && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPreview(card); }}
                className={`inline-flex items-center justify-center h-8 w-8 min-w-[32px] min-h-[32px] rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  isDark
                    ? 'text-slate-400 hover:bg-slate-600/50 hover:text-primary-400'
                    : 'text-gray-500 hover:bg-white hover:text-primary-600'
                }`}
                title={t('study.cardPreview.button.preview', '预览')}
                aria-label={t('study.cardPreview.button.preview', '预览')}
              >
                <Eye size={14} />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                className={`inline-flex items-center justify-center h-8 w-8 min-w-[32px] min-h-[32px] rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isDark
                    ? 'text-slate-400 hover:bg-slate-600/50 hover:text-amber-400'
                    : 'text-gray-500 hover:bg-white hover:text-amber-600'
                }`}
                title={t('study.cardPreview.button.edit', '编辑')}
                aria-label={t('study.cardPreview.button.edit', '编辑')}
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(card); }}
                disabled={deletePending}
                aria-busy={deletePending}
                className={`inline-flex items-center justify-center h-8 w-8 min-w-[32px] min-h-[32px] rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isDark
                    ? 'text-slate-400 hover:bg-slate-600/50 hover:text-red-400'
                    : 'text-gray-500 hover:bg-white hover:text-red-600'
                }`}
                title={t('study.cardPreview.button.delete', '删除')}
                aria-label={t('study.cardPreview.button.delete', '删除')}
              >
                {deletePending ? (
                  <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* RIGHT: Primary CTA — Practice */}
        {onPractice && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPractice(card); }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition-all min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
              isDark
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20 hover:bg-primary-500 hover:-translate-y-px'
                : 'bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:-translate-y-px'
            }`}
            aria-label={t('study.cardPreview.button.practice', '练习这张卡片')}
          >
            <Play size={12} aria-hidden="true" />
            <span>{t('study.cardPreview.button.practice', '练习')}</span>
          </button>
        )}
      </div>
    </motion.article>
  );
};

const areEqual = (prev: StudyCardPreviewProps, next: StudyCardPreviewProps) => {
  return (
    prev.card.id === next.card.id &&
    prev.card.review_count === next.card.review_count &&
    prev.card.next_review === next.card.next_review &&
    prev.card.difficulty === next.card.difficulty &&
    prev.isDark === next.isDark &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.deletePending === next.deletePending
  );
};

export const StudyCardPreview = React.memo(StudyCardPreviewComponent, areEqual);

import React, { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, FileStack, CheckSquare, Square } from 'lucide-react';
import { useTheme } from "../../hooks";
import { useStudyCards } from '../../hooks/queries';
import type { StudyCard } from '@shared/types/common';

interface ReuseExistingCardsProps {
  knowledgePointIds: string[];
  selectedCardIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  qa: 'quiz.questionList.type.qa',
  choice: 'quiz.questionList.type.choice',
  multi_choice: 'quiz.questionList.type.multiChoice',
  true_false: 'quiz.questionList.type.trueFalse',
  fill_in_the_blank: 'quiz.questionList.type.fillInTheBlank',
  essay: 'quiz.questionList.type.essay',
  cloze: 'quiz.questionList.type.cloze',
  select_from_options: 'quiz.questionList.type.selectFromOptions',
  matching: 'quiz.questionList.type.matching',
  ordering: 'quiz.questionList.type.ordering',
};

const DIFF_LABEL_KEYS: Record<number, string> = {
  1: 'quiz.questionList.difficulty.easy',
  2: 'quiz.questionList.difficulty.fairlyEasy',
  3: 'quiz.questionList.difficulty.medium',
  4: 'quiz.questionList.difficulty.fairlyHard',
  5: 'quiz.questionList.difficulty.hard',
};

/**
 * 复用已有题目面板：拉取所选知识点下已生成的题目（study_cards），
 * 默认系统自动全选，用户可手动勾选/取消作为补充。
 */
export const ReuseExistingCards: React.FC<ReuseExistingCardsProps> = ({
  knowledgePointIds,
  selectedCardIds,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const { data: cards, isLoading } = useStudyCards(
    { knowledge_point_ids: knowledgePointIds },
    knowledgePointIds.length > 0,
  ) as { data?: StudyCard[]; isLoading: boolean };

  // 记录挂载时的初始选中（草稿恢复场景），避免自动全选覆盖草稿
  const restoredSelectionRef = useRef<string[] | null>(null);
  if (restoredSelectionRef.current === null) {
    restoredSelectionRef.current = selectedCardIds;
  }

  const kpKey = useMemo(() => [...knowledgePointIds].sort().join('|'), [knowledgePointIds]);
  const lastKpKeyRef = useRef<string>('');
  const autoSelectPendingRef = useRef<boolean>(false);

  useEffect(() => {
    if (kpKey !== lastKpKeyRef.current) {
      lastKpKeyRef.current = kpKey;
      const isRestored = (restoredSelectionRef.current?.length ?? 0) > 0;
      autoSelectPendingRef.current = !isRestored;
    }
  }, [kpKey]);

  useEffect(() => {
    if (autoSelectPendingRef.current && cards) {
      autoSelectPendingRef.current = false;
      if (cards.length > 0) {
        onChange(cards.map((c) => c.id));
      } else {
        onChange([]);
      }
    }
    // onChange 引用来自父组件 setFormData，稳定；仅依赖 cards 触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const selectedSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);

  const groups = useMemo(() => {
    const map = new Map<string, StudyCard[]>();
    for (const card of cards ?? []) {
      const key = card.knowledgePointTitle || card.knowledge_point_id || t('quiz.reuse.unknownGroup');
      const list = map.get(key);
      if (list) {
        list.push(card);
      } else {
        map.set(key, [card]);
      }
    }
    return Array.from(map.entries());
  }, [cards, t]);

  const totalCount = cards?.length ?? 0;
  const selectedCount = selectedCardIds.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  const toggleCard = (cardId: string) => {
    if (disabled) return;
    const next = selectedSet.has(cardId)
      ? selectedCardIds.filter((id) => id !== cardId)
      : [...selectedCardIds, cardId];
    onChange(next);
  };

  const toggleSelectAll = () => {
    if (disabled || !cards || cards.length === 0) return;
    onChange(allSelected ? [] : cards.map((c) => c.id));
  };

  const cardTypeLabel = (type: string): string =>
    t((TYPE_LABEL_KEYS[type] || 'quiz.questionList.type.qa') as never);
  const difficultyLabel = (difficulty?: number): string =>
    difficulty == null
      ? ''
      : t((DIFF_LABEL_KEYS[difficulty] || 'quiz.questionList.difficulty.medium') as never);

  const diffBadgeClass = (difficulty?: number): string => {
    const d = difficulty ?? 3;
    if (d <= 2) return isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-700';
    if (d === 3) return isDark ? 'bg-orange-900/40 text-orange-400' : 'bg-orange-50 text-orange-700';
    return isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-50 text-red-700';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileStack size={18} className={isDark ? 'text-primary-400' : 'text-primary-600'} />
          <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            {t('quiz.reuse.sectionTitle')}
          </span>
        </div>
        {totalCount > 0 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={disabled}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              isDark ? 'text-primary-400 hover:text-primary-300' : 'text-primary-600 hover:text-primary-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {allSelected ? <Square size={14} /> : <CheckSquare size={14} />}
            {allSelected ? t('quiz.reuse.deselectAll') : t('quiz.reuse.selectAll')}
          </button>
        )}
      </div>

      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
        {t('quiz.reuse.sectionDesc')}
      </p>

      {knowledgePointIds.length === 0 ? (
        <div className={`text-center py-6 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {t('quiz.reuse.needKnowledgePoints')}
          </p>
        </div>
      ) : isLoading ? (
        <div className={`flex items-center justify-center gap-2 py-6 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-gray-200 bg-gray-50'}`}>
          <Loader2 size={18} className="animate-spin text-primary-600" />
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {t('quiz.reuse.loading')}
          </span>
        </div>
      ) : totalCount === 0 ? (
        <div className={`text-center py-6 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {t('quiz.reuse.empty')}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
              {t('quiz.reuse.totalCount', { count: totalCount })}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-600'
            }`}>
              {t('quiz.reuse.selectedCount', { count: selectedCount })}
            </span>
          </div>

          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {groups.map(([groupTitle, groupCards]) => (
                <div key={groupTitle}>
                  <div className={`px-3 py-1.5 text-[11px] font-bold ${
                    isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {groupTitle} · {groupCards.length}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {groupCards.map((card) => {
                      const isSelected = selectedSet.has(card.id);
                      return (
                        <div
                          key={card.id}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={disabled ? -1 : 0}
                          onClick={() => toggleCard(card.id)}
                          onKeyDown={(e) => {
                            if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
                              e.preventDefault();
                              toggleCard(card.id);
                            }
                          }}
                          className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                            isSelected
                              ? isDark
                                ? 'bg-primary-900/20'
                                : 'bg-primary-50'
                              : isDark
                                ? 'hover:bg-slate-700/40'
                                : 'hover:bg-gray-100'
                          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : isDark
                                  ? 'border-slate-600'
                                  : 'border-gray-300'
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected && <Check size={12} aria-hidden="true" />}
                          </span>

                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug line-clamp-2 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                              {card.question}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {cardTypeLabel(card.card_type)}
                              </span>
                              {card.difficulty != null && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${diffBadgeClass(card.difficulty)}`}>
                                  {difficultyLabel(card.difficulty)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

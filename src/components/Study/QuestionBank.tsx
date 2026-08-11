import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StudyCard } from '../../types';
import { useUpdateCardMutation, useDeleteCardMutation, useDeleteCardsBatchMutation, useCreateCardsBatchMutation } from '../../hooks/mutations';
import { useStudyCardsInfinite } from '../../hooks/queries';
import { Search, Trash2, Filter, CheckSquare, Square, PlusCircle, XCircle } from 'lucide-react';
import { useTheme } from "../../hooks";
import { asyncConfirm } from '@/utils/asyncConfirm';
import { QuestionForm, QuestionFormData } from './QuestionForm';
import { StudyCardPreview } from './StudyCardPreview';
import { StudyCardDetailModal } from './StudyCardDetailModal';
import { useDebouncedSearch } from '../../hooks/common/useDebouncedSearch';
import { EmptyState } from '@/components/common/EmptyState';
import { message } from '@/utils/messageHelper';

interface QuestionBankProps {
  graph_id?: string;
  knowledge_point_id?: string;
  knowledge_point_ids?: string[];
  due?: boolean;
}

const ALL_FSRS_STATES = ["New", "Learning", "Review", "Relearning"];

export const QuestionBank: React.FC<QuestionBankProps> = ({ graph_id, knowledge_point_id, knowledge_point_ids, due }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { query: searchTerm, setQuery: setSearchTerm, debouncedQuery: debouncedSearchTerm } = useDebouncedSearch();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Filter State
  const [reviewCountRange, setReviewCountRange] = useState<{min: string, max: string}>({ min: '', max: '' });
  const [selectedFsrsStates, setSelectedFsrsStates] = useState<Set<string>>(new Set(["New", "Learning", "Review", "Relearning"]));
  const [nextReviewRange, setNextReviewRange] = useState<{start: string, end: string}>({ start: '', end: '' });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [_viewMode, _setViewMode] = useState<'list' | 'grid'>('grid');
  const [previewCard, setPreviewCard] = useState<StudyCard | null>(null);
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const formRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const deleteCardMutation = useDeleteCardMutation();
  const deleteBatchMutation = useDeleteCardsBatchMutation();
  const updateCardMutation = useUpdateCardMutation();
  const createCardsMutation = useCreateCardsBatchMutation();

  const filterArgs = useMemo(() => {
    const selected = Array.from(selectedFsrsStates);
    const allSelected = ALL_FSRS_STATES.every((s) => selected.includes(s));
    return {
      graph_id,
      knowledge_point_id,
      knowledge_point_ids,
      due,
      search: debouncedSearchTerm.trim() ? debouncedSearchTerm.trim() : undefined,
      card_type: selectedType === "all" ? undefined : selectedType,
      fsrs_state: allSelected ? undefined : selected.join(","),
      review_count_min: reviewCountRange.min.trim() !== "" ? parseInt(reviewCountRange.min, 10) : undefined,
      review_count_max: reviewCountRange.max.trim() !== "" ? parseInt(reviewCountRange.max, 10) : undefined,
      next_review_start: nextReviewRange.start || undefined,
      next_review_end: nextReviewRange.end || undefined,
      pageSize: 20,
    };
  }, [graph_id, knowledge_point_id, knowledge_point_ids, due, debouncedSearchTerm, selectedType, selectedFsrsStates, reviewCountRange, nextReviewRange]);

  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading } = useStudyCardsInfinite(filterArgs);
  const paginatedCards = useMemo(() => data?.pages.flatMap((p) => p.items ?? []) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const fsrsStateLabels: Record<string, string> = {
    "New": t('study.questionBank.fsrsStates.new'),
    "Learning": t('study.questionBank.fsrsStates.learning'),
    "Review": t('study.questionBank.fsrsStates.review'),
    "Relearning": t('study.questionBank.fsrsStates.relearning')
  };

  // Handlers
  const toggleFsrsState = (state: string) => {
    const newSet = new Set(selectedFsrsStates);
    if (newSet.has(state)) newSet.delete(state);
    else newSet.add(state);
    setSelectedFsrsStates(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCards.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBatchDelete = async () => {
    if (await asyncConfirm({ title: t('common.confirm.deleteTitle'), message: t('study.questionBank.deleteConfirm', { count: selectedIds.size }), isDangerous: true })) {
      try {
        await deleteBatchMutation.mutateAsync(Array.from(selectedIds));
        setSelectedIds(new Set());
      } catch (err: unknown) {
        console.error('Failed to batch delete:', err);
        message.error(t('study.batchDeleteFailed'));
      }
    }
  };

  const handleFormSubmit = async (data: QuestionFormData) => {
    if (editingCard) {
      try {
        await updateCardMutation.mutateAsync({
          id: editingCard.id,
          data: {
            question: data.question,
            answer: data.answer,
            explanation: data.explanation,
            options: data.options,
            card_type: data.card_type
          }
        });
        setEditingCard(null);
      } catch (err: unknown) {
        console.error('Failed to update card:', err);
        message.error(t('study.updateFailed'));
      }
    } else {
      try {
        await createCardsMutation.mutateAsync([{
          ...data,
          card_type: data.card_type
        }]);
        setIsCreating(false);
      } catch (err: unknown) {
        console.error('Failed to create cards:', err);
        message.error(t('study.createCardsFailed'));
      }
    }
  };

  const startEditing = (card: StudyCard) => {
    setEditingCard(card);
    setIsCreating(false);
    // Scroll to form
    setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingCard(null);
    // Scroll to form
    setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const isAllSelected = selectedIds.size === paginatedCards.length && paginatedCards.length > 0;
  const isPartialSelected = selectedIds.size > 0 && selectedIds.size < paginatedCards.length;

  return (
    <div className={`rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} overflow-hidden`}>
      {/* Toolbar */}
      <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div
            role="search"
            aria-label={t('common.aria.searchWithTarget', { target: t('study.tabs.bank') })}
            className="relative flex-1 max-w-md"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t('study.questionBank.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 rounded-lg border ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label={t('study.questionBank.clear')}
                title={t('study.questionBank.clear')}
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={`px-3 py-2 rounded-lg border ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200'
            }`}
          >
            <option value="all">{t('study.questionBank.allTypes')}</option>
            <option value="qa">{t('study.questionBank.typeQA')}</option>
            <option value="choice">{t('study.questionBank.typeChoice')}</option>
            <option value="true_false">{t('study.questionBank.typeTrueFalse')}</option>
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showAdvancedFilters
                ? 'bg-primary-100 border-primary-200 text-primary-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
            title={t('study.questionBank.advancedFilter')}
            aria-label={t('study.questionBank.advancedFilter')}
          >
            <Filter size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            role="checkbox"
            aria-checked={(isAllSelected ? "true" : isPartialSelected ? "mixed" : "false") as "true" | "false" | "mixed"}
            aria-label={isAllSelected ? t('study.questionBank.deselectAll') : t('study.questionBank.selectAll')}
            title={isAllSelected ? t('study.questionBank.deselectAll') : t('study.questionBank.selectAll')}
            className={`p-2 rounded-lg border transition-colors ${
              isAllSelected
                ? 'bg-primary-100 border-primary-200 text-primary-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-gray-400' : 'bg-white border-gray-200 text-gray-400'
            }`}
          >
            {isAllSelected ? (
              <CheckSquare size={20} aria-hidden="true" />
            ) : (
              <Square size={20} aria-hidden="true" />
            )}
          </button>

          {selectedIds.size > 0 && (
            <button 
              onClick={handleBatchDelete}
              disabled={deleteBatchMutation.isPending}
              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              aria-busy={deleteBatchMutation.isPending}
            >
              {deleteBatchMutation.isPending ? (
                <span
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 size={18} />
              )}
              <span>{t('study.questionBank.batchDelete')} ({selectedIds.size})</span>
            </button>
          )}
          
          <button
            onClick={startCreating}
            className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <PlusCircle size={18} />
            <span>{t('study.questionBank.newQuestion')}</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className={`p-4 border-b space-y-4 ${isDark ? 'bg-slate-800/30' : 'bg-gray-50/50'}`}>
          <div className="flex flex-wrap gap-6">
            {/* Review Count Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">{t('study.questionBank.reviewCount')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={reviewCountRange.min}
                  onChange={(e) => setReviewCountRange({ ...reviewCountRange, min: e.target.value })}
                  className={`w-20 px-2 py-1 text-sm border rounded ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  }`}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={reviewCountRange.max}
                  onChange={(e) => setReviewCountRange({ ...reviewCountRange, max: e.target.value })}
                  aria-label={`${t('study.questionBank.reviewCount')} Max`}
                  className={`w-20 px-2 py-1 text-sm border rounded ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  }`}
                />
              </div>
            </div>

            {/* Next Review Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">{t('study.questionBank.nextReviewTime')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={nextReviewRange.start}
                  onChange={(e) => setNextReviewRange({ ...nextReviewRange, start: e.target.value })}
                  className={`px-2 py-1 text-sm border rounded ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  }`}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  value={nextReviewRange.end}
                  onChange={(e) => setNextReviewRange({ ...nextReviewRange, end: e.target.value })}
                  className={`px-2 py-1 text-sm border rounded ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  }`}
                />
              </div>
            </div>

            {/* FSRS State Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">{t('study.questionBank.learningStatus')}</label>
              <div className="flex flex-wrap gap-2">
                {(["New", "Learning", "Review", "Relearning"] as const).map(state => (
                  <button
                    key={state}
                    onClick={() => toggleFsrsState(state)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedFsrsStates.has(state)
                        ? 'bg-primary-100 border-primary-200 text-primary-700'
                        : isDark ? 'bg-slate-800 border-slate-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {fsrsStateLabels[state]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Area */}
      {(isCreating || editingCard) && (
        <div ref={formRef}>
          <QuestionForm 
            initialData={editingCard || undefined}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setIsCreating(false);
              setEditingCard(null);
            }}
            isSubmitting={createCardsMutation.isPending || updateCardMutation.isPending}
          />
        </div>
      )}

      {/* Card Grid */}
      <div className="p-4">
        {paginatedCards.length === 0 && !isLoading ? (
          <EmptyState
            icon={<Search size={32} className="opacity-50" />}
            title={t('study.questionBank.noQuestionsFound')}
            action={{
              label: t('study.generateQuestions'),
              onClick: startCreating,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedCards.map(card => (
              <div key={card.id} className="h-full">
                <StudyCardPreview
                  card={card}
                  isDark={isDark}
                  onPreview={setPreviewCard}
                  onEdit={startEditing}
                  onDelete={async (c) => {
                    if(await asyncConfirm({ title: t('common.confirm.deleteTitle'), message: t('study.questionBank.deleteCardConfirm'), isDangerous: true })) await deleteCardMutation.mutateAsync(c.id);
                  }}
                  onSelect={(c) => toggleSelect(c.id)}
                  selected={selectedIds.has(card.id)}
                  selectionMode={true}
                  showStatus={true}
                  deletePending={deleteCardMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infinite Scroll Footer */}
      {paginatedCards.length > 0 && (
        <div className={`p-4 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <div
            className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {t('study.questionBank.pagination', {
              start: 1,
              end: paginatedCards.length,
              total,
            })}
          </div>
          {hasNextPage && (
            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {isFetchingNextPage && (
                <span
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} aria-hidden="true" />

      {/* Card Detail Modal */}
      <StudyCardDetailModal
        card={previewCard}
        isOpen={!!previewCard}
        onClose={() => setPreviewCard(null)}
        isDark={isDark}
      />
    </div>
  );
};

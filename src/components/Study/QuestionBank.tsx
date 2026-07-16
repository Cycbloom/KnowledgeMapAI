import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StudyCard } from '../../types';
import { useUpdateCardMutation, useDeleteCardMutation, useDeleteCardsBatchMutation, useCreateCardsBatchMutation } from '../../hooks/mutations';
import { Search, Trash2, Filter, CheckSquare, Square, PlusCircle, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { useTheme } from "../../hooks";
import { asyncConfirm } from '@/utils/asyncConfirm';
import { QuestionForm, QuestionFormData } from './QuestionForm';
import { StudyCardPreview } from './StudyCardPreview';
import { StudyCardDetailModal } from './StudyCardDetailModal';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { EmptyState } from '@/components/common/EmptyState';
import { message } from '@/utils/messageHelper';

interface QuestionBankProps {
  cards: StudyCard[];
}

export const QuestionBank: React.FC<QuestionBankProps> = ({ cards }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { query: searchTerm, setQuery: setSearchTerm, debouncedQuery: debouncedSearchTerm } = useDebouncedSearch();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [reviewCountRange, setReviewCountRange] = useState<{min: string, max: string}>({ min: '', max: '' });
  const [selectedFsrsStates, setSelectedFsrsStates] = useState<Set<string>>(new Set(["New", "Learning", "Review", "Relearning"]));
  const [nextReviewRange, setNextReviewRange] = useState<{start: string, end: string}>({ start: '', end: '' });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [_viewMode, _setViewMode] = useState<'list' | 'grid'>('grid');
  const [previewCard, setPreviewCard] = useState<StudyCard | null>(null);
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const formRef = useRef<HTMLDivElement>(null);

  const deleteCardMutation = useDeleteCardMutation();
  const deleteBatchMutation = useDeleteCardsBatchMutation();
  const updateCardMutation = useUpdateCardMutation();
  const createCardsMutation = useCreateCardsBatchMutation();

  const fsrsStateLabels: Record<string, string> = {
    "New": t('study.questionBank.fsrsStates.new'),
    "Learning": t('study.questionBank.fsrsStates.learning'),
    "Review": t('study.questionBank.fsrsStates.review'),
    "Relearning": t('study.questionBank.fsrsStates.relearning')
  };

  // Filter Logic
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Basic Search
      const matchesSearch = card.question.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                            card.answer.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || card.card_type === selectedType;

      if (!matchesSearch || !matchesType) return false;

      // Advanced Filters
      if (showAdvancedFilters) {
        // Review Count
        const count = card.review_count || 0;
        if (reviewCountRange.min !== '' && count < parseInt(reviewCountRange.min)) return false;
        if (reviewCountRange.max !== '' && count > parseInt(reviewCountRange.max)) return false;

        // FSRS State
        const state = card.fsrs_state || "New";
        if (!selectedFsrsStates.has(state)) return false;

        // Next Review Date
        if (nextReviewRange.start || nextReviewRange.end) {
          const reviewDate = new Date(card.next_review).getTime();
          if (nextReviewRange.start && reviewDate < new Date(nextReviewRange.start).getTime()) return false;
          if (nextReviewRange.end) {
            const endDate = new Date(nextReviewRange.end);
            endDate.setHours(23, 59, 59, 999);
            if (reviewDate > endDate.getTime()) return false;
          }
        }
      }

      return true;
    });
  }, [cards, debouncedSearchTerm, selectedType, showAdvancedFilters, reviewCountRange, selectedFsrsStates, nextReviewRange]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredCards.length / pageSize);
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, showAdvancedFilters, reviewCountRange, selectedFsrsStates, nextReviewRange]);

  // Handlers
  const toggleFsrsState = (state: string) => {
    const newSet = new Set(selectedFsrsStates);
    if (newSet.has(state)) newSet.delete(state);
    else newSet.add(state);
    setSelectedFsrsStates(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map(c => c.id)));
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
            card_type: data.card_type as any
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
          card_type: data.card_type as any
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

  return (
    <div className={`rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} overflow-hidden`}>
      {/* Toolbar */}
      <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
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
                aria-label="清除"
                title="清除"
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
          >
            <Filter size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSelectAll}
            className={`p-2 rounded-lg border transition-colors ${
              selectedIds.size === filteredCards.length && filteredCards.length > 0
                ? 'bg-primary-100 border-primary-200 text-primary-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-gray-400' : 'bg-white border-gray-200 text-gray-400'
            }`}
            title={selectedIds.size === filteredCards.length ? t('study.questionBank.deselectAll') : t('study.questionBank.selectAll')}
          >
            {selectedIds.size === filteredCards.length && filteredCards.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}
          </button>

          {selectedIds.size > 0 && (
            <button 
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 size={18} />
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
        {filteredCards.length === 0 ? (
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
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {filteredCards.length > 0 && (
        <div className={`p-4 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {t('study.questionBank.pagination', {
              start: ((currentPage - 1) * pageSize) + 1,
              end: Math.min(currentPage * pageSize, filteredCards.length),
              total: filteredCards.length
            })}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border transition-colors ${
                currentPage === 1
                  ? (isDark ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-gray-100 text-gray-300 cursor-not-allowed')
                  : (isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')
              }`}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : (isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100')
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg border transition-colors ${
                currentPage === totalPages
                  ? (isDark ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-gray-100 text-gray-300 cursor-not-allowed')
                  : (isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')
              }`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

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

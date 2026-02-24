import React, { useState, useMemo, useRef } from 'react';
import { StudyCard } from '../../types';
import { useUpdateCardMutation, useDeleteCardMutation, useDeleteCardsBatchMutation, useCreateCardsBatchMutation } from '../../hooks/useQueries';
import { Search, Trash2, Filter, CheckSquare, Square, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { QuestionForm, QuestionFormData } from './QuestionForm';
import { StudyCardPreview } from './StudyCardPreview';
import { StudyCardDetailModal } from './StudyCardDetailModal';

interface QuestionBankProps {
  cards: StudyCard[];
}

export const QuestionBank: React.FC<QuestionBankProps> = ({ cards }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [reviewCountRange, setReviewCountRange] = useState<{min: string, max: string}>({ min: '', max: '' });
  const [selectedFsrsStates, setSelectedFsrsStates] = useState<Set<number>>(new Set([0, 1, 2, 3]));
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

  const fsrsStateLabels: Record<number, string> = {
    0: '新卡片 (New)',
    1: '学习中 (Learning)',
    2: '复习中 (Review)',
    3: '重学中 (Relearning)'
  };

  // Filter Logic
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Basic Search
      const matchesSearch = card.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            card.answer.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || card.card_type === selectedType;
      
      if (!matchesSearch || !matchesType) return false;

      // Advanced Filters
      if (showAdvancedFilters) {
        // Review Count
        const count = card.review_count || 0;
        if (reviewCountRange.min !== '' && count < parseInt(reviewCountRange.min)) return false;
        if (reviewCountRange.max !== '' && count > parseInt(reviewCountRange.max)) return false;

        // FSRS State
        const state = card.fsrs_state || 0;
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
  }, [cards, searchTerm, selectedType, showAdvancedFilters, reviewCountRange, selectedFsrsStates, nextReviewRange]);

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
  const toggleFsrsState = (state: number) => {
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
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个问题吗？`)) {
      await deleteBatchMutation.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleFormSubmit = async (data: QuestionFormData) => {
    if (editingCard) {
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
    } else {
      await createCardsMutation.mutateAsync([{
        ...data,
        card_type: data.card_type as any
      }]);
      setIsCreating(false);
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
              placeholder="搜索题目或答案..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            />
          </div>
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={`px-3 py-2 rounded-lg border ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200'
            }`}
          >
            <option value="all">所有题型</option>
            <option value="qa">问答 (QA)</option>
            <option value="choice">单选 (Choice)</option>
            <option value="true_false">判断 (True/False)</option>
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showAdvancedFilters 
                ? 'bg-indigo-100 border-indigo-200 text-indigo-600' 
                : isDark ? 'bg-slate-800 border-slate-700 text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
            title="高级筛选"
          >
            <Filter size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSelectAll}
            className={`p-2 rounded-lg border transition-colors ${
              selectedIds.size === filteredCards.length && filteredCards.length > 0
                ? 'bg-indigo-100 border-indigo-200 text-indigo-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-gray-400' : 'bg-white border-gray-200 text-gray-400'
            }`}
            title={selectedIds.size === filteredCards.length ? "取消全选" : "全选当前页"}
          >
            {selectedIds.size === filteredCards.length && filteredCards.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}
          </button>

          {selectedIds.size > 0 && (
            <button 
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 size={18} />
              <span>批量删除 ({selectedIds.size})</span>
            </button>
          )}
          
          <button
            onClick={startCreating}
            className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle size={18} />
            <span>新建题目</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className={`p-4 border-b space-y-4 ${isDark ? 'bg-slate-800/30' : 'bg-gray-50/50'}`}>
          <div className="flex flex-wrap gap-6">
            {/* Review Count Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">复习次数</label>
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
              <label className="text-sm font-medium text-gray-500">下次复习时间</label>
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
              <label className="text-sm font-medium text-gray-500">学习状态</label>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map(state => (
                  <button
                    key={state}
                    onClick={() => toggleFsrsState(state)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedFsrsStates.has(state)
                        ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
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
          <div className="p-16 text-center flex flex-col items-center justify-center gap-4 text-gray-500">
             <div className={`p-4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                <Search size={32} className="opacity-50" />
             </div>
             <p>没有找到符合条件的题目</p>
          </div>
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
                    if(confirm('删除此卡片?')) await deleteCardMutation.mutateAsync(c.id);
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
            显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredCards.length)} 条，共 {filteredCards.length} 条
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
                        ? 'bg-indigo-600 text-white'
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

import React, { useState, useMemo } from 'react';
import { StudyCard } from '../../types';
import { useUpdateCardMutation, useDeleteCardMutation, useDeleteCardsBatchMutation, useCreateCardsBatchMutation } from '../../hooks/useQueries';
import { Search, Trash2, Edit, Plus, Filter, CheckSquare, Square, X, Save, AlertTriangle, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface QuestionBankProps {
  cards: StudyCard[];
}

export const QuestionBank: React.FC<QuestionBankProps> = ({ cards }) => {
  const { isDark } = useTheme();
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
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCard, setNewCard] = useState<{
    question: string;
    answer: string;
    card_type: string;
    explanation: string;
    options: string[];
  }>({
    question: '',
    answer: '',
    card_type: 'qa',
    explanation: '',
    options: []
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
          // End date should be inclusive (end of day), so we add 1 day or set time to 23:59:59
          // Or just simple comparison:
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


  // Handlers
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

  const handleSaveEdit = async () => {
    if (!editingCard) return;
    await updateCardMutation.mutateAsync({ 
        id: editingCard.id, 
        data: { 
            question: editingCard.question, 
            answer: editingCard.answer,
            explanation: editingCard.explanation 
        } 
    });
    setEditingCard(null);
  };

  // Option Handlers
  const addOption = () => {
    setNewCard(prev => ({ ...prev, options: [...prev.options, ''] }));
  };
  
  const updateOption = (index: number, value: string) => {
    const newOptions = [...newCard.options];
    newOptions[index] = value;
    setNewCard(prev => ({ ...prev, options: newOptions }));
  };
  
  const removeOption = (index: number) => {
    setNewCard(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const handleCreate = async () => {
    // Validation
    const newErrors: Record<string, string> = {};
    if (!newCard.question.trim()) newErrors.question = '请输入问题';
    else if (newCard.question.length > 500) newErrors.question = '问题不能超过500字';
    
    if (!newCard.answer.trim()) newErrors.answer = '请输入答案';
    
    if ((newCard.card_type === 'choice' || newCard.card_type === 'multi_choice') && newCard.options.length < 2) {
        newErrors.options = '选择题至少需要2个选项';
    } else if ((newCard.card_type === 'choice' || newCard.card_type === 'multi_choice') && newCard.options.some(o => !o.trim())) {
        newErrors.options = '选项内容不能为空';
    }
    
    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }

    await createCardsMutation.mutateAsync([newCard]);
    setIsCreating(false);
    setNewCard({ question: '', answer: '', card_type: 'qa', explanation: '', options: [] });
    setErrors({});
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
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 size={18} />
              <span>批量删除</span>
            </button>
          )}
          
          <button
            onClick={() => setIsCreating(true)}
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

      {/* Create Form */}
      {isCreating && (
        <div className={`p-4 border-b ${isDark ? 'bg-slate-800/50' : 'bg-indigo-50/50'}`}>
          <div className="space-y-4 max-w-2xl">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  问题 <span className="text-red-500">*</span>
                  <span className={`ml-2 text-xs font-normal ${newCard.question.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                    {newCard.question.length}/500
                  </span>
                </label>
                <textarea
                  value={newCard.question}
                  onChange={e => setNewCard({...newCard, question: e.target.value})}
                  className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${errors.question ? 'border-red-500' : ''}`}
                  rows={2}
                  placeholder="输入问题内容..."
                />
                {errors.question && <p className="text-red-500 text-xs mt-1">{errors.question}</p>}
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium mb-1">类型</label>
                <select
                  value={newCard.card_type}
                  onChange={e => {
                      const type = e.target.value;
                      setNewCard({
                          ...newCard, 
                          card_type: type, 
                          options: (type === 'choice' || type === 'multi_choice') ? ['', '', '', ''] : [],
                          answer: ''
                      });
                  }}
                  className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
                >
                  <option value="qa">问答</option>
                  <option value="choice">单选</option>
                  <option value="multi_choice">多选</option>
                  <option value="true_false">判断</option>
                  <option value="fill_in_the_blank">填空</option>
                  <option value="essay">论述</option>
                </select>
              </div>
            </div>
            
            {/* Options for Choice/Multi-Choice */}
            {(newCard.card_type === 'choice' || newCard.card_type === 'multi_choice') && (
                <div>
                    <label className="block text-sm font-medium mb-1">
                        选项 & 正确答案 <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                        {newCard.options.map((option, idx) => {
                            const isChecked = newCard.card_type === 'choice' 
                                ? newCard.answer === option
                                : (() => {
                                    try {
                                        const ans = JSON.parse(newCard.answer || '[]');
                                        return Array.isArray(ans) && ans.includes(option);
                                    } catch { return false; }
                                })();

                            return (
                            <div key={idx} className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (!option.trim()) return;
                                        if (newCard.card_type === 'choice') {
                                            setNewCard({...newCard, answer: option});
                                        } else {
                                            // Multi-choice logic
                                            let currentAnswers: string[] = [];
                                            try { currentAnswers = JSON.parse(newCard.answer || '[]'); } catch(e) {}
                                            if (!Array.isArray(currentAnswers)) currentAnswers = [];
                                            
                                            if (currentAnswers.includes(option)) {
                                                currentAnswers = currentAnswers.filter(a => a !== option);
                                            } else {
                                                currentAnswers.push(option);
                                            }
                                            setNewCard({...newCard, answer: JSON.stringify(currentAnswers)});
                                        }
                                    }}
                                    className={`w-6 h-6 flex items-center justify-center rounded-full border transition-colors ${
                                        isChecked
                                        ? 'bg-green-500 border-green-500 text-white' 
                                        : 'border-gray-300 hover:border-green-400'
                                    }`}
                                    title="设为正确答案"
                                >
                                    {isChecked && <CheckSquare size={14} />}
                                </button>
                                <span className="font-mono text-gray-400 w-6">{String.fromCharCode(65 + idx)}.</span>
                                <input
                                    type="text"
                                    value={option}
                                    onChange={e => updateOption(idx, e.target.value)}
                                    className={`flex-1 p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
                                    placeholder={`选项 ${idx + 1}`}
                                />
                                <button onClick={() => removeOption(idx)} className="text-gray-400 hover:text-red-500">
                                    <X size={18} />
                                </button>
                            </div>
                            );
                        })}
                        <button 
                            onClick={addOption}
                            className="text-sm text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                        >
                            <Plus size={16} /> 添加选项
                        </button>
                    </div>
                    {errors.options && <p className="text-red-500 text-xs mt-1">{errors.options}</p>}
                </div>
            )}

            {/* Answer Input */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {(newCard.card_type === 'choice' || newCard.card_type === 'multi_choice') ? '答案预览 (自动生成)' : '答案'} <span className="text-red-500">*</span>
              </label>
              
              {newCard.card_type === 'true_false' ? (
                  <div className="flex gap-4">
                      {['True', 'False'].map(val => (
                          <label key={val} className="flex items-center gap-2 cursor-pointer">
                              <input 
                                  type="radio" 
                                  name="tf_answer" 
                                  value={val}
                                  checked={newCard.answer === val}
                                  onChange={e => setNewCard({...newCard, answer: e.target.value})}
                                  className="w-4 h-4 text-indigo-600"
                              />
                              <span>{val === 'True' ? '正确 (True)' : '错误 (False)'}</span>
                          </label>
                      ))}
                  </div>
              ) : (newCard.card_type === 'choice' || newCard.card_type === 'multi_choice') ? (
                  <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
                      {newCard.answer || '请点击上方选项左侧圆圈选择正确答案'}
                  </div>
              ) : (
                  <textarea
                    value={newCard.answer}
                    onChange={e => setNewCard({...newCard, answer: e.target.value})}
                    className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${errors.answer ? 'border-red-500' : ''}`}
                    rows={2}
                    placeholder="输入标准答案..."
                  />
              )}
              {errors.answer && <p className="text-red-500 text-xs mt-1">{errors.answer}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">解析 (可选)</label>
              <textarea
                value={newCard.explanation}
                onChange={e => setNewCard({...newCard, explanation: e.target.value})}
                className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
                rows={1}
                placeholder="输入解析..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => {
                    setIsCreating(false);
                    setErrors({});
                }}
                className="px-3 py-1.5 text-gray-500 hover:text-gray-700"
              >
                取消
              </button>
              <button 
                onClick={handleCreate}
                disabled={!newCard.question || !newCard.answer}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`text-sm ${isDark ? 'bg-slate-800/50 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
              <th className="p-4 w-12">
                <button onClick={handleSelectAll} className="flex items-center">
                  {selectedIds.size === filteredCards.length && filteredCards.length > 0 ? (
                    <CheckSquare size={20} className="text-indigo-500" />
                  ) : (
                    <Square size={20} className="text-gray-400" />
                  )}
                </button>
              </th>
              <th className="p-4 w-24">类型</th>
              <th className="p-4">题目内容</th>
              <th className="p-4 w-32">熟练度</th>
              <th className="p-4 w-24">操作</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-gray-100'}`}>
            {paginatedCards.map(card => (
              <tr key={card.id} className={`group ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'}`}>
                <td className="p-4">
                  <button onClick={() => toggleSelect(card.id)}>
                    {selectedIds.has(card.id) ? (
                      <CheckSquare size={20} className="text-indigo-500" />
                    ) : (
                      <Square size={20} className="text-gray-400 group-hover:text-gray-500" />
                    )}
                  </button>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    card.card_type === 'qa' ? 'bg-blue-100 text-blue-700' :
                    card.card_type === 'choice' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {card.card_type}
                  </span>
                </td>
                <td className="p-4 max-w-xl">
                  {editingCard?.id === card.id ? (
                    <div className="space-y-2">
                      <textarea 
                        className="w-full p-2 border rounded bg-transparent"
                        value={editingCard.question}
                        onChange={e => setEditingCard({...editingCard, question: e.target.value})}
                      />
                      <textarea 
                        className="w-full p-2 border rounded bg-transparent text-sm text-gray-500"
                        value={editingCard.answer}
                        onChange={e => setEditingCard({...editingCard, answer: e.target.value})}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingCard(null)} className="p-1 hover:bg-gray-200 rounded"><X size={16}/></button>
                        <button onClick={handleSaveEdit} className="p-1 hover:bg-green-200 text-green-600 rounded"><Save size={16}/></button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium line-clamp-2">{card.question}</div>
                      <div className="text-sm text-gray-500 line-clamp-1 mt-1">{card.answer}</div>
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          (card.fsrs_state || 0) > 2 ? 'bg-green-500' : 
                          (card.fsrs_state || 0) > 0 ? 'bg-yellow-500' : 'bg-gray-400'
                        }`} 
                        style={{ width: `${Math.min(((card.review_count || 0) / 5) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{card.review_count || 0}次</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingCard(card)}
                      className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded"
                      title="编辑"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        if(confirm('删除此卡片?')) await deleteCardMutation.mutateAsync(card.id);
                      }}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCards.length === 0 && (
            <div className="p-8 text-center text-gray-500">
                没有找到符合条件的题目
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
                // Logic to show a sliding window of pages if many pages exist
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
    </div>
  );
};

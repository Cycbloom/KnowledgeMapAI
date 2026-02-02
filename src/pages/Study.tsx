import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStudyCards, useUpdateCardProgressMutation } from '../hooks/useQueries';
import { StudyCard } from '../types';
import { Check, X, RefreshCw, BookOpen, Trophy, Clock, Brain, Trash2, Search, ArrowLeft, Play, LayoutGrid, GraduationCap } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';
import { useTheme } from '../hooks/useTheme';

export const Study = () => {
  const { isDark } = useTheme();
  const { addMessage } = useMessageStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const graphId = searchParams.get('graph_id');
  const nodeId = searchParams.get('node_id');
  const nodeIds = searchParams.get('node_ids');

  const scopeParams = useMemo(() => {
    if (nodeIds) return { node_ids: nodeIds };
    if (nodeId) return { node_id: nodeId };
    if (graphId) return { graph_id: graphId };
    return undefined;
  }, [graphId, nodeId, nodeIds]);
  
  const { data: allCardsData, isLoading } = useStudyCards(scopeParams);
  const { data: dueCardsData } = useStudyCards(
    scopeParams ? { ...scopeParams, due: true } : { due: true }
  );
  const updateProgressMutation = useUpdateCardProgressMutation();

  const allCards = useMemo(() => (Array.isArray(allCardsData) ? (allCardsData as StudyCard[]) : []), [allCardsData]);
  const dueCards = useMemo(() => (Array.isArray(dueCardsData) ? (dueCardsData as StudyCard[]) : []), [dueCardsData]);

  const [quizCards, setQuizCards] = useState<StudyCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // View State: 'dashboard' | 'quiz'
  const [viewState, setViewState] = useState<'dashboard' | 'quiz'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableMode, setTableMode] = useState<'due' | 'all'>('due');

  // Reset state when params change
  useEffect(() => {
    setQuizCards([]);
    setCurrentCardIndex(0);
    setFinished(false);
    setShowAnswer(false);
    setSelectedOption(null);
    setViewState('dashboard');
    setTableMode('due');
  }, [graphId, nodeId, nodeIds]);

  // Stats
  const stats = useMemo(() => {
    const total = allCards.length;
    const mastered = allCards.filter(c => (c.review_count || 0) > 0).length;
    const due = dueCards.length;
    return { total, mastered, due };
  }, [allCards, dueCards]);

  const tableCards = useMemo(() => (tableMode === 'due' ? dueCards : allCards), [tableMode, dueCards, allCards]);

  // Filtered Cards for Table
  const filteredCards = useMemo(() => {
    if (!searchQuery) return tableCards;
    return tableCards.filter(c => 
      c.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tableCards, searchQuery]);

  const handleStartQuiz = (mode: 'all' | 'due') => {
    const selected = mode === 'due' ? dueCards : allCards;
    const next = [...selected];
    
    if (next.length === 0) {
      addMessage({ content: '没有需要复习的卡片！', type: 'info' });
      return;
    }

    // Shuffle
    next.sort(() => Math.random() - 0.5);
    setQuizCards(next);
    setCurrentCardIndex(0);
    setFinished(false);
    setViewState('quiz');
  };

  const handleNextCard = () => {
    if (currentCardIndex < quizCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
      setSelectedOption(null);
    } else {
      setFinished(true);
    }
  };

  const handleRate = async (quality: number) => {
    if (!quizCards[currentCardIndex]) return;
    
    try {
      await updateProgressMutation.mutateAsync({
        id: quizCards[currentCardIndex].id,
        quality
      });
      handleNextCard();
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '保存进度失败' });
    }
  };

  const handleOptionClick = (option: string) => {
    if (showAnswer) return;
    setSelectedOption(option);
    setShowAnswer(true);
  };

  const handleRestart = () => {
    setFinished(false);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    
    // Reshuffle current set
    setQuizCards(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleBackToDashboard = () => {
    setQuizCards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setFinished(false);
    setViewState('dashboard');
  };

  if (isLoading) return <div className={`min-h-full flex items-center justify-center p-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>正在加载学习资源...</div>;

  // --- Dashboard View ---
  if (viewState === 'dashboard') {
    return (
      <div className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'} p-8`}>
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => window.history.back()}
                className={`p-2 rounded-lg border transition-colors ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold">学习中心</h1>
                <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {nodeId ? '单点突破' : nodeIds ? '路径特训' : '全图复习'}
                </p>
              </div>
            </div>
            {graphId && (
              <button 
                onClick={() => navigate(`/graph/${graphId}`)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                  isDark 
                    ? 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60' 
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <LayoutGrid size={18} />
                <span>进入闯关图谱</span>
              </button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-6 rounded-2xl shadow-sm border flex items-center space-x-4 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
            }`}>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <LayoutGrid size={24} />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>总卡片数</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
            
            <div className={`p-6 rounded-2xl shadow-sm border flex items-center space-x-4 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
            }`}>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-600'}`}>
                <Trophy size={24} />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>已掌握</p>
                <p className="text-3xl font-bold">{stats.mastered}</p>
              </div>
            </div>

            <div className={`p-6 rounded-2xl shadow-sm border flex items-center space-x-4 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
            }`}>
              <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                <Clock size={24} />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>待复习</p>
                <p className="text-3xl font-bold">{stats.due}</p>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => handleStartQuiz('due')}
              disabled={dueCards.length === 0}
              className={`flex flex-col items-center text-center p-8 rounded-3xl border-2 transition-all group ${
                dueCards.length > 0 
                  ? (isDark ? 'bg-blue-900/20 border-blue-800/50 hover:border-blue-500' : 'bg-blue-50 border-blue-100 hover:border-blue-400')
                  : (isDark ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed')
              }`}
            >
              <div className={`p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform ${
                isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-600'
              }`}>
                <Brain size={40} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>今日待复习</h3>
              <p className={`mb-6 ${isDark ? 'text-blue-400/80' : 'text-blue-700'}`}>根据艾宾浩斯记忆曲线为您推荐的复习内容</p>
              <div className={`px-6 py-2 rounded-full font-bold ${
                dueCards.length > 0 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-500'
              }`}>
                {dueCards.length > 0 ? `立即开始 (${dueCards.length})` : '暂无任务'}
              </div>
            </button>

            <button
              onClick={() => handleStartQuiz('all')}
              disabled={allCards.length === 0}
              className={`flex flex-col items-center text-center p-8 rounded-3xl border-2 transition-all group ${
                allCards.length > 0 
                  ? (isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-white border-gray-100 hover:border-blue-400 shadow-sm')
                  : (isDark ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed')
              }`}
            >
              <div className={`p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
              }`}>
                <Play size={40} />
              </div>
              <h3 className="text-xl font-bold mb-2">自由练习</h3>
              <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>随机练习当前范围内的所有卡片，巩固记忆</p>
              <div className={`px-6 py-2 rounded-full font-bold ${
                allCards.length > 0 
                  ? (isDark ? 'bg-slate-700 text-white border border-slate-600' : 'bg-white text-gray-700 border border-gray-200')
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {allCards.length > 0 ? `开始自测 (${allCards.length})` : '暂无卡片'}
              </div>
            </button>
          </div>

          {/* Cards List Table */}
          <div className={`rounded-3xl shadow-sm border overflow-hidden ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
          }`}>
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className={`flex p-1 rounded-xl w-fit ${isDark ? 'bg-slate-900' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setTableMode('due')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tableMode === 'due' 
                      ? (isDark ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-blue-600 shadow-sm') 
                      : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
                  }`}
                >
                  待复习
                </button>
                <button
                  onClick={() => setTableMode('all')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    tableMode === 'all' 
                      ? (isDark ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-blue-600 shadow-sm') 
                      : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
                  }`}
                >
                  全部
                </button>
              </div>
              
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={18} />
                <input
                  type="text"
                  placeholder="搜索题目或答案..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 pr-4 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full md:w-64 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`text-left border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'bg-gray-50 border-gray-100'}`}>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">题目</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">下次复习</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
                  {filteredCards.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`px-6 py-12 text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                        没有找到匹配的卡片
                      </td>
                    </tr>
                  ) : (
                    filteredCards.map((card) => (
                      <tr key={card.id} className={`transition-colors ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4">
                          <p className="font-medium line-clamp-1">{card.question}</p>
                          <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{card.answer}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2 text-sm">
                            <Clock size={14} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
                            <span>{card.next_review ? new Date(card.next_review).toLocaleDateString() : '尚未开始'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (card.review_count || 0) > 0 
                              ? (isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700')
                              : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-600')
                          }`}>
                            {(card.review_count || 0) > 0 ? '已学习' : '新内容'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => {
                              setQuizCards([card]);
                              setCurrentCardIndex(0);
                              setFinished(false);
                              setViewState('quiz');
                            }}
                            className="text-blue-500 hover:text-blue-600 font-medium text-sm"
                          >
                            单独练习
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Quiz View ---
  if (finished) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-10 text-center animate-fade-in-up">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-2 text-gray-900">
            {nodeId ? '关卡挑战成功!' : '本次学习完成!'}
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            {nodeId 
              ? `你已经完成了该知识点的所有测验卡片。` 
              : `你已经复习了本次所有的 ${quizCards.length} 张卡片。`}
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleBackToDashboard}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center"
            >
              返回学习中心
            </button>
            <button
              onClick={handleRestart}
              className="w-full bg-gray-50 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center"
            >
              <RefreshCw className="mr-2" size={18} />
              再练一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = quizCards[currentCardIndex];
  // Guard against index out of bounds if cards changed
  if (!currentCard) return null; 

  const isQA = !currentCard.card_type || currentCard.card_type === 'qa';
  const isChoice = currentCard.card_type === 'choice';
  const isMultiChoice = currentCard.card_type === 'multi_choice';
  const isTrueFalse = currentCard.card_type === 'true_false';
  const isFillBlank = currentCard.card_type === 'fill_in_the_blank';
  const isEssay = currentCard.card_type === 'essay';

  // For multi-choice state
  const handleMultiOptionClick = (option: string) => {
    if (showAnswer) return;
    const currentSelected = selectedOption ? JSON.parse(selectedOption) : [];
    const newSelected = currentSelected.includes(option)
      ? currentSelected.filter((o: string) => o !== option)
      : [...currentSelected, option];
    setSelectedOption(JSON.stringify(newSelected));
  };

  const checkMultiChoiceCorrect = () => {
    if (!selectedOption) return false;
    try {
      const selected = JSON.parse(selectedOption) as string[];
      const correct = JSON.parse(currentCard.answer) as string[];
      return selected.length === correct.length && selected.every(s => correct.includes(s));
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 bg-gray-100">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={handleBackToDashboard}
            className="flex items-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={20} className="mr-1" />
            退出
          </button>
          <h2 className="text-xl font-bold text-gray-800">学习模式</h2>
          <span className="text-gray-500 font-medium">
            进度 {currentCardIndex + 1} / {quizCards.length}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 min-h-[400px] flex flex-col cursor-default transition-all hover:shadow-xl relative overflow-hidden">
          {/* Card Type Badge */}
          <div className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-500 uppercase">
            {isQA ? '问答题' : isChoice ? '单选题' : isMultiChoice ? '多选题' : isTrueFalse ? '判断题' : isFillBlank ? '填空题' : '解答题'}
          </div>

          {/* Question Section */}
          <div className="flex-1 flex flex-col items-center justify-center text-center mb-8">
            <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold mb-4">
              问题
            </h3>
            <p className="text-2xl font-medium text-gray-900 leading-relaxed">
              {currentCard.question}
            </p>
          </div>

          {/* Answer Section */}
          <div className="w-full">
            {(isQA || isEssay || isFillBlank) && (
              <div 
                className="text-center transition-all duration-300"
                onClick={() => !showAnswer && setShowAnswer(true)}
              >
                {showAnswer ? (
                  <div className="border-t pt-6 animate-fade-in">
                    <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold mb-2">
                      {isFillBlank ? '填空内容' : '标准答案'}
                    </h3>
                    <p className={`text-xl text-gray-800 ${isEssay ? 'text-left' : ''}`}>{currentCard.answer}</p>
                  </div>
                ) : (
                  <div className="py-8 cursor-pointer hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">点击查看答案</p>
                  </div>
                )}
              </div>
            )}

            {isChoice && currentCard.options && (
              <div className="grid grid-cols-1 gap-3">
                {currentCard.options.map((option, idx) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentCard.answer;
                  
                  let btnClass = "p-4 rounded-lg border-2 text-left transition-all relative ";
                  if (showAnswer) {
                    if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-700";
                    else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                    else btnClass += "bg-gray-50 border-gray-200 text-gray-400";
                  } else {
                    btnClass += "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(option)}
                      disabled={showAnswer}
                      className={btnClass}
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                      {option}
                      {showAnswer && isCorrect && <Check className="absolute right-4 top-4 text-green-600" size={20} />}
                      {showAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-4 text-red-600" size={20} />}
                    </button>
                  );
                })}
              </div>
            )}

            {isMultiChoice && currentCard.options && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {currentCard.options.map((option, idx) => {
                    const selectedList = selectedOption ? JSON.parse(selectedOption) : [];
                    const isSelected = selectedList.includes(option);
                    let correctList = [];
                    try { correctList = JSON.parse(currentCard.answer); } catch(e) {}
                    const isCorrect = correctList.includes(option);
                    
                    let btnClass = "p-4 rounded-lg border-2 text-left transition-all relative ";
                    if (showAnswer) {
                      if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-700";
                      else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                      else btnClass += "bg-gray-50 border-gray-200 text-gray-400";
                    } else {
                      btnClass += isSelected 
                        ? "bg-blue-50 border-blue-500 text-blue-700" 
                        : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleMultiOptionClick(option)}
                        disabled={showAnswer}
                        className={btnClass}
                      >
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                        {option}
                        {showAnswer && isCorrect && <Check className="absolute right-4 top-4 text-green-600" size={20} />}
                        {showAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-4 text-red-600" size={20} />}
                      </button>
                    );
                  })}
                </div>
                {!showAnswer && (
                  <button
                    onClick={() => setShowAnswer(true)}
                    disabled={!selectedOption || JSON.parse(selectedOption).length === 0}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    提交答案
                  </button>
                )}
              </div>
            )}

            {isTrueFalse && (
              <div className="flex space-x-4 justify-center">
                {['True', 'False'].map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentCard.answer;
                  
                  let btnClass = "flex-1 py-4 rounded-lg border-2 text-center font-bold text-lg transition-all relative ";
                  if (showAnswer) {
                     if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-700";
                     else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                     else btnClass += "bg-gray-50 border-gray-200 text-gray-400";
                  } else {
                    btnClass += "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer";
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => handleOptionClick(option)}
                      disabled={showAnswer}
                      className={btnClass}
                    >
                      {option === 'True' ? '正确 / True' : '错误 / False'}
                      {showAnswer && isCorrect && <Check className="absolute right-4 top-4 text-green-600" size={20} />}
                      {showAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-4 text-red-600" size={20} />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Explanation Section */}
            {showAnswer && currentCard.explanation && (
               <div className="mt-8 pt-6 border-t border-gray-100 text-left animate-fade-in">
                  <div className="flex items-center gap-2 mb-2 text-indigo-600">
                    <Brain size={18} />
                    <h4 className="font-bold">题目解析</h4>
                  </div>
                  <div className="bg-indigo-50/50 p-4 rounded-xl text-gray-700 text-sm leading-relaxed">
                    {currentCard.explanation}
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* Rating Buttons - Show only after answer is revealed */}
        {showAnswer && (
          <div className="mt-8 grid grid-cols-4 gap-4 animate-fade-in-up">
            <button
              onClick={() => handleRate(1)}
              className="bg-red-100 text-red-700 py-3 rounded-lg font-medium hover:bg-red-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              重来 (Again)
            </button>
            <button
              onClick={() => handleRate(2)}
              className="bg-orange-100 text-orange-700 py-3 rounded-lg font-medium hover:bg-orange-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              困难 (Hard)
            </button>
            <button
              onClick={() => handleRate(3)}
              className="bg-blue-100 text-blue-700 py-3 rounded-lg font-medium hover:bg-blue-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              良好 (Good)
            </button>
            <button
              onClick={() => handleRate(4)}
              className="bg-green-100 text-green-700 py-3 rounded-lg font-medium hover:bg-green-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              简单 (Easy)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function ListIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}

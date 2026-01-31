import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStudyCards, useUpdateCardProgressMutation } from '../hooks/useQueries';
import { StudyCard } from '../types';
import { Check, X, RefreshCw, BookOpen, Trophy, Clock, Brain, Trash2, Search, ArrowLeft, Play, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';

export const Study = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const graphId = searchParams.get('graph_id');
  const nodeId = searchParams.get('node_id');
  const nodeIds = searchParams.get('node_ids');
  
  const { data: fetchedCards, isLoading, refetch } = useStudyCards(
    nodeIds ? { node_ids: nodeIds } : (nodeId ? { node_id: nodeId } : (graphId ? { graph_id: graphId } : undefined))
  );
  const updateProgressMutation = useUpdateCardProgressMutation();

  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // View State: 'dashboard' | 'quiz'
  const [viewState, setViewState] = useState<'dashboard' | 'quiz'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset state when params change
  useEffect(() => {
    setCards([]);
    setCurrentCardIndex(0);
    setFinished(false);
    setShowAnswer(false);
    setSelectedOption(null);
    setViewState('dashboard');
  }, [graphId, nodeId, nodeIds]);

  // Sync cards
  useEffect(() => {
    if (Array.isArray(fetchedCards)) {
      setCards(fetchedCards);
    }
  }, [fetchedCards]);

  // Stats
  const stats = useMemo(() => {
    const total = cards.length;
    const mastered = cards.filter(c => (c.review_count || 0) > 0).length;
    const due = cards.filter(c => new Date(c.next_review) <= new Date()).length;
    return { total, mastered, due };
  }, [cards]);

  // Filtered Cards for Table
  const filteredCards = useMemo(() => {
    if (!searchQuery) return cards;
    return cards.filter(c => 
      c.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [cards, searchQuery]);

  const handleStartQuiz = (mode: 'all' | 'due') => {
    let quizCards = [...cards];
    if (mode === 'due') {
      quizCards = quizCards.filter(c => new Date(c.next_review) <= new Date());
    }
    
    if (quizCards.length === 0) {
      toast.success('没有需要复习的卡片！');
      return;
    }

    // Shuffle
    quizCards.sort(() => Math.random() - 0.5);
    setCards(quizCards);
    setCurrentCardIndex(0);
    setFinished(false);
    setViewState('quiz');
  };

  const handleNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
      setSelectedOption(null);
    } else {
      setFinished(true);
    }
  };

  const handleRate = async (quality: number) => {
    if (!cards[currentCardIndex]) return;
    
    try {
      await updateProgressMutation.mutateAsync({
        id: cards[currentCardIndex].id,
        quality
      });
      handleNextCard();
    } catch (err) {
      console.error(err);
      toast.error('保存进度失败');
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
    setCards(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleBackToDashboard = () => {
    // Reload original cards
    if (Array.isArray(fetchedCards)) {
      setCards(fetchedCards);
    }
    setViewState('dashboard');
  };

  if (isLoading) return <div className="min-h-full flex items-center justify-center p-8 text-gray-500">正在加载学习资源...</div>;

  // --- Dashboard View ---
  if (viewState === 'dashboard') {
    return (
      <div className="min-h-full bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => window.history.back()}
                className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">学习中心</h1>
                <p className="text-gray-500">
                  {nodeId ? '单点突破' : nodeIds ? '路径特训' : '全图复习'}
                </p>
              </div>
            </div>
            {graphId && (
              <button 
                onClick={() => navigate(`/editor/${graphId}`)}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
              >
                <LayoutGrid size={18} />
                <span>进入闯关图谱</span>
              </button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
                <LayoutGrid size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">总卡片数</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-4 bg-green-50 text-green-600 rounded-xl">
                <Trophy size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">已掌握</p>
                <p className="text-3xl font-bold text-gray-900">{stats.mastered}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">待复习</p>
                <p className="text-3xl font-bold text-gray-900">{stats.due}</p>
              </div>
            </div>
          </div>

          {/* Action Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => handleStartQuiz('due')}
              disabled={stats.due === 0}
              className={`p-8 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                stats.due > 0 
                  ? 'bg-white border-indigo-100 hover:border-indigo-500 hover:shadow-md cursor-pointer group' 
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className={`p-4 rounded-full mb-4 transition-colors ${stats.due > 0 ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-gray-200 text-gray-400'}`}>
                <Brain size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">智能复习</h3>
              <p className="text-gray-500">
                复习 {stats.due} 张待复习卡片
              </p>
            </button>

            <button
              onClick={() => handleStartQuiz('all')}
              disabled={stats.total === 0}
              className={`p-8 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                stats.total > 0
                  ? 'bg-white border-indigo-100 hover:border-indigo-500 hover:shadow-md cursor-pointer group'
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className={`p-4 rounded-full mb-4 transition-colors ${stats.total > 0 ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-gray-200 text-gray-400'}`}>
                <BookOpen size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">突击特训</h3>
              <p className="text-gray-500">
                无视遗忘曲线，复习所有 {stats.total} 张卡片
              </p>
            </button>
          </div>

          {/* Question Bank Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <ListIcon className="mr-2" size={20} />
                题目列表
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="搜索题目..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                />
              </div>
            </div>
            
            {filteredCards.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                没有找到题目。请先生成卡片。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">题目</th>
                      <th className="px-6 py-4">类型</th>
                      <th className="px-6 py-4">掌握程度</th>
                      <th className="px-6 py-4">下次复习</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCards.map(card => (
                      <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 max-w-md">
                          <p className="font-medium text-gray-900 truncate" title={card.question}>{card.question}</p>
                          <p className="text-xs text-gray-400 truncate mt-1" title={card.answer}>{card.answer}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {card.card_type === 'choice' ? '选择题' : card.card_type === 'true_false' ? '判断题' : '问答题'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {(card.review_count || 0) > 0 ? (
                            <span className="text-green-600 text-xs font-bold flex items-center">
                              <Check size={12} className="mr-1" /> 已学习 ({card.review_count}次)
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">未学习</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(card.next_review).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              : `你已经复习了本次所有的 ${cards.length} 张卡片。`}
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

  const currentCard = cards[currentCardIndex];
  // Guard against index out of bounds if cards changed
  if (!currentCard) return null; 

  const isQA = !currentCard.card_type || currentCard.card_type === 'qa';
  const isChoice = currentCard.card_type === 'choice';
  const isTrueFalse = currentCard.card_type === 'true_false';

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
            进度 {currentCardIndex + 1} / {cards.length}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 min-h-[400px] flex flex-col cursor-default transition-all hover:shadow-xl relative overflow-hidden">
          {/* Card Type Badge */}
          <div className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-500 uppercase">
            {isQA ? '问答题' : isChoice ? '选择题' : '判断题'}
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
            {isQA && (
              <div 
                className={`text-center transition-all duration-300 ${showAnswer ? 'opacity-100' : 'opacity-100'}`}
                onClick={() => !showAnswer && setShowAnswer(true)}
              >
                {showAnswer ? (
                  <div className="border-t pt-6 animate-fade-in">
                    <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold mb-2">答案</h3>
                    <p className="text-xl text-gray-800">{currentCard.answer}</p>
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

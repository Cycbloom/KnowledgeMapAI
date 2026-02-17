import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStudyCards, useUpdateCardProgressMutation } from '../hooks/useQueries';
import { StudyCard } from '../types';
import { QuestionBank } from '../components/Study/QuestionBank';
import { StudyCardPreview } from '../components/Study/StudyCardPreview';
import { StudyCardDetailModal } from '../components/Study/StudyCardDetailModal';
import { FocusStats } from '../components/Study/FocusStats';
import { StatsOverview } from '../components/StatsOverview';
import { Check, X, RefreshCw, BookOpen, Trophy, Clock, Brain, Search, ArrowLeft, Play, LayoutGrid, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Activity, Flame, TrendingUp, AlertTriangle } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';
import { useTheme } from '../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';

interface WeakPoint {
  nodeId: string;
  nodeTitle: string;
  graphTitle: string;
  mastery: number;
  reviewCount: number;
  nextReview: string | null;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
}

interface Prediction {
  date: string;
  reviewCount: number;
  newCards: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

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
  
  // View State: 'dashboard' | 'quiz' | 'bank' | 'focus'
  const [viewState, setViewState] = useState<'dashboard' | 'quiz' | 'bank' | 'focus'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableMode, setTableMode] = useState<'due' | 'all'>('due');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [previewCard, setPreviewCard] = useState<StudyCard | null>(null);

  // Health data
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [weeklyStudyTime, setWeeklyStudyTime] = useState(0);

  // Swipe state - use regular state for better control
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);
  const [cardKey, setCardKey] = useState(0); // Force re-mount card on change
  const [cardRotation, setCardRotation] = useState(0); // 卡片旋转角度

  // Reset state when params change
  useEffect(() => {
    setQuizCards([]);
    setCurrentCardIndex(0);
    setFinished(false);
    setShowAnswer(false);
    setSelectedOption(null);
    setViewState('dashboard');
    setTableMode('due');
    setCurrentPage(1);
  }, [graphId, nodeId, nodeIds]);

  // Reset page when mode or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [tableMode, searchQuery]);

  // Fetch health data
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const [overviewRes, weakRes, predRes] = await Promise.all([
          api.health.getOverview(),
          api.health.getWeakPoints(),
          api.health.getPredictions()
        ]);
        
        setStreakDays(overviewRes?.streakDays || 0);
        setWeeklyStudyTime(overviewRes?.weeklyStudyTime || 0);
        setWeakPoints(weakRes?.weakPoints || []);
        setPredictions(predRes?.predictions || []);
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      }
    };
    
    fetchHealthData();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = allCards.length;
    const mastered = allCards.filter(c => (c.review_count || 0) > 0).length;
    const due = dueCards.length;
    
    // FSRS Distribution
    const distribution = {
      new: allCards.filter(c => (c.fsrs_state || 0) === 0).length,
      learning: allCards.filter(c => (c.fsrs_state || 0) === 1).length,
      review: allCards.filter(c => (c.fsrs_state || 0) === 2).length,
      relearning: allCards.filter(c => (c.fsrs_state || 0) === 3).length,
    };

    return { total, mastered, due, distribution };
  }, [allCards, dueCards]);

  const pieData = [
    { name: '新卡片', value: stats.distribution.new, color: '#94a3b8' }, // Slate-400
    { name: '学习中', value: stats.distribution.learning, color: '#60a5fa' }, // Blue-400
    { name: '复习中', value: stats.distribution.review, color: '#34d399' }, // Emerald-400
    { name: '重学中', value: stats.distribution.relearning, color: '#fbbf24' }, // Amber-400
  ].filter(d => d.value > 0);

  const tableCards = useMemo(() => (tableMode === 'due' ? dueCards : allCards), [tableMode, dueCards, allCards]);

  // Filtered Cards for Table
  const filteredCards = useMemo(() => {
    if (!searchQuery) return tableCards;
    return tableCards.filter(c => 
      c.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tableCards, searchQuery]);

  const totalPages = Math.ceil(filteredCards.length / pageSize);
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

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

  const handleSwipeRate = async (quality: number) => {
    if (!quizCards[currentCardIndex]) return;
    
    try {
      await updateProgressMutation.mutateAsync({
        id: quizCards[currentCardIndex].id,
        quality
      });
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
    setSwipeDirection(null);
    setCardKey(k => k + 1);
    
    // Reshuffle current set
    setQuizCards(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    
    setDragDirection(null);
    setCardRotation(0);
    
    const shouldSwipeRight = offset > threshold && velocity > 0;
    const shouldSwipeLeft = offset < -threshold && velocity < 0;
    
    if (shouldSwipeRight) {
      setSwipeDirection('right');
      handleSwipeRate(3);
      setTimeout(() => {
        handleNextCard();
        setCardKey(k => k + 1);
        setSwipeDirection(null);
      }, 450);
    } else if (shouldSwipeLeft) {
      setSwipeDirection('left');
      handleSwipeRate(1);
      setTimeout(() => {
        handleNextCard();
        setCardKey(k => k + 1);
        setSwipeDirection(null);
      }, 450);
    }
  };

  const handleBackToDashboard = () => {
    setQuizCards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setFinished(false);
    setViewState('dashboard');
  };

  const currentCard = quizCards[currentCardIndex];

  // Safely parse options if they are stored as a JSON string
  const currentOptions: string[] = useMemo(() => {
    if (!currentCard?.options) return [];
    if (Array.isArray(currentCard.options)) return currentCard.options;
    try {
      if (typeof currentCard.options === 'string') {
        return JSON.parse(currentCard.options);
      }
    } catch (e) {
      console.error('Failed to parse card options:', e);
    }
    return [];
  }, [currentCard]);

  if (isLoading) return <div className={`min-h-full flex items-center justify-center p-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>正在加载学习资源...</div>;

  // --- Dashboard & Bank & Focus View ---
  if (viewState === 'dashboard' || viewState === 'bank' || viewState === 'focus') {
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
            
            <div className="flex items-center space-x-2">
                <div className={`flex p-1 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <button
                        onClick={() => setViewState('dashboard')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewState === 'dashboard' 
                            ? (isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900')
                            : (isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700')
                        }`}
                    >
                        概览
                    </button>
                    <button
                        onClick={() => setViewState('bank')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewState === 'bank'
                            ? (isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900')
                            : (isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700')
                        }`}
                    >
                        题库管理
                    </button>
                    <button
                        onClick={() => setViewState('focus')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewState === 'focus'
                            ? (isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900')
                            : (isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700')
                        }`}
                    >
                        专注统计
                    </button>
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
          </div>

          {viewState === 'bank' ? (
            <QuestionBank cards={allCards} />
          ) : viewState === 'focus' ? (
            <FocusStats />
          ) : (
            <>
          {/* Stats Cards & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
               <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`p-3 rounded-xl shadow-sm border flex items-center gap-2 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <LayoutGrid size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>总卡片</p>
                    <p className="text-xl font-black">{stats.total}</p>
                  </div>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className={`p-3 rounded-xl shadow-sm border flex items-center gap-2 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Trophy size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>已掌握</p>
                    <p className="text-xl font-black">{stats.mastered}</p>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`p-3 rounded-xl shadow-sm border flex items-center gap-2 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                    <Clock size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>待复习</p>
                    <p className="text-xl font-black text-amber-500">{stats.due}</p>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className={`p-3 rounded-xl shadow-sm border flex items-center gap-2 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-orange-900/40 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                    <Flame size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>连续学习</p>
                    <p className="text-xl font-black">{streakDays}天</p>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`p-3 rounded-xl shadow-sm border flex items-center gap-2 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <Activity size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>本周学习</p>
                    <p className="text-xl font-black">{Math.round(weeklyStudyTime / 60)}h</p>
                  </div>
                </motion.div>
               </div>

               {/* Action Cards */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  onClick={() => handleStartQuiz('due')}
                  disabled={dueCards.length === 0}
                  className={`flex flex-col items-center text-center p-8 rounded-[2.5rem] border-2 transition-all group relative overflow-hidden ${
                    dueCards.length > 0 
                      ? (isDark ? 'bg-indigo-900/20 border-indigo-800/50 hover:border-indigo-500 shadow-lg shadow-indigo-900/20' : 'bg-indigo-50 border-indigo-100 hover:border-indigo-400 shadow-xl shadow-indigo-100/50')
                      : (isDark ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed')
                  }`}
                >
                  {dueCards.length > 0 && (
                    <div className="absolute top-4 right-4 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </div>
                  )}
                  <div className={`p-6 rounded-[2rem] mb-4 group-hover:scale-110 transition-transform duration-500 ${
                    isDark ? 'bg-indigo-900/40 text-indigo-400' : 'bg-white text-indigo-600 shadow-md'
                  }`}>
                    <Brain size={48} />
                  </div>
                  <h3 className={`text-2xl font-black mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-900'}`}>今日待复习</h3>
                  <p className={`mb-8 max-w-[280px] text-sm font-medium ${isDark ? 'text-indigo-400/80' : 'text-indigo-700/70'}`}>基于 FSRS 算法为您定制的最佳复习计划</p>
                  <div className={`px-8 py-3 rounded-2xl font-black text-lg transition-all ${
                    dueCards.length > 0 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 group-hover:bg-indigo-700 group-hover:-translate-y-1' 
                      : 'bg-gray-300 text-gray-500'
                  }`}>
                    {dueCards.length > 0 ? `立即开始 (${dueCards.length})` : '暂无复习任务'}
                  </div>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={() => handleStartQuiz('all')}
                  disabled={allCards.length === 0}
                  className={`flex flex-col items-center text-center p-8 rounded-[2.5rem] border-2 transition-all group ${
                    allCards.length > 0 
                      ? (isDark ? 'bg-slate-800 border-slate-700 hover:border-indigo-500 shadow-lg' : 'bg-white border-gray-100 hover:border-indigo-400 shadow-xl shadow-gray-100/50')
                      : (isDark ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed')
                  }`}
                >
                  <div className={`p-6 rounded-[2rem] mb-4 group-hover:scale-110 transition-transform duration-500 ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-600'
                  }`}>
                    <Play size={48} />
                  </div>
                  <h3 className="text-2xl font-black mb-2">自由练习</h3>
                  <p className={`mb-8 max-w-[280px] text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>随机测验当前范围内的所有内容，巩固基础</p>
                  <div className={`px-8 py-3 rounded-2xl font-black text-lg transition-all ${
                    allCards.length > 0 
                      ? (isDark ? 'bg-slate-700 text-white border border-slate-600 group-hover:bg-slate-600 group-hover:-translate-y-1' : 'bg-white text-gray-700 border-2 border-gray-100 shadow-sm group-hover:border-indigo-200 group-hover:-translate-y-1')
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {allCards.length > 0 ? `开始自测 (${allCards.length})` : '暂无卡片数据'}
                  </div>
                </motion.button>
              </div>
            </div>

            {/* Chart */}
            <div className="lg:col-span-1">
              <StatsOverview data={pieData} />
            </div>
          </div>

          {/* Health Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weak Points */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                薄弱知识点
              </h3>
              {weakPoints.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>暂无薄弱知识点，继续保持！</p>
              ) : (
                <div className="space-y-3">
                  {weakPoints.slice(0, 5).map((point, idx) => (
                    <div key={idx} className={`p-3 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate flex-1">{point.nodeTitle}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          point.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          point.priority === 'medium' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {point.priority === 'high' ? '高优先' : point.priority === 'medium' ? '中优先' : '低优先'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full"
                            style={{ width: `${point.mastery}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{point.mastery}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Predictions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="text-blue-500" size={20} />
                未来7天预测
              </h3>
              {predictions.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>暂无预测数据</p>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {predictions.slice(0, 7).map((pred, idx) => {
                    const date = new Date(pred.date);
                    const dayName = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
                    const isToday = new Date().toDateString() === date.toDateString();
                    
                    return (
                      <div key={idx} className={`text-center p-2 rounded-xl ${
                        isToday 
                          ? (isDark ? 'bg-indigo-900/30 ring-2 ring-indigo-500' : 'bg-indigo-50 ring-2 ring-indigo-300')
                          : (isDark ? 'bg-slate-700/50' : 'bg-gray-50')
                      }`}>
                        <p className={`text-xs font-medium ${isToday ? 'text-indigo-500' : (isDark ? 'text-slate-400' : 'text-gray-500')}`}>
                          {dayName}
                        </p>
                        <p className={`text-lg font-bold ${isToday ? 'text-indigo-500' : ''}`}>
                          {pred.reviewCount}
                        </p>
                        <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${
                          pred.difficulty === 'easy' ? 'bg-green-500' :
                          pred.difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* Cards List Section */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="text-indigo-500" size={24} />
                卡片列表
              </h2>
              
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <div className={`flex p-1 rounded-xl w-fit ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                  <button
                    onClick={() => setTableMode('due')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      tableMode === 'due' 
                        ? (isDark ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 shadow-sm') 
                        : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
                    }`}
                  >
                    待复习 ({dueCards.length})
                  </button>
                  <button
                    onClick={() => setTableMode('all')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      tableMode === 'all' 
                        ? (isDark ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 shadow-sm') 
                        : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
                    }`}
                  >
                    全部 ({allCards.length})
                  </button>
                </div>
                
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={18} />
                  <input
                    type="text"
                    placeholder="搜索题目或答案..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-full md:w-64 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-sm'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {paginatedCards.length === 0 ? (
                <div className={`col-span-full py-12 text-center rounded-3xl border-2 border-dashed ${
                  isDark ? 'border-slate-800 text-slate-500' : 'border-gray-200 text-gray-400'
                }`}>
                  <Search className="mx-auto mb-3 opacity-20" size={48} />
                  <p>没有找到匹配的卡片</p>
                </div>
              ) : (
                paginatedCards.map((card) => (
                  <div key={card.id} className="h-full">
                    <StudyCardPreview
                      card={card}
                      isDark={isDark}
                      onPreview={setPreviewCard}
                      onPractice={(c) => {
                        setQuizCards([c]);
                        setCurrentCardIndex(0);
                        setFinished(false);
                        setViewState('quiz');
                      }}
                      showStatus={true}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-xl transition-all ${
                    currentPage === 1 
                      ? 'opacity-30 cursor-not-allowed' 
                      : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600')
                  }`}
                >
                  <ChevronLeft size={20} />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    // Show first, last, current, and pages around current
                    if (
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : (isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500')
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      (page === currentPage - 2 && page > 1) ||
                      (page === currentPage + 2 && page < totalPages)
                    ) {
                      return <span key={page} className="px-1 text-slate-400">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-xl transition-all ${
                    currentPage === totalPages 
                      ? 'opacity-30 cursor-not-allowed' 
                      : (isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600')
                  }`}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
          </>
        )}
        </div>

        {/* Card Preview Modal */}
        <StudyCardDetailModal
          card={previewCard}
          isOpen={!!previewCard}
          onClose={() => setPreviewCard(null)}
          isDark={isDark}
          onPractice={(card) => {
            setQuizCards([card]);
            setCurrentCardIndex(0);
            setFinished(false);
            setViewState('quiz');
          }}
        />
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
    <div className={`min-h-full flex flex-col items-center justify-center p-4 md:p-8 transition-colors ${isDark ? 'bg-slate-900' : 'bg-gray-100'}`}>
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6 px-2">
          <button 
            onClick={handleBackToDashboard}
            className={`flex items-center transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'}`}
          >
            <ArrowLeft size={20} className="mr-1" />
            <span className="font-medium">退出</span>
          </button>
          <div className="text-center">
            <h2 className={`text-lg font-bold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>学习模式</h2>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>左右滑动可快速评分</p>
          </div>
          <span className={`font-bold px-3 py-1 rounded-full text-sm ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-gray-500 shadow-sm'}`}>
            {currentCardIndex + 1} / {quizCards.length}
          </span>
        </div>

        <div className="relative perspective-1000 h-[550px] md:h-[600px]">
          {quizCards.slice(currentCardIndex + 1, currentCardIndex + 3).map((stackCard, index) => {
            const stackIndex = index + 1;
            const isNext = stackIndex === 1;
            const stackCardOptions = (() => {
              if (!stackCard.options) return [];
              if (Array.isArray(stackCard.options)) return stackCard.options;
              try {
                if (typeof stackCard.options === 'string') return JSON.parse(stackCard.options);
              } catch { }
              return [];
            })();
            const isStackQA = !stackCard.card_type || stackCard.card_type === 'qa';
            const isStackChoice = stackCard.card_type === 'choice';
            const isStackMultiChoice = stackCard.card_type === 'multi_choice';
            const isStackTrueFalse = stackCard.card_type === 'true_false';
            const isStackFillBlank = stackCard.card_type === 'fill_in_the_blank';
            
            return (
              <motion.div
                key={`stack-${stackCard.id}`}
                className={`absolute inset-0 rounded-3xl shadow-lg transition-colors border overflow-hidden ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
                }`}
                initial={{ 
                  rotate: -8 * stackIndex, 
                  y: stackIndex * 20, 
                  scale: 1 - stackIndex * 0.03, 
                  opacity: 0 
                }}
                animate={{ 
                  rotate: -8 * stackIndex, 
                  y: stackIndex * 20, 
                  scale: 1 - stackIndex * 0.03, 
                  opacity: isNext ? 1 : 0.6
                }}
                exit={{ 
                  rotate: 0, 
                  y: 0, 
                  scale: 1, 
                  opacity: 1 
                }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                style={{ 
                  zIndex: 10 - stackIndex, 
                  transformOrigin: 'bottom center',
                }}
              >
                {isNext && (
                  <div className="p-5 md:p-8 flex flex-col h-full">
                    <div className={`absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      下一张
                    </div>
                    <div className="flex-1 overflow-hidden mt-2">
                      <h3 className={`uppercase tracking-widest text-[10px] font-bold mb-2 px-2 py-0.5 rounded-md inline-block ${
                        isDark ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        问题
                      </h3>
                      <div className={`text-base md:text-lg font-semibold leading-snug mb-3 line-clamp-2 ${
                        isDark ? 'text-slate-200' : 'text-gray-800'
                      }`}>
                        {stackCard.question}
                      </div>
                      
                      {isStackChoice && stackCardOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {stackCardOptions.slice(0, 4).map((option: string, idx: number) => (
                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                              isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-gray-50 text-gray-600'
                            }`}>
                              <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                isDark ? 'bg-slate-600 text-slate-400' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span className="truncate flex-1">{option}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {isStackMultiChoice && stackCardOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {stackCardOptions.slice(0, 4).map((option: string, idx: number) => (
                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                              isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-gray-50 text-gray-600'
                            }`}>
                              <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                isDark ? 'bg-slate-600 text-slate-400' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span className="truncate flex-1">{option}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {isStackTrueFalse && (
                        <div className="flex gap-2">
                          <div className={`flex-1 p-2 rounded-lg text-center text-sm font-medium ${
                            isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-gray-50 text-gray-600'
                          }`}>
                            正确
                          </div>
                          <div className={`flex-1 p-2 rounded-lg text-center text-sm font-medium ${
                            isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-gray-50 text-gray-600'
                          }`}>
                            错误
                          </div>
                        </div>
                      )}
                      
                      {(isStackQA || isStackFillBlank) && (
                        <div className={`mt-2 p-3 rounded-lg text-sm ${
                          isDark ? 'bg-slate-700/30 text-slate-400' : 'bg-gray-50 text-gray-500'
                        }`}>
                          <span className="text-xs font-medium opacity-70">答案：</span>
                          <span className="ml-1 line-clamp-1">{stackCard.answer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={cardKey}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDrag={(_, info) => {
                const rotation = info.offset.x * 0.12;
                setCardRotation(rotation);
                if (info.offset.x > 30) {
                  setDragDirection('right');
                } else if (info.offset.x < -30) {
                  setDragDirection('left');
                } else {
                  setDragDirection(null);
                }
              }}
              onDragEnd={handleDragEnd}
              initial={{ rotate: -20, y: 40, scale: 0.92, opacity: 0 }}
              animate={{ rotate: 0, y: 0, scale: 1, opacity: 1 }}
              exit={{ 
                rotate: swipeDirection === 'right' ? 150 : -150,
                y: -80,
                x: swipeDirection === 'right' ? 200 : -200,
                opacity: 0,
                scale: 0.85,
                transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] }
              }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={`absolute inset-0 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 md:p-10 flex flex-col cursor-grab active:cursor-grabbing transition-colors border ${
                isDark ? 'border-slate-700' : 'border-gray-100'
              }`}
              style={{ transformOrigin: 'bottom center', rotate: cardRotation, zIndex: 10 }}
            >
              {/* Swipe Feedback Icons - On Card */}
              <motion.div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                animate={{ 
                  opacity: dragDirection === 'right' ? 1 : 0,
                  scale: dragDirection === 'right' ? 1 : 0.8
                }}
                transition={{ duration: 0.15 }}
              >
                <div className="bg-green-500/20 p-8 rounded-full border-4 border-green-500 text-green-500">
                  <ThumbsUp size={80} />
                </div>
              </motion.div>
              <motion.div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                animate={{ 
                  opacity: dragDirection === 'left' ? 1 : 0,
                  scale: dragDirection === 'left' ? 1 : 0.8
                }}
                transition={{ duration: 0.15 }}
              >
                <div className="bg-red-500/20 p-8 rounded-full border-4 border-red-500 text-red-500">
                  <ThumbsDown size={80} />
                </div>
              </motion.div>
              {/* Card Type Badge */}
              <div className={`absolute top-6 right-6 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider z-10 ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500'
              }`}>
                {isQA ? '问答题' : isChoice ? '单选题' : isMultiChoice ? '多选题' : isTrueFalse ? '判断题' : isFillBlank ? '填空题' : '解答题'}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-8 mt-4">
                {/* Question Section */}
                <div className="flex flex-col items-start text-left">
                  <h3 className={`uppercase tracking-widest text-[11px] font-bold mb-3 px-3 py-1 rounded-md ${
                    isDark ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    问题
                  </h3>
                  <div className={`text-lg md:text-xl font-semibold leading-snug ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                    {currentCard.question}
                  </div>
                </div>

                {/* Answer Content Section */}
                <div className="w-full pb-6">
                  {showAnswer && (
                    <div className="space-y-8 animate-fade-in">
                      {(isQA || isEssay || isFillBlank) && (
                        <div className={`border-t pt-8 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                          <h3 className={`uppercase tracking-widest text-[11px] font-bold mb-4 px-3 py-1 rounded-md w-fit ${
                            isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {isFillBlank ? '填空内容' : '标准答案'}
                          </h3>
                          <div className={`text-lg md:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'} whitespace-pre-wrap`}>
                            {currentCard.answer}
                          </div>
                        </div>
                      )}

                      {currentCard.explanation && (
                        <div className={`pt-8 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                          <div className="flex items-center gap-2 mb-4 text-indigo-500">
                            <Brain size={18} />
                            <h4 className="font-bold tracking-wider text-sm uppercase">题目解析</h4>
                          </div>
                          <div className={`p-5 rounded-2xl text-sm leading-relaxed border ${
                            isDark ? 'bg-slate-900/50 text-slate-400 border-slate-700' : 'bg-indigo-50/30 text-gray-600 border-indigo-100'
                          }`}>
                            {currentCard.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Options Section */}
                  {isChoice && currentOptions.length > 0 && (
                    <div className="flex flex-col gap-2 mt-4">
                      {currentOptions.map((option: string, idx: number) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = option === currentCard.answer;
                        
                        let btnClass = "group p-3 rounded-xl border transition-all duration-200 relative flex items-start gap-3 shadow-sm ";
                        if (showAnswer) {
                          if (isCorrect) btnClass += isDark ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md" : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";
                          else if (isSelected) btnClass += isDark ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md" : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";
                          else btnClass += isDark ? "bg-slate-800/50 border-slate-700 text-slate-500" : "bg-gray-50 border-gray-200 text-gray-400";
                        } else {
                          btnClass += isDark 
                            ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-indigo-900/30 hover:to-slate-800/50 hover:border-indigo-500 cursor-pointer text-slate-200 hover:shadow-md" 
                            : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-indigo-50 hover:to-white hover:border-indigo-300 cursor-pointer text-gray-700 hover:shadow-md";
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => handleOptionClick(option)}
                            disabled={showAnswer}
                            className={btnClass}
                          >
                            <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                              isSelected 
                                ? 'bg-indigo-500 text-white shadow-sm scale-105' 
                                : (isDark ? 'bg-slate-700 text-slate-400 group-hover:bg-slate-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600')
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="flex-1 text-sm font-medium leading-snug">{option}</span>
                            {showAnswer && isCorrect && <Check className="text-emerald-500 flex-shrink-0" size={18} />}
                            {showAnswer && isSelected && !isCorrect && <X className="text-red-500 flex-shrink-0" size={18} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isMultiChoice && currentOptions.length > 0 && (
                    <div className="flex flex-col gap-2 mt-4">
                      {currentOptions.map((option: string, idx: number) => {
                        const selectedList = selectedOption ? JSON.parse(selectedOption) : [];
                        const isSelected = selectedList.includes(option);
                        let correctList: string[] = [];
                        try { correctList = JSON.parse(currentCard.answer); } catch { }
                        const isCorrect = correctList.includes(option);
                        
                        let btnClass = "group p-3 rounded-xl border transition-all duration-200 relative flex items-start gap-3 shadow-sm ";
                        if (showAnswer) {
                          if (isCorrect) btnClass += isDark ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md" : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";
                          else if (isSelected) btnClass += isDark ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md" : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";
                          else btnClass += isDark ? "bg-slate-800/50 border-slate-700 text-slate-500" : "bg-gray-50 border-gray-200 text-gray-400";
                        } else {
                          btnClass += isSelected 
                            ? (isDark ? "bg-gradient-to-r from-indigo-900/40 to-indigo-900/20 border-indigo-500 text-indigo-300 shadow-md" : "bg-gradient-to-r from-indigo-100 to-indigo-50 border-indigo-400 text-indigo-700 shadow-md") 
                            : (isDark ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-indigo-900/30 hover:to-slate-800/50 hover:border-indigo-500 cursor-pointer text-slate-200 hover:shadow-md" : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-indigo-50 hover:to-white hover:border-indigo-300 cursor-pointer text-gray-700 hover:shadow-md");
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => handleMultiOptionClick(option)}
                            disabled={showAnswer}
                            className={btnClass}
                          >
                            <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                              isSelected 
                                ? 'bg-indigo-500 text-white shadow-sm scale-105' 
                                : (isDark ? 'bg-slate-700 text-slate-400 group-hover:bg-slate-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600')
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="flex-1 text-sm font-medium leading-snug">{option}</span>
                            {showAnswer && isCorrect && <Check className="text-emerald-500 flex-shrink-0" size={18} />}
                            {showAnswer && isSelected && !isCorrect && <X className="text-red-500 flex-shrink-0" size={18} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isTrueFalse && (
                    <div className="flex flex-col md:flex-row gap-3 justify-center mt-4">
                      {['True', 'False'].map((option) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = option === currentCard.answer;
                        
                        let btnClass = "group flex-1 p-4 rounded-xl border transition-all duration-200 font-bold text-base relative flex flex-col items-center justify-center gap-2 shadow-sm ";
                        if (showAnswer) {
                           if (isCorrect) btnClass += isDark ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md" : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";
                           else if (isSelected) btnClass += isDark ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md" : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";
                           else btnClass += isDark ? "bg-slate-800/50 border-slate-700 text-slate-500" : "bg-gray-50 border-gray-200 text-gray-400";
                        } else {
                          btnClass += isDark 
                            ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-indigo-900/30 hover:to-slate-800/50 hover:border-indigo-500 cursor-pointer text-slate-200 hover:shadow-md" 
                            : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-indigo-50 hover:to-white hover:border-indigo-300 cursor-pointer text-gray-700 hover:shadow-md";
                        }

                        return (
                          <button
                            key={option}
                            onClick={() => handleOptionClick(option)}
                            disabled={showAnswer}
                            className={btnClass}
                          >
                            <span className="text-lg font-bold">{option === 'True' ? '正确' : '错误'}</span>
                            <span className="text-xs opacity-50 uppercase tracking-wider">{option}</span>
                            {showAnswer && isCorrect && <Check className="text-emerald-500 absolute top-3 right-3" size={16} />}
                            {showAnswer && isSelected && !isCorrect && <X className="text-red-500 absolute top-3 right-3" size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Footer */}
              <div className={`mt-auto pt-6 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <AnimatePresence mode="wait">
                  {!showAnswer ? (
                    <motion.div
                      key="submit-action"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full"
                    >
                      {(isQA || isEssay || isFillBlank) ? (
                        <button
                          onClick={() => setShowAnswer(true)}
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                          <BookOpen size={20} />
                          显示答案
                        </button>
                      ) : isMultiChoice ? (
                        <button
                          onClick={() => setShowAnswer(true)}
                          disabled={!selectedOption || JSON.parse(selectedOption).length === 0}
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                        >
                          提交答案
                        </button>
                      ) : (
                        <div className={`text-center py-4 text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                          请选择一个选项以查看答案
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="rating-action"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full"
                    >
                      <div className="flex items-center gap-2 mb-4 text-slate-400 dark:text-slate-500">
                        <Check size={14} />
                        <h4 className="font-bold tracking-wider text-[10px] uppercase">评价记忆程度</h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button
                          onClick={() => handleRate(1)}
                          className={`flex flex-col items-center justify-center py-3 rounded-xl font-bold transition-all ${
                            isDark ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <ThumbsDown size={16} className="mb-1" />
                          <span className="text-xs">重来</span>
                        </button>
                        <button
                          onClick={() => handleRate(2)}
                          className={`flex flex-col items-center justify-center py-3 rounded-xl font-bold transition-all ${
                            isDark ? 'bg-orange-900/20 text-orange-400 hover:bg-orange-900/40' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <span className="text-xs">困难</span>
                        </button>
                        <button
                          onClick={() => handleRate(3)}
                          className={`flex flex-col items-center justify-center py-3 rounded-xl font-bold transition-all ${
                            isDark ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/40' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <ThumbsUp size={16} className="mb-1" />
                          <span className="text-xs">良好</span>
                        </button>
                        <button
                          onClick={() => handleRate(4)}
                          className={`flex flex-col items-center justify-center py-3 rounded-xl font-bold transition-all ${
                            isDark ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <span className="text-xs">简单</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Swipe Instructions */}
        {!showAnswer && (
          <div className="mt-8 text-center animate-bounce-slow">
            <p className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              左右滑动卡片快速评分 (左: 重来, 右: 良好)
            </p>
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

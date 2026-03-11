import React, { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  FileQuestion,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useQuizSets, useDeleteQuizSetMutation } from '../../hooks/queries';
import { QuizCard } from './QuizCard';
import type { QuizSet, QuizSetStatus } from '@shared/types/quiz';

interface QuizListProps {
  onCreateQuiz?: () => void;
  onEditQuiz?: (quiz: QuizSet) => void;
  onStartPractice?: (quiz: QuizSet) => void;
  onViewQuiz?: (quiz: QuizSet) => void;
}

export const QuizList: React.FC<QuizListProps> = ({
  onCreateQuiz,
  onEditQuiz,
  onStartPractice,
  onViewQuiz,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<QuizSetStatus | 'all'>('all');
  const [selectedGraphId, setSelectedGraphId] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { data: quizSets, isLoading, error } = useQuizSets();
  const deleteMutation = useDeleteQuizSetMutation();

  const graphOptions = useMemo(() => {
    if (!quizSets) return [];
    const graphIds = new Set<string>();
    quizSets.forEach((q) => {
      if (q.graph_id) graphIds.add(q.graph_id);
    });
    return Array.from(graphIds);
  }, [quizSets]);

  const filteredQuizzes = useMemo(() => {
    if (!quizSets) return [];
    return quizSets.filter((quiz) => {
      const matchesSearch =
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quiz.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesStatus = selectedStatus === 'all' || quiz.status === selectedStatus;
      const matchesGraph =
        selectedGraphId === 'all' || quiz.graph_id === selectedGraphId;
      return matchesSearch && matchesStatus && matchesGraph;
    });
  }, [quizSets, searchTerm, selectedStatus, selectedGraphId]);

  const totalPages = Math.ceil(filteredQuizzes.length / pageSize);
  const paginatedQuizzes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuizzes.slice(start, start + pageSize);
  }, [filteredQuizzes, currentPage, pageSize]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, selectedGraphId]);

  const handleDelete = async (quiz: QuizSet) => {
    if (confirm(`确定要删除测验 "${quiz.title}" 吗？此操作不可恢复。`)) {
      await deleteMutation.mutateAsync(quiz.id);
    }
  };

  const statusCounts = useMemo(() => {
    if (!quizSets) return { all: 0, draft: 0, generating: 0, ready: 0 };
    return {
      all: quizSets.length,
      draft: quizSets.filter((q) => q.status === 'draft').length,
      generating: quizSets.filter((q) => q.status === 'generating').length,
      ready: quizSets.filter((q) => q.status === 'ready').length,
    };
  }, [quizSets]);

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border p-16 flex flex-col items-center justify-center gap-4 ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
        }`}
      >
        <Loader2 size={32} className={`animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
        <p className={isDark ? 'text-slate-400' : 'text-gray-500'}>正在加载测验列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-xl border p-16 flex flex-col items-center justify-center gap-4 ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
        }`}
      >
        <FileQuestion size={32} className="text-red-400" />
        <p className="text-red-500">加载测验列表失败</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
              size={18}
            />
            <input
              type="text"
              placeholder="搜索测验标题或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-indigo-100 border-indigo-200 text-indigo-600'
                : isDark
                  ? 'bg-slate-800 border-slate-700 text-gray-400 hover:text-white'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
            title="筛选"
          >
            <Filter size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex p-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
            {(['all', 'draft', 'generating', 'ready'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedStatus === status
                    ? isDark
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {status === 'all' ? '全部' : status === 'draft' ? '草稿' : status === 'generating' ? '生成中' : '就绪'}
                {status !== 'all' && ` (${statusCounts[status]})`}
              </button>
            ))}
          </div>

          {onCreateQuiz && (
            <button
              onClick={onCreateQuiz}
              className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle size={18} />
              <span>新建测验</span>
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className={`p-4 border-b ${isDark ? 'bg-slate-800/30' : 'bg-gray-50/50'}`}>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">按图谱筛选</label>
              <select
                value={selectedGraphId}
                onChange={(e) => setSelectedGraphId(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-200'
                }`}
              >
                <option value="all">所有图谱</option>
                {graphOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {filteredQuizzes.length === 0 ? (
          <div
            className={`p-16 text-center flex flex-col items-center justify-center gap-4 ${
              isDark ? 'text-slate-500' : 'text-gray-500'
            }`}
          >
            <div className={`p-4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
              <Layers size={32} className="opacity-50" />
            </div>
            <p>没有找到符合条件的测验</p>
            {onCreateQuiz && (
              <button
                onClick={onCreateQuiz}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusCircle size={18} />
                创建第一个测验
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {paginatedQuizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  isDark={isDark}
                  onStartPractice={onStartPractice}
                  onEdit={onEditQuiz}
                  onDelete={handleDelete}
                  onClick={onViewQuiz}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {filteredQuizzes.length > 0 && (
        <div
          className={`p-4 border-t flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-gray-100'
          }`}
        >
          <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredQuizzes.length)} 条，共{' '}
            {filteredQuizzes.length} 条
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border transition-colors ${
                currentPage === 1
                  ? isDark
                    ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'border-gray-100 text-gray-300 cursor-not-allowed'
                  : isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
                        : isDark
                          ? 'text-slate-400 hover:bg-slate-800'
                          : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg border transition-colors ${
                currentPage === totalPages
                  ? isDark
                    ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'border-gray-100 text-gray-300 cursor-not-allowed'
                  : isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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

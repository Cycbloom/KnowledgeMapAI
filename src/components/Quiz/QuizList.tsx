import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileQuestion,
  XCircle,
} from 'lucide-react';
import { useTheme } from "../../hooks";
import { SkeletonCard, EmptyState } from "../../components/common";
import { useQuizSets, useDeleteQuizSetMutation } from '../../hooks/queries';
import { useGraphs } from '../../hooks/queries/useGraphQueries';
import { QuizCard } from './QuizCard';
import type { QuizSet, QuizSetStatus } from '@shared/types/quiz';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { useDebouncedSearch } from '../../hooks/common/useDebouncedSearch';

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
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { query: searchTerm, setQuery: setSearchTerm, debouncedQuery: debouncedSearchTerm } = useDebouncedSearch();
  const [selectedStatus, setSelectedStatus] = useState<QuizSetStatus | 'all'>('all');
  const [selectedGraphId, setSelectedGraphId] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { data: quizSets, isLoading, error, refetch } = useQuizSets();
  const { data: graphs } = useGraphs();
  const deleteMutation = useDeleteQuizSetMutation();

  const graphNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (graphs) {
      graphs.forEach((g) => map.set(g.id, g.title));
    }
    return map;
  }, [graphs]);

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
        quiz.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (quiz.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ?? false);
      const matchesStatus = selectedStatus === 'all' || quiz.status === selectedStatus;
      const matchesGraph =
        selectedGraphId === 'all' || quiz.graph_id === selectedGraphId;
      return matchesSearch && matchesStatus && matchesGraph;
    });
  }, [quizSets, debouncedSearchTerm, selectedStatus, selectedGraphId]);

  const totalPages = Math.ceil(filteredQuizzes.length / pageSize);
  const paginatedQuizzes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuizzes.slice(start, start + pageSize);
  }, [filteredQuizzes, currentPage, pageSize]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, selectedGraphId]);

  const handleDelete = async (quiz: QuizSet) => {
    if (await asyncConfirm({ title: t('study.quizList.deleteConfirm', { title: quiz.title }), message: t('study.quizList.deleteConfirm', { title: quiz.title }), isDangerous: true })) {
      await deleteMutation.mutateAsync(quiz.id);
    }
  };

  const statusCounts = useMemo(() => {
    if (!quizSets) return { all: 0, draft: 0, generating: 0, ready: 0 };
    // 单趟统计各状态数量，替代三次 filter 的 O(3*quizSets) 扫描
    let draft = 0;
    let generating = 0;
    let ready = 0;
    for (const q of quizSets) {
      if (q.status === 'draft') draft++;
      else if (q.status === 'generating') generating++;
      else if (q.status === 'ready') ready++;
    }
    return { all: quizSets.length, draft, generating, ready };
  }, [quizSets]);

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border p-4 ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
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
        <p className="text-red-500">{t('study.quizList.loadFailed')}</p>
        <button
          onClick={() => { void refetch(); }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {t('study.quizList.retry')}
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
              placeholder={t('study.quizList.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label={t('common.aria.clear')}
                title={t('common.aria.clear')}
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-primary-100 border-primary-200 text-primary-600'
                : isDark
                  ? 'bg-slate-800 border-slate-700 text-gray-400 hover:text-white'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
            title={t('study.quizList.filter')}
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
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-primary-600 shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {status === 'all' ? t('study.quizList.allStatus') : status === 'draft' ? t('study.quizList.statusDraft') : status === 'generating' ? t('study.quizList.statusGenerating') : t('study.quizList.statusReady')}
                {status !== 'all' && ` (${statusCounts[status]})`}
              </button>
            ))}
          </div>

          {onCreateQuiz && (
            <button
              onClick={onCreateQuiz}
              className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <PlusCircle size={18} />
              <span>{t('study.quizList.newQuiz')}</span>
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className={`p-4 border-b ${isDark ? 'bg-slate-800/30' : 'bg-gray-50/50'}`}>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{t('study.quizList.filterByGraph')}</label>
              <select
                value={selectedGraphId}
                onChange={(e) => setSelectedGraphId(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-200'
                }`}
              >
                <option value="all">{t('study.quizList.allGraphs')}</option>
                {graphOptions.map((id) => (
                  <option key={id} value={id}>
                    {graphNameMap.get(id) ?? t('study.quizList.deleted')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {filteredQuizzes.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            iconWrapper
            size="md"
            illustration="empty"
            title={t('study.quizList.noQuizzesFound')}
            action={onCreateQuiz ? { label: t('study.quizList.createFirstQuiz'), onClick: onCreateQuiz } : undefined}
          />
        ) : (
          <div role="list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
          <div aria-live="polite" className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {t('study.quizList.pagination', {
              start: ((currentPage - 1) * pageSize) + 1,
              end: Math.min(currentPage * pageSize, filteredQuizzes.length),
              total: filteredQuizzes.length
            })}
          </div>

          <nav aria-label={t("common.aria.pagination")} className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label={t("common.aria.previousPage")}
              aria-disabled={currentPage === 1 ? "true" : undefined}
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
              <ChevronLeft size={16} aria-hidden="true" />
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
                    aria-current={currentPage === pageNum ? "page" : undefined}
                    aria-label={t("common.aria.page", { number: pageNum })}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
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
              aria-label={t("common.aria.nextPage")}
              aria-disabled={currentPage === totalPages ? "true" : undefined}
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
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

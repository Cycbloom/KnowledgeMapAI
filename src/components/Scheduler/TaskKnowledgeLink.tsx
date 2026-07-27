import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Search,
  BookOpen,
  Star,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import { knowledgePointsApi } from "../../services/api/knowledgePoints";
import type { TaskKnowledgePoint } from "@shared/types/scheduler";

interface TaskKnowledgeLinkProps {
  taskId: string;
  selectedKnowledgePoints: TaskKnowledgePoint[];
  onChange: (knowledgePoints: TaskKnowledgePoint[]) => void;
}

interface SearchResult {
  id: string;
  title: string;
  content?: string;
  similarity?: number;
}

export const TaskKnowledgeLink: React.FC<TaskKnowledgeLinkProps> = ({
  taskId,
  selectedKnowledgePoints,
  onChange,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchKnowledgePoints = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await knowledgePointsApi.searchSimilar({
        query: query.trim(),
        limit: 10,
      });
      const results = response || [];
      const filtered = results.filter(
        (r) => !selectedKnowledgePoints.some((kp) => kp.knowledge_point_id === r.id)
      );
      setSearchResults(
        filtered.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          similarity: r.similarity,
        }))
      );
    } catch (error) {
      console.error("Search error:", error);
      setSearchError("搜索失败，请重试");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedKnowledgePoints]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearchKnowledgePoints(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearchKnowledgePoints]);

  const handleAddKnowledgePoint = (kp: SearchResult) => {
    const newAssociation: TaskKnowledgePoint = {
      id: `temp-${Date.now()}`,
      task_id: taskId,
      knowledge_point_id: kp.id,
      relevance_score: Math.round((kp.similarity || 0.8) * 100),
      is_primary: selectedKnowledgePoints.length === 0,
      created_at: new Date().toISOString(),
      knowledge_point: {
        id: kp.id,
        title: kp.title,
        content: kp.content,
      },
    };
    onChange([...selectedKnowledgePoints, newAssociation]);
    setIsAdding(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveKnowledgePoint = (kpId: string) => {
    const updated = selectedKnowledgePoints.filter((kp) => kp.id !== kpId);
    if (
      selectedKnowledgePoints.find((kp) => kp.id === kpId)?.is_primary &&
      updated.length > 0
    ) {
      updated[0] = { ...updated[0], is_primary: true };
    }
    onChange(updated);
  };

  const handleSetPrimary = (kpId: string) => {
    onChange(
      selectedKnowledgePoints.map((kp) => ({
        ...kp,
        is_primary: kp.id === kpId,
      }))
    );
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          <BookOpen size={14} className="inline mr-1.5" />
          {t('scheduler.taskLink.linkedKnowledge')}
          {selectedKnowledgePoints.length > 0 && (
            <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal">
              {t('scheduler.taskLink.count', { count: selectedKnowledgePoints.length })}
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
        >
          <Plus size={14} />
          {t('scheduler.taskLink.add')}
        </button>
      </div>

      {isAdding && (
        <div className="mb-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-500">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('scheduler.taskLink.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-primary-500" />
              </div>
            )}
          </div>

          {searchError && (
            <p className="mt-2 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={14} />
              {t('scheduler.taskLink.searchFailed')}
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-500 rounded-xl">
              {searchResults.map((kp) => (
                <button
                  key={kp.id}
                  type="button"
                  onClick={() => handleAddKnowledgePoint(kp)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-left transition-colors border-b border-slate-100 dark:border-slate-500 last:border-b-0"
                >
                  <BookOpen size={16} className="text-primary-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {kp.title}
                    </p>
                    {kp.content && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {kp.content}
                      </p>
                    )}
                  </div>
                  {kp.similarity !== undefined && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {Math.round(kp.similarity * 100)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchQuery && !isSearching && searchResults.length === 0 && !searchError && (
            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              {t('scheduler.taskLink.noResults')}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={handleCancelAdd}
              className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
            >
              {t('scheduler.taskLink.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {selectedKnowledgePoints.map((kp) => (
          <div
            key={kp.id}
            className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${
              kp.is_primary
                ? "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <BookOpen size={18} className="text-primary-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900 dark:text-white truncate">
                  {kp.knowledge_point?.title || t('scheduler.taskLink.unknownKnowledge')}
                </p>
                {kp.is_primary && (
                  <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded">
                    {t('scheduler.taskLink.primary')}
                  </span>
                )}
              </div>
              {kp.knowledge_point?.content && (
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {kp.knowledge_point.content}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {t('scheduler.taskLink.relevance')}: {kp.relevance_score}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!kp.is_primary && (
                <button
                  type="button"
                  onClick={() => handleSetPrimary(kp.id)}
                  className="p-1.5 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors"
                  title={t('scheduler.taskKnowledge.setPrimary')}
                  aria-label={t('scheduler.taskKnowledge.setPrimary')}
                >
                  <Star size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemoveKnowledgePoint(kp.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title={t('scheduler.taskKnowledge.unlink')}
                aria-label={t('scheduler.taskKnowledge.unlink')}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}

        {selectedKnowledgePoints.length === 0 && !isAdding && (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500">
            <BookOpen size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('scheduler.taskLink.noLinkedKnowledge')}</p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-2 text-sm text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
            >
              {t('scheduler.taskLink.addLink')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

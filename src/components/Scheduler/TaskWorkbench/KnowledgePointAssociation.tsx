import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  ExternalLink,
  Star,
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
  Link,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { EmptyState } from "../../common/EmptyState";
import { TaskKnowledgePoint, type SimilarKnowledgePoint } from "../../../types";
import { message } from "../../../utils/messageHelper";

interface KnowledgePointAssociationProps {
  taskId: string;
  className?: string;
}

export const KnowledgePointAssociation: React.FC<
  KnowledgePointAssociationProps
> = ({ taskId, className = "" }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [associations, setAssociations] = useState<TaskKnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimilarKnowledgePoint[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadAssociations();
  }, [taskId]);

  const loadAssociations = async () => {
    try {
      const data = await api.scheduler.getTaskKnowledgePoints(taskId);
      setAssociations(data ?? []);
    } catch (error) {
      console.error("Failed to load knowledge point associations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKnowledgePoints = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await api.knowledgePoints.searchSimilar({ query, limit: 10 });
      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearchKnowledgePoints(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearchKnowledgePoints]);

  const handleAddAssociation = async (knowledgePointId: string) => {
    try {
      const created = await api.scheduler.addTaskKnowledgePoint(taskId, {
        knowledge_point_id: knowledgePointId,
        is_primary: associations.length === 0,
      });
      setAssociations([...associations, created]);
      setIsAdding(false);
      setSearchQuery("");
      setSearchResults([]);
      message.success(t('scheduler.taskWorkbench.knowledgePointAssociation.associateSuccess'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('scheduler.taskWorkbench.knowledgePointAssociation.associateFailed');
      message.error(errorMessage);
    }
  };

  const handleRemoveAssociation = async (kpId: string) => {
    try {
      await api.scheduler.removeTaskKnowledgePoint(taskId, kpId);
      setAssociations(associations.filter((a) => a.id !== kpId));
      message.success(t('scheduler.taskWorkbench.knowledgePointAssociation.unassociateSuccess'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('scheduler.taskWorkbench.knowledgePointAssociation.unassociateFailed');
      message.error(errorMessage);
    }
  };

  const handleSetPrimary = async (kpId: string) => {
    try {
      await api.scheduler.updateTaskKnowledgePoint(
        taskId,
        kpId,
        { is_primary: true },
      );
      setAssociations(
        associations.map((a) => ({
          ...a,
          is_primary: a.id === kpId,
        })),
      );
      message.success(t('scheduler.taskWorkbench.knowledgePointAssociation.setPrimarySuccess'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('scheduler.taskWorkbench.knowledgePointAssociation.setPrimaryFailed');
      message.error(errorMessage);
    }
  };

  const handleViewInGraph = (knowledgePointId: string) => {
    navigate(`/graph-editor?nodeId=${knowledgePointId}`);
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-4" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-200 dark:bg-slate-700 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="flex items-center justify-between cursor-pointer mb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <BookOpen size={18} className="text-primary-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('scheduler.taskWorkbench.knowledgePointAssociation.title')}
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('scheduler.taskWorkbench.knowledgePointAssociation.count', { count: associations.length })}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
        >
          <Plus size={14} />
          {t('scheduler.taskWorkbench.knowledgePointAssociation.add')}
        </button>
      </div>

      {isExpanded && (
        <>
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
                  placeholder={t('scheduler.taskWorkbench.knowledgePointAssociation.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-500 rounded-lg">
                  {searchResults.map((kp) => (
                    <button
                      key={kp.id}
                      onClick={() => handleAddAssociation(kp.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-left transition-colors"
                    >
                      <BookOpen
                        size={16}
                        className="text-primary-500 flex-shrink-0"
                      />
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
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && !isSearching && searchResults.length === 0 && (
                <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {t('scheduler.taskWorkbench.knowledgePointAssociation.noMatch')}
                </p>
              )}

              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {associations.map((association) => (
              <div
                key={association.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  association.is_primary
                    ? "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-500"
                }`}
              >
                <BookOpen size={18} className="text-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {association.knowledge_point?.title || t('scheduler.taskWorkbench.knowledgePointAssociation.unknownKnowledgePoint')}
                    </p>
                    {association.is_primary && (
                      <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded">
                        {t('scheduler.taskWorkbench.knowledgePointAssociation.primary')}
                      </span>
                    )}
                  </div>
                  {association.knowledge_point?.content && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {association.knowledge_point.content}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {t('scheduler.taskWorkbench.knowledgePointAssociation.relevance')} {association.relevance_score}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!association.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(association.id)}
                      className="p-1.5 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors"
                      title={t('scheduler.taskKnowledge.setPrimary')}
                      aria-label={t('scheduler.taskKnowledge.setPrimary')}
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      handleViewInGraph(association.knowledge_point_id)
                    }
                    className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                    title={t('scheduler.taskKnowledge.viewInGraph')}
                    aria-label={t('scheduler.taskKnowledge.viewInGraph')}
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveAssociation(association.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title={t('scheduler.taskKnowledge.unlink')}
                    aria-label={t('scheduler.taskKnowledge.unlink')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {associations.length === 0 && !isAdding && (
              <EmptyState
                icon={<Link size={32} />}
                title={t('scheduler.empty.associationEmpty')}
                action={{ label: t('scheduler.taskWorkbench.knowledgePointAssociation.addAssociation'), onClick: () => setIsAdding(true) }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

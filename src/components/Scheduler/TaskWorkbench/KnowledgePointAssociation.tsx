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
} from "lucide-react";
import { api } from "../../../services/api";
import { TaskKnowledgePoint } from "../../../types";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";

interface KnowledgePointAssociationProps {
  taskId: string;
  className?: string;
}

export const KnowledgePointAssociation: React.FC<
  KnowledgePointAssociationProps
> = ({ taskId, className = "" }) => {
  const navigate = useNavigate();
  const [associations, setAssociations] = useState<TaskKnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadAssociations();
  }, [taskId]);

  const loadAssociations = async () => {
    try {
      const response = await api.scheduler.getTaskKnowledgePoints(taskId);
      if (response.success) {
        setAssociations(response.data || []);
      }
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
      const response = await fetch(
        `/api/knowledge-points?search=${encodeURIComponent(query)}&limit=10`,
      );
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data || []);
      }
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
      const response = await api.scheduler.addTaskKnowledgePoint(taskId, {
        knowledge_point_id: knowledgePointId,
        is_primary: associations.length === 0,
      });
      if (response.success) {
        setAssociations([...associations, response.data]);
        setIsAdding(false);
        setSearchQuery("");
        setSearchResults([]);
        frontendEventBus.publish("message_show", { type: "success", content: "知识点已关联" });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "关联知识点失败";
      frontendEventBus.publish("message_show", { type: "error", content: message });
    }
  };

  const handleRemoveAssociation = async (kpId: string) => {
    try {
      const response = await api.scheduler.removeTaskKnowledgePoint(
        taskId,
        kpId,
      );
      if (response.success) {
        setAssociations(associations.filter((a) => a.id !== kpId));
        frontendEventBus.publish("message_show", { type: "success", content: "已取消关联" });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "取消关联失败";
      frontendEventBus.publish("message_show", { type: "error", content: message });
    }
  };

  const handleSetPrimary = async (kpId: string) => {
    try {
      const response = await api.scheduler.updateTaskKnowledgePoint(
        taskId,
        kpId,
        { is_primary: true },
      );
      if (response.success) {
        setAssociations(
          associations.map((a) => ({
            ...a,
            is_primary: a.id === kpId,
          })),
        );
        frontendEventBus.publish("message_show", { type: "success", content: "已设为主要知识点" });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "设置失败";
      frontendEventBus.publish("message_show", { type: "error", content: message });
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
            关联知识点
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {associations.length} 个
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
          添加
        </button>
      </div>

      {isExpanded && (
        <>
          {isAdding && (
            <div className="mb-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索知识点..."
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
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
                  未找到匹配的知识点
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
                  取消
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
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <BookOpen size={18} className="text-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {association.knowledge_point?.title || "未知知识点"}
                    </p>
                    {association.is_primary && (
                      <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded">
                        主要
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
                      关联度: {association.relevance_score}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!association.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(association.id)}
                      className="p-1.5 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded-lg transition-colors"
                      title="设为主要"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      handleViewInGraph(association.knowledge_point_id)
                    }
                    className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                    title="在图谱中查看"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveAssociation(association.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="取消关联"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {associations.length === 0 && !isAdding && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                <p>暂无关联的知识点</p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="mt-2 text-sm text-primary-500 hover:text-primary-600"
                >
                  添加知识点关联
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

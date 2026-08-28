import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, Sparkles, CheckCircle2, Network } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Node } from "../../../types";
import { useNodeRelationDiscovery } from "../../../hooks/graphEditor";
import { getRelationshipTypeDisplayName } from "../../../config/relationshipTypes";

interface ConnectionSuggestionsPanelProps {
  graphId: string;
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
  /** 从任务中心/完成通知跳回时携带的任务 ID，用于恢复建议列表 */
  initialTaskId?: string | null;
}

/**
 * 连接建议面板：AI 关系发现。
 * 从原图谱分析面板中独立出来，仅保留「连接建议」能力。
 */
export const ConnectionSuggestionsPanel = React.memo(
  function ConnectionSuggestionsPanel({
    graphId,
    isOpen,
    onClose,
    nodes,
    onNodeClick,
    initialTaskId,
  }: ConnectionSuggestionsPanelProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const {
      suggestions: relationSuggestions,
      isDiscovering,
      isApplying,
      appliedPairKeys,
      taskId,
      discover: discoverNodeRelations,
      applyAll: applyNodeRelations,
    } = useNodeRelationDiscovery({ graphId, initialTaskId });

    const nodeById = useMemo(
      () => new Map(nodes.map((n) => [n.id, n])),
      [nodes],
    );

    const pendingSuggestions = useMemo(
      () =>
        relationSuggestions.filter(
          (s) => !appliedPairKeys.has(`${s.source_id}-${s.target_id}`),
        ),
      [relationSuggestions, appliedPairKeys],
    );

    if (!isOpen) return null;

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500">
                <div className="flex items-center gap-2">
                  <Network className="text-primary-500" size={20} />
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    {t("graphEditor.connectionSuggestions.title")}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label={t("common.aria.close")}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* AI Relation Discovery */}
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-500">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="text-primary-500" size={18} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {t(
                        "graphEditor.connectionSuggestions.nodeRelationDiscovery.title",
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {t(
                      "graphEditor.connectionSuggestions.nodeRelationDiscovery.description",
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    {t(
                      "graphEditor.connectionSuggestions.nodeRelationDiscovery.hierarchicalHint",
                    )}
                  </p>

                  <button
                    onClick={() => discoverNodeRelations()}
                    disabled={isDiscovering || isApplying}
                    className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDiscovering
                      ? t(
                          "graphEditor.connectionSuggestions.nodeRelationDiscovery.discovering",
                        )
                      : t(
                          "graphEditor.connectionSuggestions.nodeRelationDiscovery.discover",
                        )}
                  </button>

                  {isDiscovering && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-slate-500 dark:text-slate-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                      <span>
                        {t(
                          "graphEditor.connectionSuggestions.nodeRelationDiscovery.discovering",
                        )}
                      </span>
                    </div>
                  )}

                  {taskId && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {t(
                          "graphEditor.connectionSuggestions.nodeRelationDiscovery.submittedHint",
                        )}
                      </span>
                      <button
                        onClick={() => navigate("/tasks")}
                        className="text-primary-600 dark:text-primary-400 underline hover:opacity-80 transition-opacity"
                      >
                        {t("graphMap.cards.viewTasks")}
                      </button>
                    </div>
                  )}

                  {!isDiscovering &&
                    pendingSuggestions.length === 0 &&
                    relationSuggestions.length === 0 && (
                      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        {t(
                          "graphEditor.connectionSuggestions.nodeRelationDiscovery.empty",
                        )}
                      </div>
                    )}

                  {pendingSuggestions.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mt-3 mb-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {t(
                            "graphEditor.connectionSuggestions.nodeRelationDiscovery.count",
                            { count: pendingSuggestions.length },
                          )}
                        </span>
                        <button
                          onClick={() => applyNodeRelations(pendingSuggestions)}
                          disabled={isApplying}
                          className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isApplying
                            ? t(
                                "graphEditor.connectionSuggestions.nodeRelationDiscovery.applying",
                              )
                            : t(
                                "graphEditor.connectionSuggestions.nodeRelationDiscovery.applyAll",
                              )}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {pendingSuggestions.map((suggestion, idx) => (
                          <div
                            key={`${suggestion.source_id}-${suggestion.target_id}-${idx}`}
                            className="p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-500"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  onClick={() =>
                                    onNodeClick?.(suggestion.source_id)
                                  }
                                  className="text-sm font-medium text-primary-600 dark:text-primary-400 underline truncate"
                                >
                                  {nodeById.get(suggestion.source_id)?.title ||
                                    suggestion.source_title}
                                </button>
                                <span className="text-slate-400 shrink-0">
                                  →
                                </span>
                                <button
                                  onClick={() =>
                                    onNodeClick?.(suggestion.target_id)
                                  }
                                  className="text-sm font-medium text-primary-600 dark:text-primary-400 underline truncate"
                                >
                                  {nodeById.get(suggestion.target_id)?.title ||
                                    suggestion.target_title}
                                </button>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {t(
                                    (getRelationshipTypeDisplayName(
                                      suggestion.relationship_type,
                                    ) ||
                                      suggestion.relationship_type) as never,
                                  )}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {t(
                                    "graphEditor.connectionSuggestions.nodeRelationDiscovery.confidence",
                                  )}
                                  :{" "}
                                  {Math.round(suggestion.confidence * 100)}%
                                </span>
                                <button
                                  onClick={() =>
                                    applyNodeRelations([suggestion])
                                  }
                                  disabled={isApplying}
                                  className="px-2.5 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {t(
                                    "graphEditor.connectionSuggestions.nodeRelationDiscovery.apply",
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {suggestion.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {!isDiscovering &&
                    relationSuggestions.length > 0 &&
                    pendingSuggestions.length === 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 size={16} />
                        <span>
                          {t(
                            "graphEditor.connectionSuggestions.nodeRelationDiscovery.applied",
                          )}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

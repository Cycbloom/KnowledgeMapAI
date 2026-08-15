import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  BarChart3,
  ListTodo,
  CheckSquare,
  Square,
  X,
  Loader2,
} from "lucide-react";
import { NodeStatus } from "../../services/api/learningPaths";
import { useTranslation } from "react-i18next";
import { STATUS_CONFIG, type LearningPathDetail, type LearningPathNode } from "./types";
import { EmptyState } from "../common/EmptyState";

interface PathNodeListSectionProps {
  pathDetail: LearningPathDetail;
  expandedSections: Set<string>;
  selectedNode: string | null;
  isSelectionMode: boolean;
  selectedNodeIds: Set<string>;
  isUpdating: boolean;
  isBatchConverting: boolean;
  onToggleSection: (section: string) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onSetIsSelectionMode: (value: boolean) => void;
  onToggleNodeSelection: (nodeId: string) => void;
  onToggleSelectAll: () => void;
  onExitSelectionMode: () => void;
  onBatchConvertToTasks: () => void;
  onUpdateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  onConvertToTask: (node: LearningPathNode) => void;
}

const PathNodeListSection: React.FC<PathNodeListSectionProps> = ({
  pathDetail,
  expandedSections,
  selectedNode,
  isSelectionMode,
  selectedNodeIds,
  isUpdating,
  isBatchConverting,
  onToggleSection,
  onSelectedNodeChange,
  onSetIsSelectionMode,
  onToggleNodeSelection,
  onToggleSelectAll,
  onExitSelectionMode,
  onBatchConvertToTasks,
  onUpdateNodeStatus,
  onConvertToTask,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 预计算待处理且未关联任务的节点数，避免渲染中重复 filter 扫描
  const pendingUnlinkedCount = React.useMemo(
    () =>
      pathDetail.nodes.filter(
        (n) => n.status === "pending" && !n.related_task_id,
      ).length,
    [pathDetail.nodes],
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => onToggleSection("nodes")}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary-500" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {t('learningPath.pathNodeList.title')}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({pathDetail.nodes.length})
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("nodes") ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expandedSections.has("nodes") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {pathDetail.nodes.length > 0 && (
              <div className="px-6 py-3 border-b dark:border-slate-500 flex items-center justify-between bg-gray-50 dark:bg-slate-700/30">
                <div className="flex items-center gap-3">
                  {isSelectionMode ? (
                    <>
                      <button
                        onClick={onToggleSelectAll}
                        className="text-sm text-primary-600 dark:text-primary-400 underline"
                      >
                        {selectedNodeIds.size === pendingUnlinkedCount
                          ? t('learningPath.pathNodeList.deselectAll')
                          : t('learningPath.pathNodeList.selectAllPending')}
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t('learningPath.pathNodeList.selectedCount', { count: selectedNodeIds.size })}
                      </span>
                    </>
                  ) : (
                    <button
                      onClick={() => onSetIsSelectionMode(true)}
                      className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                    >
                      <CheckSquare className="w-4 h-4" />
                      {t('learningPath.pathNodeList.batchSelect')}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isSelectionMode && (
                    <>
                      <button
                        onClick={onBatchConvertToTasks}
                        disabled={selectedNodeIds.size === 0 || isBatchConverting}
                        className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isBatchConverting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('learningPath.pathNodeList.converting')}
                          </>
                        ) : (
                          <>
                            <ListTodo className="w-4 h-4" />
                            {t('learningPath.pathNodeList.convertToTasks', { count: selectedNodeIds.size })}
                          </>
                        )}
                      </button>
                      <button
                        onClick={onExitSelectionMode}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="px-6 pb-4 space-y-2 max-h-[600px] overflow-y-auto">
              {pathDetail.nodes.length === 0 ? (
                <EmptyState
                  icon={<BookOpen size={32} />}
                  title={t('learning.empty')}
                  description={t('learningPath.pathNodeList.emptyDescription')}
                  action={{ label: t('learningPath.pathNodeList.generateFromGraph'), onClick: () => navigate("/graphs") }}
                />
              ) : (
                pathDetail.nodes.map((node, index) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`border dark:border-slate-500 rounded-lg overflow-hidden ${
                      selectedNode === node.id
                        ? "ring-2 ring-primary-500"
                        : ""
                    } ${selectedNodeIds.has(node.id) ? "ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20" : ""}`}
                  >
                    <div
                      onClick={() => {
                        if (isSelectionMode) {
                          if (node.status === "pending" && !node.related_task_id) {
                            onToggleNodeSelection(node.id);
                          }
                        } else {
                          onSelectedNodeChange(
                            selectedNode === node.id ? null : node.id,
                          );
                        }
                      }}
                      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 ${STATUS_CONFIG[node.status].bgColor}`}
                    >
                      <div className="flex items-center gap-3">
                        {isSelectionMode && (
                          <div className="flex-shrink-0">
                            {node.status === "pending" && !node.related_task_id ? (
                              selectedNodeIds.has(node.id) ? (
                                <CheckSquare className="w-5 h-5 text-primary-500" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )
                            ) : (
                              <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                            )}
                          </div>
                        )}
                        <div
                          className={`flex-shrink-0 ${STATUS_CONFIG[node.status].color}`}
                        >
                          {STATUS_CONFIG[node.status].icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-6">
                              #{node.order}
                            </span>
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              {node.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {node.estimated_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t('learningPath.pathNodeList.estimatedMinutes', { count: node.estimated_minutes })}
                              </span>
                            )}
                            {node.difficulty_level && (
                              <span className="flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" />
                                {t('learningPath.pathNodeList.difficulty', { level: node.difficulty_level })}
                              </span>
                            )}
                            {node.related_task && (
                              <span className="flex items-center gap-1 text-primary-500">
                                <ListTodo className="w-3 h-3" />
                                {t('learningPath.pathNodeList.relatedTask')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[node.status].bgColor} ${STATUS_CONFIG[node.status].color}`}
                          >
                            {t(STATUS_CONFIG[node.status].labelKey)}
                          </span>
                          {!isSelectionMode && (
                            <ChevronRight
                              className={`w-4 h-4 text-gray-400 transition-transform ${selectedNode === node.id ? "rotate-90" : ""}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedNode === node.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t dark:border-slate-500 bg-gray-50 dark:bg-slate-700/30"
                        >
                          <div className="p-4 space-y-4">
                            {node.content && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  {t('learningPath.pathNodeList.contentLabel')}
                                </h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {node.content}
                                </p>
                              </div>
                            )}

                            {node.prerequisites &&
                              node.prerequisites.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                    {t('learningPath.pathNodeList.prerequisites')}
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {node.prerequisites.map(
                                      (pre, i) => (
                                        <span
                                          key={i}
                                          className="px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded text-xs text-gray-600 dark:text-gray-300"
                                        >
                                          {pre}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                            <div>
                              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                {t('learningPath.pathNodeList.updateStatus')}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  Object.keys(
                                    STATUS_CONFIG,
                                  ) as NodeStatus[]
                                ).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() =>
                                      onUpdateNodeStatus(
                                        node.id,
                                        status,
                                      )
                                    }
                                    disabled={
                                      isUpdating ||
                                      node.status === status
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                                      node.status === status
                                        ? `${STATUS_CONFIG[status].bgColor} ${STATUS_CONFIG[status].color} ring-2 ring-offset-1`
                                        : "bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-500"
                                    } disabled:opacity-50`}
                                  >
                                    {STATUS_CONFIG[status].icon}
                                    {t(STATUS_CONFIG[status].labelKey)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t dark:border-slate-500">
                              <button
                                onClick={() =>
                                  onConvertToTask(node)
                                }
                                className="flex-1 px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center justify-center gap-2"
                              >
                                <ListTodo className="w-4 h-4" />
                                {t('learningPath.pathNodeList.convertToTask')}
                              </button>
                              {node.related_task && (
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/tasks/${node.related_task?.id}`,
                                    )
                                  }
                                  className="px-3 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-500 flex items-center gap-2"
                                >
                                  {t('learningPath.pathNodeList.viewTask')}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PathNodeListSection;

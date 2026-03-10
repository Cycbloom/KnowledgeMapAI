import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Route,
  CheckCircle2,
  Circle,
  Play,
  SkipForward,
  Clock,
  BarChart3,
  ChevronRight,
  Loader2,
  Target,
} from "lucide-react";
import { useLearningPath } from "../../hooks/queries/useLearningPathQueries";
import { NodeStatus } from "../../services/api/learningPaths";

interface LearningPathOutlineProps {
  learningPathId: string;
  currentNodeId?: string;
  onNodeClick: (nodeId: string) => void;
  onBackToGraph?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<
  NodeStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  pending: {
    label: "待学习",
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-700",
    icon: <Circle className="w-4 h-4" />,
  },
  in_progress: {
    label: "学习中",
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: <Play className="w-4 h-4" />,
  },
  completed: {
    label: "已完成",
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  skipped: {
    label: "已跳过",
    color: "text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: <SkipForward className="w-4 h-4" />,
  },
};

export const LearningPathOutline: React.FC<LearningPathOutlineProps> = ({
  learningPathId,
  currentNodeId,
  onNodeClick,
  onBackToGraph,
  className = "",
}) => {
  const { data: pathDetail, isLoading } = useLearningPath(learningPathId);
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
  const currentNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentNodeRef.current) {
      currentNodeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentNodeId]);

  if (isLoading) {
    return (
      <div
        className={`flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${className}`}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  if (!pathDetail) {
    return (
      <div
        className={`flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${className}`}
      >
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Route className="w-12 h-12 mb-4 text-gray-300" />
          <p className="text-sm">学习路径不存在</p>
        </div>
      </div>
    );
  }

  const nodes = pathDetail.nodes || [];
  const progress = pathDetail.progress || {
    completed_nodes: 0,
    total_nodes: nodes.length,
    progress_percentage: 0,
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return "未知";
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${className}`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        {onBackToGraph && (
          <button
            onClick={onBackToGraph}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回图谱大纲
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {pathDetail.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {progress.completed_nodes} / {progress.total_nodes} 节点已完成
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              学习进度
            </span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {(progress.progress_percentage || 0).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress.progress_percentage || 0}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            />
          </div>
        </div>

        {pathDetail.target_completion_date && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Target className="w-3 h-3" />
            <span>
              目标完成日期：
              {new Date(pathDetail.target_completion_date).toLocaleDateString(
                "zh-CN",
              )}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 scroll-smooth">
        <div className="space-y-1 px-2">
          {nodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              暂无学习节点
            </div>
          ) : (
            nodes.map((node: any, index: number) => {
              const status: NodeStatus = node.status || "pending";
              const statusConfig = STATUS_CONFIG[status];
              const isCurrentNode =
                node.knowledge_point_id === currentNodeId ||
                node.id === currentNodeId;
              const estimatedTime =
                node.estimated_time || node.estimated_minutes;
              const nodeUniqueId = node.knowledge_point_id || node.id;
              const isClicked = clickedNodeId === nodeUniqueId;

              return (
                <motion.div
                  key={node.id}
                  ref={isCurrentNode ? currentNodeRef : null}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, scale: isClicked ? 0.98 : 1 }}
                  transition={{
                    delay: index * 0.02,
                    scale: { duration: 0.15 },
                  }}
                  onClick={() => {
                    const nodeId = node.knowledge_point_id || node.id;
                    if (nodeId) {
                      setClickedNodeId(nodeId);
                      setTimeout(() => setClickedNodeId(null), 150);
                      onNodeClick(nodeId);
                    }
                  }}
                  className={`
                    relative flex items-start gap-3 p-3 rounded-lg cursor-pointer
                    transition-all duration-200 group
                    ${
                      isCurrentNode
                        ? "bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 ring-2 ring-indigo-500 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30"
                        : isClicked
                          ? "bg-indigo-100 dark:bg-indigo-900/30 scale-[0.98]"
                          : status === "completed"
                            ? "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20"
                            : "hover:bg-gray-50 dark:hover:bg-slate-800"
                    }
                  `}
                >
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div
                      className={`
                        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold relative
                        ${
                          status === "completed"
                            ? "bg-green-500 text-white"
                            : status === "in_progress"
                              ? "bg-blue-500 text-white"
                              : isCurrentNode
                                ? "bg-indigo-500 text-white"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }
                      `}
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                      {isCurrentNode && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
                          <span className="absolute inset-0 rounded-full bg-indigo-500 animate-pulse opacity-50" />
                        </>
                      )}
                    </div>
                    {index < nodes.length - 1 && (
                      <div
                        className={`
                          w-0.5 h-6 mt-1
                          ${
                            nodes[index + 1]?.status === "completed" ||
                            status === "completed"
                              ? "bg-green-300 dark:bg-green-700"
                              : "bg-gray-200 dark:bg-gray-700"
                          }
                        `}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {node.title}
                      </span>
                      {isCurrentNode && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-500 text-white rounded">
                          当前
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {estimatedTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(estimatedTime)}
                        </span>
                      )}
                      {node.difficulty_level && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          难度 {node.difficulty_level}/5
                        </span>
                      )}
                    </div>

                    {node.description && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 line-clamp-2">
                        {node.description}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span
                      className={`
                        px-2 py-0.5 rounded text-xs font-medium
                        ${statusConfig.bgColor} ${statusConfig.color}
                      `}
                    >
                      {statusConfig.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="text-lg font-bold text-green-500">
              {nodes.filter((n: any) => n.status === "completed").length}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              已完成
            </div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="text-lg font-bold text-blue-500">
              {nodes.filter((n: any) => n.status === "in_progress").length}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              学习中
            </div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="text-lg font-bold text-gray-500">
              {
                nodes.filter((n: any) => n.status === "pending" || !n.status)
                  .length
              }
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              待学习
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningPathOutline;

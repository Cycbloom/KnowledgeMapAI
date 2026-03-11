import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Route,
  Clock,
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Calendar,
  BookOpen,
  RefreshCw,
  Sparkles,
  Play,
  Pause,
  Archive,
  Trash2,
  CalendarClock,
  ListTodo,
  Flag,
  Trophy,
  BarChart3,
  ArrowLeft,
  MoreVertical,
  SkipForward,
  Loader2,
} from "lucide-react";
import { api } from "../services/api";
import { learningPathsApi, NodeStatus } from "../services/api/learningPaths";
import { useMessageStore } from "../store/useMessageStore";
import { useErrorHandler } from "../hooks/useErrorHandler";

interface LearningPathNode {
  id: string;
  node_id: string;
  title: string;
  content?: string;
  order: number;
  estimated_minutes?: number;
  difficulty_level?: number;
  status: NodeStatus;
  prerequisites?: string[];
  mastery_level?: number;
  started_at?: string;
  completed_at?: string;
  time_spent?: number;
  notes?: string;
  related_task_id?: string;
  related_task?: {
    id: string;
    title: string;
    status: string;
    scheduled_start?: string;
    scheduled_end?: string;
  };
}

interface LearningPathMilestone {
  id: string;
  title: string;
  description?: string;
  target_date?: string;
  completed_at?: string;
  node_ids: string[];
  progress: number;
  is_completed: boolean;
}

interface LearningPathPlan {
  id: string;
  date: string;
  planned_nodes: string[];
  actual_nodes?: string[];
  estimated_minutes?: number;
  actual_minutes?: number;
  completed: boolean;
  notes?: string;
}

interface LearningPathSuggestion {
  type: "review" | "practice" | "extend" | "prerequisite";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  node_id?: string;
}

interface LearningPathDetail {
  id: string;
  title: string;
  description?: string;
  graph_id?: string;
  graph_title?: string;
  status: "active" | "completed" | "paused" | "archived";
  goal_type: "natural_language" | "graph_node" | "template";
  goal_content?: string;
  target_knowledge_point_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
  created_at: string;
  updated_at: string;
  nodes: LearningPathNode[];
  milestones: LearningPathMilestone[];
  plans: LearningPathPlan[];
  suggestions: LearningPathSuggestion[];
  progress: {
    completed_nodes: number;
    total_nodes: number;
    total_time_spent: number;
    estimated_total_time: number;
    completion_percentage: number;
    current_streak: number;
    longest_streak: number;
    last_activity_at?: string;
  };
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

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  review: <RefreshCw className="w-4 h-4" />,
  practice: <Target className="w-4 h-4" />,
  extend: <TrendingUp className="w-4 h-4" />,
  prerequisite: <BookOpen className="w-4 h-4" />,
};

const LearningPathDetailPage: React.FC = () => {
  const { id: pathId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pathDetail, setPathDetail] = useState<LearningPathDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["nodes", "progress", "plans"]),
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const fetchPathDetail = async () => {
    if (!pathId) return;

    setIsLoading(true);
    try {
      const result = await learningPathsApi.get(pathId);
      if (result) {
        const mappedNodes = (result.nodes || []).map((node: any) => ({
          id: node.id,
          node_id: node.knowledge_point_id || node.id,
          title: node.title,
          content: node.description,
          order: node.order_index ?? 0,
          estimated_minutes: node.estimated_time,
          difficulty_level: 1,
          status: node.status || "pending",
          prerequisites: node.prerequisites || [],
          mastery_level: 0,
          started_at: node.started_at,
          completed_at: node.completed_at,
          time_spent: 0,
          notes: "",
          related_task_id: undefined,
          related_task: undefined,
        }));

        const progress = result.progress || {
          total_nodes: 0,
          completed_nodes: 0,
          in_progress_nodes: 0,
          pending_nodes: 0,
          skipped_nodes: 0,
          total_time_spent: 0,
          progress_percentage: 0,
        };

        setPathDetail({
          id: result.id,
          title: result.title,
          description: result.description,
          graph_id: result.source_graph_id,
          graph_title: undefined,
          status: result.status || "active",
          goal_type: "natural_language",
          goal_content: result.goal,
          target_knowledge_point_id: undefined,
          daily_minutes_target: result.daily_minutes_target,
          target_completion_date: result.target_date,
          created_at: result.created_at,
          updated_at: result.updated_at,
          nodes: mappedNodes,
          milestones: [],
          plans: [],
          suggestions: [],
          progress: {
            completed_nodes: progress.completed_nodes || 0,
            total_nodes: progress.total_nodes || 0,
            total_time_spent: progress.total_time_spent || 0,
            estimated_total_time: result.total_estimated_time || 0,
            completion_percentage: progress.progress_percentage || 0,
            current_streak: 0,
            longest_streak: 0,
          },
        });
      } else {
        setPathDetail(null);
      }
    } catch (error) {
      handleError(error, {
        context: "LearningPathDetail",
        fallbackMessage: "获取学习路径详情失败",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPathDetail();
  }, [pathId]);

  const handleUpdateNodeStatus = async (nodeId: string, status: NodeStatus) => {
    if (!pathId) return;

    setIsUpdating(true);
    try {
      await learningPathsApi.updateNodeStatus(pathId, nodeId, status);
      await fetchPathDetail();
      addMessage({ type: "success", content: "节点状态已更新" });
    } catch (error) {
      handleError(error, {
        context: "UpdateNodeStatus",
        fallbackMessage: "更新节点状态失败",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConvertToTask = async (node: LearningPathNode) => {
    try {
      const taskData = {
        title: node.title,
        description: node.content,
        estimated_duration: node.estimated_minutes,
        knowledge_point_id: node.node_id,
        tags: ["学习路径", pathDetail?.title || ""],
        priority: node.difficulty_level || 2,
      };

      const task = await api.scheduler.createTask(taskData);
      addMessage({ type: "success", content: `已创建任务：${task.title}` });
      await fetchPathDetail();
    } catch (error) {
      handleError(error, {
        context: "ConvertToTask",
        fallbackMessage: "创建任务失败",
      });
    }
  };

  const handleAutoSchedule = async () => {
    if (!pathId || !pathDetail) return;

    setIsUpdating(true);
    try {
      const result = await learningPathsApi.autoSchedule(pathId, {
        start_date: new Date().toISOString(),
        daily_minutes: pathDetail.daily_minutes_target || 30,
      });

      addMessage({
        type: "success",
        content: `已创建主任务，包含 ${result.total_tasks} 个学习节点，预计 ${result.estimated_days} 天完成`,
      });

      await fetchPathDetail();
    } catch (error) {
      handleError(error, {
        context: "AutoSchedule",
        fallbackMessage: "自动排程失败",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePathStatus = async (
    status: "active" | "paused" | "archived",
  ) => {
    if (!pathId) return;

    setIsUpdating(true);
    try {
      await learningPathsApi.update(pathId, { status });
      await fetchPathDetail();
      addMessage({ type: "success", content: "学习路径状态已更新" });
    } catch (error) {
      handleError(error, {
        context: "UpdatePathStatus",
        fallbackMessage: "更新状态失败",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePath = async () => {
    if (!pathId || !window.confirm("确定要删除此学习路径吗？此操作不可恢复。"))
      return;

    try {
      await learningPathsApi.delete(pathId);
      addMessage({ type: "success", content: "学习路径已删除" });
      navigate(-1);
    } catch (error) {
      handleError(error, {
        context: "DeletePath",
        fallbackMessage: "删除学习路径失败",
      });
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const progressPercentage = useMemo(() => {
    if (!pathDetail || !pathDetail.progress) return 0;
    return pathDetail.progress.completion_percentage || 0;
  }, [pathDetail]);

  const nodesByStatus = useMemo(() => {
    if (!pathDetail || !pathDetail.nodes)
      return {} as Record<NodeStatus, number>;
    return pathDetail.nodes.reduce(
      (acc, node) => {
        acc[node.status] = (acc[node.status] || 0) + 1;
        return acc;
      },
      {} as Record<NodeStatus, number>,
    );
  }, [pathDetail]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">加载学习路径...</p>
        </div>
      </div>
    );
  }

  if (!pathDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Route className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            学习路径不存在
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            该学习路径可能已被删除或您没有访问权限
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                  <Route className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {pathDetail.title}
                  </h1>
                  {pathDetail.description && (
                    <p className="text-gray-500 dark:text-gray-400 mb-2">
                      {pathDetail.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {pathDetail.graph_title && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {pathDetail.graph_title}
                      </span>
                    )}
                    {pathDetail.target_completion_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        目标：{formatDate(pathDetail.target_completion_date)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        pathDetail.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : pathDetail.status === "paused"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : pathDetail.status === "completed"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {pathDetail.status === "active"
                        ? "进行中"
                        : pathDetail.status === "paused"
                          ? "已暂停"
                          : pathDetail.status === "completed"
                            ? "已完成"
                            : "已归档"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowActions(showActions === "main" ? null : "main")
                    }
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {showActions === "main" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-lg border dark:border-slate-600 py-1 z-10"
                      >
                        {pathDetail.graph_id && (
                          <button
                            onClick={() => {
                              setShowActions(null);
                              navigate(`/graphs/${pathDetail.graph_id}`);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                          >
                            <BookOpen className="w-4 h-4" />
                            查看知识图谱
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowActions(null);
                            handleAutoSchedule();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                        >
                          <CalendarClock className="w-4 h-4" />
                          自动排程
                        </button>
                        <button
                          onClick={() => {
                            setShowActions(null);
                            handleUpdatePathStatus(
                              pathDetail.status === "active"
                                ? "paused"
                                : "active",
                            );
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                        >
                          {pathDetail.status === "active" ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          {pathDetail.status === "active"
                            ? "暂停学习"
                            : "继续学习"}
                        </button>
                        <button
                          onClick={() => {
                            setShowActions(null);
                            handleUpdatePathStatus("archived");
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                        >
                          <Archive className="w-4 h-4" />
                          归档
                        </button>
                        <hr className="my-1 dark:border-slate-600" />
                        <button
                          onClick={() => {
                            setShowActions(null);
                            handleDeletePath();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  学习进度
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {pathDetail.progress.completed_nodes} /{" "}
                  {pathDetail.progress.total_nodes} 节点
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  预计时间：
                  {formatTime(pathDetail.progress.estimated_total_time)}
                </span>
                <span>
                  已学习：
                  {formatTime(
                    Math.round(pathDetail.progress.total_time_spent / 60),
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("nodes")}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <span className="font-semibold text-gray-900 dark:text-white">
                    学习节点
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
                    <div className="px-6 pb-4 space-y-2 max-h-[600px] overflow-y-auto">
                      {pathDetail.nodes.length === 0 ? (
                        <div className="text-center py-12">
                          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                            暂无学习节点
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 mb-4">
                            您可以添加学习节点，或从知识图谱生成学习路径
                          </p>
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => navigate("/graphs")}
                              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2"
                            >
                              <Sparkles className="w-4 h-4" />
                              从图谱生成
                            </button>
                          </div>
                        </div>
                      ) : (
                        pathDetail.nodes.map((node, index) => (
                          <motion.div
                            key={node.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={`border dark:border-slate-700 rounded-lg overflow-hidden ${
                              selectedNode === node.id
                                ? "ring-2 ring-indigo-500"
                                : ""
                            }`}
                          >
                            <div
                              onClick={() =>
                                setSelectedNode(
                                  selectedNode === node.id ? null : node.id,
                                )
                              }
                              className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 ${STATUS_CONFIG[node.status].bgColor}`}
                            >
                              <div className="flex items-center gap-3">
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
                                        {node.estimated_minutes}分钟
                                      </span>
                                    )}
                                    {node.difficulty_level && (
                                      <span className="flex items-center gap-1">
                                        <BarChart3 className="w-3 h-3" />
                                        难度 {node.difficulty_level}/5
                                      </span>
                                    )}
                                    {node.related_task && (
                                      <span className="flex items-center gap-1 text-blue-500">
                                        <ListTodo className="w-3 h-3" />
                                        已关联任务
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[node.status].bgColor} ${STATUS_CONFIG[node.status].color}`}
                                  >
                                    {STATUS_CONFIG[node.status].label}
                                  </span>
                                  <ChevronRight
                                    className={`w-4 h-4 text-gray-400 transition-transform ${selectedNode === node.id ? "rotate-90" : ""}`}
                                  />
                                </div>
                              </div>
                            </div>

                            <AnimatePresence>
                              {selectedNode === node.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30"
                                >
                                  <div className="p-4 space-y-4">
                                    {node.content && (
                                      <div>
                                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          内容
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
                                            前置知识
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
                                        更新状态
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
                                              handleUpdateNodeStatus(
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
                                            {STATUS_CONFIG[status].label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t dark:border-slate-600">
                                      <button
                                        onClick={() =>
                                          handleConvertToTask(node)
                                        }
                                        className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 flex items-center justify-center gap-2"
                                      >
                                        <ListTodo className="w-4 h-4" />
                                        转为任务
                                      </button>
                                      {node.related_task && (
                                        <button
                                          onClick={() =>
                                            navigate(
                                              `/tasks/${node.related_task!.id}`,
                                            )
                                          }
                                          className="px-3 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-500 flex items-center gap-2"
                                        >
                                          查看任务
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

            {pathDetail.milestones.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("milestones")}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <Flag className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      里程碑
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      (
                      {
                        pathDetail.milestones.filter((m) => m.is_completed)
                          .length
                      }
                      /{pathDetail.milestones.length})
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("milestones") ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {expandedSections.has("milestones") && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-3">
                        {pathDetail.milestones.map((milestone) => (
                          <div
                            key={milestone.id}
                            className={`p-4 rounded-lg border dark:border-slate-700 ${
                              milestone.is_completed
                                ? "bg-green-50 dark:bg-green-900/20"
                                : "bg-gray-50 dark:bg-slate-700/30"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 ${milestone.is_completed ? "text-green-500" : "text-gray-400"}`}
                                >
                                  {milestone.is_completed ? (
                                    <Trophy className="w-5 h-5" />
                                  ) : (
                                    <Flag className="w-5 h-5" />
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {milestone.title}
                                  </h3>
                                  {milestone.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {milestone.description}
                                    </p>
                                  )}
                                  {milestone.target_date && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                      目标日期：
                                      {formatDate(milestone.target_date)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-sm font-medium ${milestone.is_completed ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}
                              >
                                {milestone.progress}%
                              </span>
                            </div>
                            <div className="mt-3">
                              <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${milestone.is_completed ? "bg-green-500" : "bg-indigo-500"}`}
                                  style={{ width: `${milestone.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                进度概览
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-indigo-500">
                      {pathDetail.progress.total_nodes}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      总节点
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {pathDetail.progress.completed_nodes}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      已完成
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {nodesByStatus.in_progress || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      学习中
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-500">
                      {nodesByStatus.pending || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      待学习
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      连续学习
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {pathDetail.progress.current_streak} 天
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      最长连续
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {pathDetail.progress.longest_streak} 天
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {pathDetail.plans.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("plans")}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      学习计划
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("plans") ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {expandedSections.has("plans") && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-2 max-h-80 overflow-y-auto">
                        {pathDetail.plans.map((plan) => (
                          <div
                            key={plan.id}
                            className={`p-3 rounded-lg border dark:border-slate-700 ${
                              plan.completed
                                ? "bg-green-50 dark:bg-green-900/20"
                                : "bg-gray-50 dark:bg-slate-700/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatDate(plan.date)}
                              </span>
                              {plan.completed && (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              计划 {plan.planned_nodes.length} 个节点
                              {plan.estimated_minutes &&
                                ` · ${plan.estimated_minutes}分钟`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {pathDetail.suggestions.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("suggestions")}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      学习建议
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("suggestions") ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {expandedSections.has("suggestions") && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-2">
                        {pathDetail.suggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border dark:border-slate-700 ${
                              suggestion.priority === "high"
                                ? "bg-red-50 dark:bg-red-900/20"
                                : suggestion.priority === "medium"
                                  ? "bg-yellow-50 dark:bg-yellow-900/20"
                                  : "bg-gray-50 dark:bg-slate-700/30"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`mt-0.5 ${
                                  suggestion.priority === "high"
                                    ? "text-red-500"
                                    : suggestion.priority === "medium"
                                      ? "text-yellow-500"
                                      : "text-gray-400"
                                }`}
                              >
                                {SUGGESTION_ICONS[suggestion.type] || (
                                  <AlertCircle className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                  {suggestion.title}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {suggestion.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {pathDetail.graph_id && (
                <button
                  onClick={() => navigate(`/graphs/${pathDetail.graph_id}`)}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  查看图谱
                </button>
              )}
              <button
                onClick={handleAutoSchedule}
                disabled={isUpdating}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2 disabled:opacity-50"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarClock className="w-4 h-4" />
                )}
                自动排程
              </button>
            </div>

            <div className="flex items-center gap-2">
              {pathDetail.status === "active" && (
                <button
                  onClick={() => handleUpdatePathStatus("paused")}
                  className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  暂停
                </button>
              )}
              {pathDetail.status === "paused" && (
                <button
                  onClick={() => handleUpdatePathStatus("active")}
                  className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  继续
                </button>
              )}
              <button
                onClick={handleDeletePath}
                className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningPathDetailPage;

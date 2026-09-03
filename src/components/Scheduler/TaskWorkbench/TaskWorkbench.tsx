import React, { useState, useEffect, useCallback, useId, useRef, useMemo, lazy, Suspense, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  Clock,
  Calendar,
  Tag,
  AlertTriangle,
  Timer,
  BarChart3,
  FileText,
  Bookmark,
  LayoutDashboard,
  Flame,
  CalendarClock,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../services/api";
import { queryKeys } from "../../../hooks/queries/config";
import { useGraphData, useGraph } from "../../../hooks/queries";
import { useTaskSettledInvalidator } from "../../../hooks/scheduler/useTaskSettledInvalidator";
import { UserTaskDetail } from "../../../types";
import { formatDurationMinutes, formatDate as formatDateUtil } from "../../../utils/formatters";
import { message as messageHelper } from "../../../utils/messageHelper";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { SubtaskList } from "./SubtaskList";
import { TaskLinks } from "./TaskLinks";
import { ExecutionRecords } from "./ExecutionRecords";
import { ProgressDetail } from "./ProgressDetail";
import { NotesTab } from "./NotesTab";
import { OverviewTab } from "./OverviewTab";
import { SaveAsTemplateModal } from "../SaveAsTemplateModal";
import { Skeleton, SkeletonCard } from "@/components/common";

const AIExpansionPanel = lazy(() =>
  import("../../GraphMap/AIExpansionPanel").then((module) => ({
    default: module.AIExpansionPanel,
  })),
);

type WorkTab = "overview" | "notes" | "subtasks" | "executions" | "progress";

interface TaskWorkbenchProps {
  taskId: string;
  onBack: () => void;
  onEdit?: () => void;
}

export const TaskWorkbench: React.FC<TaskWorkbenchProps> = ({
  taskId,
  onBack,
  onEdit,
}) => {
  const [task, setTask] = useState<UserTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkTab>("overview");
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();

  // —— 深度拓展后台任务完成后，实时刷新任务详情列表（OverviewTab / SubtaskList） ——
  const [subtaskReloadKey, setSubtaskReloadKey] = useState(0);
  const [expansionTaskIds, setExpansionTaskIds] = useState<string[]>([]);

  /** 深度拓展创建的后台任务全部终态后：递增 reloadKey 触发子任务列表重载，并刷新图谱缓存 */
  useTaskSettledInvalidator({
    taskIds: expansionTaskIds,
    onAllSettled: () => {
      setSubtaskReloadKey((prev) => prev + 1);
      if (graphId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
      }
    },
  });

  const handleExpansionTasksCreated = useCallback((taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setExpansionTaskIds((prev) => [...prev, ...taskIds]);
  }, []);

  const depthExpandReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 「生成节点」面板深度拓展完成后，同步刷新子任务进度列表。该路径无后台任务 id，
   *  一次 init + 多次 expand 同步落库；子任务由后端 node_created 异步补建，故稍作延迟再重载。 */
  const handleDepthExpandCompleted = useCallback(() => {
    if (depthExpandReloadTimer.current) clearTimeout(depthExpandReloadTimer.current);
    depthExpandReloadTimer.current = setTimeout(() => {
      setSubtaskReloadKey((prev) => prev + 1);
    }, 800);
  }, []);

  useEffect(() => {
    return () => {
      if (depthExpandReloadTimer.current) clearTimeout(depthExpandReloadTimer.current);
    };
  }, []);

  // —— 空图「生成节点」：AI 智能拓展面板（仅深度），放在底部操作栏左端 ——
  const graphId = task?.graph_id;
  const { data: graphData } = useGraphData(graphId ?? "");
  const graphNodes = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const coreNodes = useMemo(
    () => graphNodes.filter((n) => n?.level === "core"),
    [graphNodes],
  );
  const hasCore = coreNodes.length > 0;
  const graphLoaded = graphData !== undefined;
  // 空图/仅 root 无顶层节点 → 底部显示「生成节点」
  const showGenerateNodes = !!graphId && graphLoaded && !hasCore;
  const [aiExpansionOpen, setAiExpansionOpen] = useState(false);
  const { data: graphMeta } = useGraph(graphId ?? "");
  const graphTitle = graphMeta?.title ?? "";

  const openGenerateNodes = () => {
    if (!graphId) return;
    setAiExpansionOpen(true);
  };

  /** 深展面板：初始化空图谱（生成 root + core 节点），复用 autoGraph.init + saveNodes */
  const handleDepthExpand = async (config: {
    style: "academic" | "practical" | "beginner" | "custom";
    customPrompt?: string;
    sources?: string[];
    depth: number;
  }): Promise<{
    root: { title: string; content?: string };
    coreNodes: Array<{ id?: string; title: string; content?: string }>;
  } | null> => {
    if (!graphId) return null;
    try {
      const result = await api.autoGraph.init({
        topic: graphTitle,
        style: config.style,
        customPrompt: config.customPrompt,
        sources: config.sources,
        graph_id: graphId,
      });
      const nodes = [
        { title: result.root.title, content: result.root.content, level: "root" },
        ...result.coreNodes.map((n) => ({
          title: n.title,
          content: n.content,
          level: n.level || "core",
          parentId: "temp-0",
        })),
      ];
      const saveResult = (await api.autoGraph.saveNodes({
        graph_id: graphId,
        nodes,
      })) as { nodeMapping?: Record<string, { graphNodeId: string }> };
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
      if (saveResult.nodeMapping) {
        const coreNodesWithIds = result.coreNodes
          .map((n, i) => ({
            ...n,
            id: saveResult.nodeMapping?.[`temp-${i + 1}`]?.graphNodeId,
          }))
          .filter((n): n is typeof n & { id: string } => Boolean(n.id));
        return { root: result.root, coreNodes: coreNodesWithIds };
      }
      return { root: result.root, coreNodes: result.coreNodes };
    } catch (error: unknown) {
      console.error("Failed to init graph via AI panel:", error);
      throw error;
    }
  };

  /** 深展面板：对某 core 节点扩展子节点，复用 autoGraph.expand + saveNodes */
  const handleDepthExpandNode = async (config: {
    nodeId: string;
    nodeTitle: string;
    nodeContent?: string;
    nodeLevel?: string;
    style: "academic" | "practical" | "beginner" | "custom";
    customPrompt?: string;
    existingChildren?: Array<{ title: string }>;
  }): Promise<Array<{ id?: string; title: string; content?: string }> | null> => {
    if (!graphId) return null;
    try {
      const result = await api.autoGraph.expand({
        node_id: config.nodeId,
        node_title: config.nodeTitle,
        node_content: config.nodeContent,
        node_level: config.nodeLevel,
        graph_id: graphId,
        style: config.style,
        customPrompt: config.customPrompt,
        existing_children: config.existingChildren,
      });
      if (result.children.length > 0) {
        const nodes = result.children.map((n) => ({
          title: n.title,
          content: n.content,
          level: n.level || "sub",
          parentId: config.nodeId,
        }));
        await api.autoGraph.saveNodes({ graph_id: graphId, nodes });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
        return result.children;
      }
      return null;
    } catch (error: unknown) {
      console.error("Failed to expand node via AI panel:", error);
      throw error;
    }
  };

  /** 深展面板宽度（占位）：后端已有 infinite-expand 宽度后台任务 */
  const handleWidthExpand = async (config: {
    max_depth: number;
    max_graphs_per_level: number;
    relation_types: string[];
    auto_generate_nodes: boolean;
    node_depth: number;
  }): Promise<void> => {
    if (!graphId) return;
    try {
      await api.graphs.infiniteExpand(graphId, {
        max_depth: config.max_depth,
        max_graphs_per_level: config.max_graphs_per_level,
        relation_types: config.relation_types,
        auto_generate_nodes: config.auto_generate_nodes,
        node_depth: config.node_depth,
      });
      messageHelper.success(t('scheduler.taskWorkbench.taskStarted'));
    } catch (error: unknown) {
      messageHelper.error(t('scheduler.taskWorkbench.taskStartFailed'));
      console.error("Failed to start width expansion:", error);
    }
  };

  /** 开始/暂停/完成等状态变更后失效调度相关缓存，使任务调度页/首页反映最新状态 */
  const invalidateSchedulerChange = (taskId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.schedulerTasks() });
    queryClient.invalidateQueries({ queryKey: queryKeys.queues() });
    queryClient.invalidateQueries({ queryKey: queryKeys.schedulerNextStep() });
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedulerTask(taskId) });
    }
  };

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // 首页「继续学习」入口：携带 autoStartTask 状态，加载后自动开始/继续任务
  // pending 首次开始；paused 恢复继续（都走 start 端点置为 in_progress）
  const shouldAutoStart =
    (location.state as { autoStartTask?: boolean } | null)?.autoStartTask === true;
  const autoStartHandled = useRef(false);

  useEffect(() => {
    if (shouldAutoStart && task && !autoStartHandled.current &&
        (task.status === "pending" || task.status === "paused")) {
      autoStartHandled.current = true;
      void handleStartTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart, task]);

  useEffect(() => {
    loadTaskDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const loadTaskDetail = async () => {
    setLoading(true);
    try {
      const response = await api.scheduler.getDetail(taskId);
      setTask(response);
    } catch (error) {
      console.error("Failed to load task detail:", error);
      messageHelper.error(t('scheduler.taskWorkbench.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    if (!task) return;
    try {
      await api.scheduler.start(task.id);
      messageHelper.success(t('scheduler.taskWorkbench.taskStarted'));
      invalidateSchedulerChange(task.id);
      loadTaskDetail();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.taskStartFailed');
      messageHelper.error(errMsg);
    }
  };

  const handlePauseTask = async () => {
    if (!task) return;
    try {
      await api.scheduler.pause(task.id);
      messageHelper.success(t('scheduler.taskWorkbench.taskPaused'));
      invalidateSchedulerChange(task.id);
      loadTaskDetail();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.taskPauseFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleCompleteTask = async () => {
    if (!task) return;
    try {
      await api.scheduler.complete(task.id);
      messageHelper.success(t('scheduler.taskWorkbench.taskCompleted'));
      invalidateSchedulerChange(task.id);
      loadTaskDetail();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.taskCompleteFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!await asyncConfirm({ title: t('scheduler.confirmDeleteTaskTitle'), message: t('scheduler.confirmDeleteTaskMessage'), isDangerous: true })) return;
    try {
      await api.scheduler.delete(task.id);
      messageHelper.success(t('scheduler.taskWorkbench.taskDeleted'));
      onBack();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.taskDeleteFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleSaveNotes = useCallback(
    async (notes: string) => {
      if (!task) return;
      try {
        await api.scheduler.updateNotes(task.id, notes);
        setTask({ ...task, notes });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.notesSaveFailed');
        messageHelper.error(errMsg);
      }
    },
    [task, t],
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400";
      case "in_progress":
        return "bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-400";
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "in_progress":
        return <Play className="w-4 h-4" />;
      case "paused":
        return <Pause className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t('scheduler.taskWorkbench.statusCompleted');
      case "in_progress":
        return t('scheduler.taskWorkbench.statusInProgress');
      case "paused":
        return t('scheduler.taskWorkbench.statusPaused');
      case "cancelled":
        return t('scheduler.taskWorkbench.statusCancelled');
      default:
        return t('scheduler.taskWorkbench.statusPending');
    }
  };

  const getTaskTypeLabel = (type?: string) => {
    switch (type) {
      case "one_time":
        return t('scheduler.taskWorkbench.typeOneTime');
      case "long_term":
        return t('scheduler.taskWorkbench.typeLongTerm');
      case "periodic":
        return t('scheduler.taskWorkbench.typePeriodic');
      case "learning":
        return t('scheduler.taskWorkbench.typeLearning');
      default:
        return t('scheduler.taskWorkbench.typeDefault');
    }
  };

  const getPriorityInfo = (priority: number) => {
    if (priority >= 4)
      {return {
        label: t('scheduler.taskWorkbench.priorityHigh'),
        color: "text-red-500",
        bg: "bg-red-100 dark:bg-red-500/20",
      };}
    if (priority >= 2)
      {return {
        label: t('scheduler.taskWorkbench.priorityMedium'),
        color: "text-yellow-500",
        bg: "bg-yellow-100 dark:bg-yellow-500/20",
      };}
    return {
      label: t('scheduler.taskWorkbench.priorityLow'),
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-500/20",
    };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('scheduler.taskWorkbench.dateNotSet');
    return formatDateUtil(dateStr, 'full-datetime');
  };

  const tabs: { id: WorkTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: t('scheduler.taskWorkbench.tabOverview'), icon: <LayoutDashboard size={16} /> },
    { id: "notes", label: t('scheduler.taskWorkbench.tabNotes'), icon: <FileText size={16} /> },
    { id: "subtasks", label: t('scheduler.taskWorkbench.tabSubtasks'), icon: <CheckCircle size={16} /> },
    { id: "executions", label: t('scheduler.taskWorkbench.tabExecutions'), icon: <Clock size={16} /> },
    { id: "progress", label: t('scheduler.taskWorkbench.tabProgress'), icon: <BarChart3 size={16} /> },
  ];

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(tabs[0].id);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = tabs.length - 1;
        setActiveTab(tabs[lastIndex].id);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
            <Skeleton variant="text" width="40%" height={20} />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Skeleton variant="rectangular" width={80} height={20} className="rounded-full" />
            <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
            <Skeleton variant="rectangular" width={70} height={20} className="rounded-full" />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex">
          <div className="w-[360px] flex-shrink-0 border-r border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <Skeleton variant="text" width="30%" />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
          <div className="flex-1 p-4 space-y-3">
            <Skeleton variant="rectangular" height={40} className="w-full" />
            <Skeleton variant="rectangular" height={200} className="w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          {t('scheduler.taskWorkbench.taskNotFound')}
        </h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          {t('scheduler.taskWorkbench.back')}
        </button>
      </div>
    );
  }

  const priorityInfo = getPriorityInfo(task.priority);

  // 实际时长：无任何番茄钟会话时显示「未计时」
  const actualDurationLabel = task.actual_duration
    ? formatDurationMinutes(task.actual_duration, { format: 'zh-spaced' })
    : t('scheduler.taskWorkbench.notTimerStarted');

  // 截止倒计时
  let deadlineDays: number | null = null;
  if (task.deadline) {
    deadlineDays = Math.ceil(
      (new Date(task.deadline).getTime() - Date.now()) / 86400000,
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onBack}
                className="flex-shrink-0 p-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all"
                title={t('scheduler.taskWorkbench.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                {task.title}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title={t('scheduler.taskWorkbench.edit')}
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowSaveAsTemplate(true)}
                className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                title={t('scheduler.taskWorkbench.saveAsTemplate')}
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteTask}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title={t('scheduler.taskWorkbench.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status and meta info */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}
            >
              {getStatusIcon(task.status)}
              {getStatusLabel(task.status)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-400">
              <Tag className="w-3 h-3" />
              {getTaskTypeLabel(task.task_type)}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.bg} ${priorityInfo.color}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {priorityInfo.label}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-600 dark:text-slate-400">
              Q{task.queue_level}
            </span>
          </div>
        </div>
      </div>

      {/* Main content - Left/Right split */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left panel - Task info */}
        <div className="w-[360px] flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 space-y-4">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {t('scheduler.taskWorkbench.description')}
              </h3>
              <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Time info cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-500">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Timer className="w-3.5 h-3.5" />
                <span className="text-xs">{t('scheduler.taskWorkbench.estimatedDuration')}</span>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {formatDurationMinutes(task.estimated_duration, { format: 'zh-spaced', emptyText: t('scheduler.taskWorkbench.dateNotSet') })}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-500">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">{t('scheduler.taskWorkbench.actualDuration')}</span>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {actualDurationLabel}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-500">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-xs">{t('scheduler.taskWorkbench.focusSessions')}</span>
              </div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {task.focus_session_count ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-500">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <CalendarClock className="w-3.5 h-3.5" />
                <span className="text-xs">{t('scheduler.taskWorkbench.scheduledStart')}</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {task.scheduled_start ? formatDate(task.scheduled_start) : t('scheduler.taskWorkbench.dateNotSet')}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-500">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs">{t('scheduler.taskWorkbench.deadline')}</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {task.deadline ? formatDate(task.deadline) : t('scheduler.taskWorkbench.dateNotSet')}
              </p>
              {deadlineDays !== null && (
                <span
                  className={`text-xs font-medium ${
                    deadlineDays < 0
                      ? 'text-red-500'
                      : deadlineDays <= 1
                        ? 'text-amber-500'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {deadlineDays < 0
                    ? t('scheduler.taskWorkbench.overdueDays', { count: -deadlineDays })
                    : deadlineDays === 0
                      ? t('scheduler.taskWorkbench.dueToday')
                      : t('scheduler.taskWorkbench.remainingDays', { count: deadlineDays })}
                </span>
              )}
            </div>
          </div>

          {/* Progress for long-term tasks */}
          {task.task_type === "long_term" &&
            task.progress_percentage !== undefined && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('scheduler.taskWorkbench.progress')}
                </h3>
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-500 h-full transition-all duration-300"
                    style={{ width: `${task.progress_percentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {t('scheduler.taskWorkbench.progressPercent', { percent: task.progress_percentage })}
                </p>
              </div>
            )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {t('scheduler.taskWorkbench.tags')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-0.5 bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <TaskLinks taskId={task.id} />

          {/* Timestamps */}
          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1 pt-3 border-t border-slate-200 dark:border-slate-500">
            <p>{t('scheduler.taskWorkbench.createdAt')}: {formatDate(task.created_at)}</p>
            <p>{t('scheduler.taskWorkbench.updatedAt')}: {formatDate(task.updated_at)}</p>
            {task.completed_at && <p>{t('scheduler.taskWorkbench.completedAt')}: {formatDate(task.completed_at)}</p>}
          </div>
        </div>

        {/* Right panel - Work area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab bar */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4">
            <div className="flex items-center gap-1" role="tablist" aria-label={t('layout.scheduler')}>
              {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[index] = el; }}
                    role="tab"
                    id={`${tabIdPrefix}-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`${panelIdPrefix}-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-all ${
                      isActive
                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            {activeTab === "overview" && (
              <div
                role="tabpanel"
                id={`${panelIdPrefix}-overview`}
                aria-labelledby={`${tabIdPrefix}-overview`}
                tabIndex={0}
                className="h-full overflow-y-auto"
              >
                <OverviewTab
                  taskId={task.id}
                  graphId={task.graph_id}
                  status={task.status}
                  onGoSubtasks={() => setActiveTab("subtasks")}
                  subtaskReloadKey={subtaskReloadKey}
                  onExpansionTasksCreated={handleExpansionTasksCreated}
                />
              </div>
            )}

            {activeTab === "notes" && (
              <div
                role="tabpanel"
                id={`${panelIdPrefix}-notes`}
                aria-labelledby={`${tabIdPrefix}-notes`}
                tabIndex={0}
                className="h-full"
              >
                <NotesTab
                  notes={task.notes || ""}
                  onChange={(notes) => setTask({ ...task, notes })}
                  onSave={handleSaveNotes}
                />
              </div>
            )}

            {activeTab === "subtasks" && (
              <div
                role="tabpanel"
                id={`${panelIdPrefix}-subtasks`}
                aria-labelledby={`${tabIdPrefix}-subtasks`}
                tabIndex={0}
                className="h-full overflow-y-auto"
              >
                <SubtaskList taskId={task.id} graphId={task.graph_id} subtaskReloadKey={subtaskReloadKey} />
              </div>
            )}

            {activeTab === "executions" && (
              <div
                role="tabpanel"
                id={`${panelIdPrefix}-executions`}
                aria-labelledby={`${tabIdPrefix}-executions`}
                tabIndex={0}
                className="h-full"
              >
                <ExecutionRecords taskId={task.id} />
              </div>
            )}

            {activeTab === "progress" && (
              <div
                role="tabpanel"
                id={`${panelIdPrefix}-progress`}
                aria-labelledby={`${tabIdPrefix}-progress`}
                tabIndex={0}
                className="h-full"
              >
                <ProgressDetail
                  taskId={task.id}
                  taskType={task.task_type}
                  progressPercentage={task.progress_percentage}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Action buttons */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400 dark:text-slate-500">
            {task.status === "in_progress" && (
              <span className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 animate-pulse" />
                {t('scheduler.taskWorkbench.inProgressLabel')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showGenerateNodes && (
              <button
                type="button"
                onClick={openGenerateNodes}
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('scheduler.taskWorkbench.overview.generateNodes')}
              </button>
            )}
            {task.status === "pending" && (
              <button
                onClick={handleStartTask}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-md shadow-primary-500/30 hover:shadow-lg"
              >
                <Play className="w-4 h-4" />
                {t('scheduler.taskWorkbench.startTask')}
              </button>
            )}
            {task.status === "in_progress" && (
              <>
                <button
                  onClick={handlePauseTask}
                  className="flex items-center gap-2 px-5 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  {t('scheduler.taskWorkbench.pauseTask')}
                </button>
                <button
                  onClick={handleCompleteTask}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-md shadow-green-500/30"
                >
                  <CheckCircle className="w-4 h-4" />
                  {t('scheduler.taskWorkbench.completeTask')}
                </button>
              </>
            )}
            {task.status === "paused" && (
              <button
                onClick={handleStartTask}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-md shadow-primary-500/30"
              >
                <Play className="w-4 h-4" />
                {t('scheduler.taskWorkbench.continueTask')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Save as Template Modal */}
      {showSaveAsTemplate && task && (
        <SaveAsTemplateModal
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            estimated_duration: task.estimated_duration,
            tags: task.tags,
            priority: task.priority,
          }}
          onClose={() => setShowSaveAsTemplate(false)}
          onSuccess={() => {
            messageHelper.success(t('scheduler.taskWorkbench.templateSaved'));
          }}
        />
      )}

      {/* 空图「生成节点」AI 智能拓展面板（仅深度） */}
      <Suspense fallback={null}>
        <AIExpansionPanel
          isOpen={aiExpansionOpen && !!graphId}
          onClose={() => setAiExpansionOpen(false)}
          sourceGraphId={graphId ?? ""}
          sourceGraphTitle={graphTitle}
          onDepthExpand={handleDepthExpand}
          onDepthExpandNode={handleDepthExpandNode}
          onWidthExpand={handleWidthExpand}
          hasNodes={false}
          depthOnly
          onDepthExpandCompleted={handleDepthExpandCompleted}
        />
      </Suspense>
    </div>
  );
};

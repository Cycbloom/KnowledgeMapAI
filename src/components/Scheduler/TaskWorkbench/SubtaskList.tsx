import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  CheckCircle,
  Circle,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  BookOpen,
  GraduationCap,
  Pencil,
  Square,
  CheckSquare,
  FileCheck,
  ListTodo,
  RefreshCw,
  Route,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { TaskSubtask } from "../../../types";
import { message as messageHelper } from "../../../utils/messageHelper";
import { asyncConfirm } from "../../../utils/asyncConfirm";
import { EmptyState } from "../../common/EmptyState";
import { LearningStateBadge } from "../LearningStateBadge";
import { MasteryProgressBar } from "../MasteryProgressBar";
import { useFormDraft } from "../../../hooks";
import { ConfirmationModal } from "../../common/ConfirmationModal";
import { useKnowledgePointMastery } from "@/hooks/useKnowledgePointMastery";
import { useQuestionConfigModal } from "@/hooks/useQuestionConfigModal";
import {
  learningMaterialUrl,
  studyCenterUrl,
  createQuizForKps,
} from "@/utils/studyUrls";

const GenerateCardsModal = lazy(() =>
  import("../../Learning/GenerateCardsModal").then((module) => ({
    default: module.GenerateCardsModal,
  })),
);

interface SubtaskDraft {
  title: string;
  description: string;
  estimated_duration: number | undefined;
  knowledge_point_id: string;
}

interface SubtaskListProps {
  taskId: string;
  knowledgePointId?: string;
  graphId?: string;
  className?: string;
  /** 深度拓展完成后由宿主递增，触发本组件重载子任务列表 */
  subtaskReloadKey?: number;
  /** 图任务当前编排的学习路径 ID（持久化于 user_tasks.active_learning_path_id）；空=不按路径 */
  activeLearningPathId?: string | null;
  /** 编排路径变更后回调宿主，同步父级 task 状态（避免切换 Tab 后选择器被陈旧 prop 重置） */
  onActivePathChange?: (pathId: string | null) => void;
}

interface KnowledgePoint {
  id: string;
  title: string;
}

interface GraphLearningPath {
  id: string;
  title: string;
  nodes_count?: number;
  completed_nodes_count?: number;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  taskId,
  knowledgePointId: defaultKnowledgePointId,
  graphId,
  className = "",
  subtaskReloadKey,
  activeLearningPathId,
  onActivePathChange,
}) => {
  const navigate = useNavigate();
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedKpIds, setSelectedKpIds] = useState<Set<string>>(
    new Set(),
  );
  const [learningPaths, setLearningPaths] = useState<GraphLearningPath[]>([]);
  /** 当前编排的学习路径；空字符串=不按路径（展示全部知识点子任务） */
  const [activePathId, setActivePathId] = useState("");
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();
  const {
    value: newSubtask,
    setValue: setNewSubtask,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<SubtaskDraft>({
    key: 'subtaskList_draft',
    initialValue: {
      title: "",
      description: "",
      estimated_duration: undefined,
      knowledge_point_id: defaultKnowledgePointId || "",
    },
  });

  const kpIds = useMemo(
    () => Array.from(new Set(subtasks.map((s) => s.knowledge_point_id))),
    [subtasks],
  );
  const questionConfig = useQuestionConfigModal(graphId);
  const { masteryByKp } = useKnowledgePointMastery(kpIds);

  useEffect(() => {
    loadSubtasks();
    loadKnowledgePoints();
    // 切换 task 后重置选择
    setSelectedKpIds(new Set());
  }, [taskId]);

  // 深度拓展完成后由宿主递增 subtaskReloadKey → 重新加载子任务
  useEffect(() => {
    if (subtaskReloadKey === undefined) return;
    loadSubtasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtaskReloadKey]);

  // 图任务：加载该图谱的学习路径（供路径选择器）
  useEffect(() => {
    if (!graphId) {
      setLearningPaths([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.learningPaths.listForGraph(graphId, "active");
        if (!cancelled) {
          setLearningPaths(
            (data as GraphLearningPath[] | undefined | null) ?? [],
          );
        }
      } catch {
        if (!cancelled) setLearningPaths([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphId]);

  // 宿主传入的持久化路径发生变化时，同步当前激活路径
  useEffect(() => {
    setActivePathId(activeLearningPathId ?? "");
  }, [activeLearningPathId]);

  const applyRefreshResult = (res: {
    subtasks: TaskSubtask[];
    activePathId: string | null;
  }) => {
    setSubtasks(res.subtasks ?? []);
    setActivePathId(res.activePathId ?? "");
    onActivePathChange?.(res.activePathId ?? null);
  };

  const handleSelectPath = async (pathId: string) => {
    setRefreshMenuOpen(false);
    if (pathId === activePathId) return;
    try {
      setRefreshing(true);
      // 切换路径 = 以该路径重新编排（自动补齐缺失 + 按路径重排 + 持久化）
      const res = await api.scheduler.refreshSubtasks(taskId, {
        mode: "sync",
        path_id: pathId || null,
      });
      applyRefreshResult(res);
      setSelectedKpIds(new Set());
      messageHelper.success(
        pathId
          ? t('scheduler.taskWorkbench.subtaskList.pathApplied')
          : t('scheduler.taskWorkbench.subtaskList.allApplied'),
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.subtaskList.refreshFailed');
      messageHelper.error(errMsg);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async (reset: boolean) => {
    if (reset) {
      const confirmed = await asyncConfirm({
        title: t('scheduler.taskWorkbench.subtaskList.resetTitle'),
        message: t('scheduler.taskWorkbench.subtaskList.resetMessage'),
        isDangerous: true,
      });
      if (!confirmed) return;
    }
    try {
      setRefreshing(true);
      const res = await api.scheduler.refreshSubtasks(taskId, {
        mode: reset ? "reset" : "sync",
        path_id: activePathId || null,
      });
      applyRefreshResult(res);
      setSelectedKpIds(new Set());
      messageHelper.success(
        reset
          ? t('scheduler.taskWorkbench.subtaskList.resetDone')
          : t('scheduler.taskWorkbench.subtaskList.syncDone'),
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.subtaskList.refreshFailed');
      messageHelper.error(errMsg);
    } finally {
      setRefreshMenuOpen(false);
      setRefreshing(false);
    }
  };

  const toggleSelect = (kpId: string) => {
    setSelectedKpIds((prev) => {
      const next = new Set(prev);
      if (next.has(kpId)) {
        next.delete(kpId);
      } else {
        next.add(kpId);
      }
      return next;
    });
  };

  const loadSubtasks = async () => {
    try {
      const data = await api.scheduler.getSubtasks(taskId);
      setSubtasks(data ?? []);
    } catch (error) {
      console.error("Failed to load subtasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const data = await api.knowledgePoints.list();
      if (data) {
        setKnowledgePoints(
          data.map((kp: { id: string; title?: string }) => ({
            id: kp.id,
            title: kp.title || t('scheduler.taskWorkbench.subtaskList.unnamedKnowledgePoint'),
          })),
        );
      }
    } catch (error) {
      console.error("Failed to load knowledge points:", error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.title.trim()) {
      messageHelper.error(t('scheduler.taskWorkbench.subtaskTitleRequired'));
      return;
    }

    if (!newSubtask.knowledge_point_id) {
      messageHelper.error(t('scheduler.taskWorkbench.subtaskKnowledgePointRequired'));
      return;
    }

    try {
      const created = await api.scheduler.createSubtask(taskId, {
        title: newSubtask.title,
        description: newSubtask.description || undefined,
        estimated_duration: newSubtask.estimated_duration,
        knowledge_point_id: newSubtask.knowledge_point_id,
      });
      setSubtasks([...subtasks, created]);
      clearDraft();
      setNewSubtask({
        title: "",
        description: "",
        estimated_duration: undefined,
        knowledge_point_id: defaultKnowledgePointId || "",
      });
      setIsAdding(false);
      messageHelper.success(t('scheduler.taskWorkbench.subtaskAdded'));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.subtaskAddFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleToggleStatus = async (subtask: TaskSubtask) => {
    const newStatus = subtask.status === "completed" ? "pending" : "completed";
    try {
      const updated = await api.scheduler.updateSubtask(taskId, subtask.id, {
        status: newStatus,
      });
      setSubtasks(
        subtasks.map((st) => (st.id === subtask.id ? updated : st)),
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.subtaskUpdateFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!await asyncConfirm({ title: t('common.confirm.deleteSubtaskTitle'), message: t('common.confirm.deleteSubtaskMessage'), isDangerous: true })) return;
    try {
      await api.scheduler.deleteSubtask(taskId, subtaskId);
      setSubtasks(subtasks.filter((st) => st.id !== subtaskId));
      messageHelper.success(t('scheduler.taskWorkbench.subtaskDeleted'));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.subtaskDeleteFailed');
      messageHelper.error(errMsg);
    }
  };

  // 当激活某条学习路径时，只展示属于该路径（learning_path_node_id 非空）的子任务
  const displayedSubtasks = useMemo(() => {
    if (!activePathId) return subtasks;
    return subtasks.filter((s) => s.learning_path_node_id != null);
  }, [subtasks, activePathId]);
  const hiddenCount = subtasks.length - displayedSubtasks.length;

  // 单趟统计完成数（基于当前展示列表）
  const { completedCount } = displayedSubtasks.reduce(
    (acc, st) => {
      if (st.status === "completed") acc.completedCount++;
      return acc;
    },
    { completedCount: 0 },
  );
  const progress =
    displayedSubtasks.length > 0
      ? Math.round((completedCount / displayedSubtasks.length) * 100)
      : 0;

  // 实时掌握度：优先按学习卡计算，缺失时回退子任务已存值
  const masteryOf = (subtask: TaskSubtask): number | undefined => {
    const live = subtask.knowledge_point_id
      ? masteryByKp.get(subtask.knowledge_point_id)
      : undefined;
    return live != null ? live : subtask.mastery_level;
  };

  // 平均掌握度改用实时值（汇总，基于当前展示列表）
  const avgMastery = useMemo(() => {
    if (displayedSubtasks.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const st of displayedSubtasks) {
      const live = st.knowledge_point_id
        ? masteryByKp.get(st.knowledge_point_id)
        : undefined;
      const m = live != null ? live : st.mastery_level;
      if (m != null && Number.isFinite(m)) {
        sum += Math.max(0, Math.min(1, m));
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }, [displayedSubtasks, masteryByKp]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 bg-slate-200 dark:bg-slate-700 rounded"
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('scheduler.taskWorkbench.subtaskList.title')}
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('scheduler.taskWorkbench.subtaskList.completionFormat', { completed: completedCount, total: displayedSubtasks.length })}
          </span>
          {displayedSubtasks.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('scheduler.taskWorkbench.subtaskList.avgMastery', { percent: avgMastery.toFixed(0) })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* 刷新/重置子任务 */}
          <div className="relative">
            <button
              onClick={() => setRefreshMenuOpen((v) => !v)}
              disabled={refreshing}
              title={t('scheduler.taskWorkbench.subtaskList.refresh')}
              aria-label={t('scheduler.taskWorkbench.subtaskList.refresh')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {t('scheduler.taskWorkbench.subtaskList.refresh')}
            </button>
            {refreshMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-60 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-500 rounded-xl shadow-lg">
                <button
                  onClick={() => handleRefresh(false)}
                  disabled={refreshing}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {t('scheduler.taskWorkbench.subtaskList.syncLabel')}
                </button>
                <button
                  onClick={() => handleRefresh(true)}
                  disabled={refreshing}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  {t('scheduler.taskWorkbench.subtaskList.resetLabel')}
                </button>
              </div>
            )}
          </div>
          {/* 学习路径选择器 */}
          {graphId && learningPaths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Route size={14} className="text-slate-400" />
              <select
                value={activePathId}
                onChange={(e) => handleSelectPath(e.target.value)}
                disabled={refreshing}
                aria-label={t('scheduler.taskWorkbench.subtaskList.pathSelectLabel')}
                className="max-w-[200px] px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">{t('scheduler.taskWorkbench.subtaskList.allNodes')}</option>
                {learningPaths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* 新增子任务 */}
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
          >
            <Plus size={14} />
            {t('scheduler.taskWorkbench.subtaskList.add')}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {displayedSubtasks.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {progress}%
                </span>
              </div>
            </div>
          )}
          {activePathId && hiddenCount > 0 && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              {t('scheduler.taskWorkbench.subtaskList.hiddenHint', { count: hiddenCount })}
            </p>
          )}

          {isAdding && (
            <div className="mb-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-500">
              <input
                type="text"
                value={newSubtask.title}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, title: e.target.value })
                }
                placeholder={t('scheduler.subtask.titlePlaceholder')}
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <textarea
                value={newSubtask.description}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, description: e.target.value })
                }
                placeholder={t('scheduler.subtask.descriptionPlaceholder')}
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-slate-400" />
                <select
                  value={newSubtask.knowledge_point_id}
                  onChange={(e) =>
                    setNewSubtask({
                      ...newSubtask,
                      knowledge_point_id: e.target.value,
                    })
                  }
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('scheduler.taskWorkbench.subtaskList.selectKnowledgePoint')}</option>
                  {knowledgePoints.map((kp) => (
                    <option key={kp.id} value={kp.id}>
                      {kp.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-400" />
                <input
                  type="number"
                  value={newSubtask.estimated_duration || ""}
                  onChange={(e) =>
                    setNewSubtask({
                      ...newSubtask,
                      estimated_duration: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder={t('scheduler.subtask.durationPlaceholder')}
                  aria-label={t('scheduler.estimatedDuration')}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewSubtask({
                      title: "",
                      description: "",
                      estimated_duration: undefined,
                      knowledge_point_id: defaultKnowledgePointId || "",
                    });
                  }}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all"
                >
                  {t('scheduler.taskWorkbench.subtaskList.add')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {displayedSubtasks.map((subtask) => {
              const masteryValue = masteryOf(subtask);
              const kpId = subtask.knowledge_point_id;
              return (
              <div
                key={subtask.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  subtask.status === "completed"
                    ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-500"
                }`}
              >
                <button
                  onClick={() => handleToggleStatus(subtask)}
                  className="flex-shrink-0"
                >
                  {subtask.status === "completed" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-primary-500 transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`font-medium ${
                        subtask.status === "completed"
                          ? "text-slate-500 dark:text-slate-400 line-through"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {subtask.title}
                    </p>
                    {subtask.learning_state && (
                      <LearningStateBadge
                        state={subtask.learning_state}
                        size="sm"
                      />
                    )}
                  </div>
                  {subtask.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {subtask.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <MasteryProgressBar
                      masteryLevel={masteryValue ?? 0}
                      size="sm"
                      showLabel
                    />
                    {subtask.estimated_duration && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {t('scheduler.taskWorkbench.subtaskList.estimatedDuration', { count: subtask.estimated_duration })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {kpId && (
                    <>
                      <button
                        onClick={() => toggleSelect(kpId)}
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                        title={t('scheduler.taskWorkbench.subtaskList.actions.select')}
                        aria-label={t('scheduler.taskWorkbench.subtaskList.actions.select')}
                      >
                        {selectedKpIds.has(kpId) ? (
                          <CheckSquare className="w-4 h-4 text-primary-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => navigate(learningMaterialUrl(kpId, graphId))}
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                        title={t('scheduler.taskWorkbench.subtaskList.actions.learnMaterial')}
                        aria-label={t('scheduler.taskWorkbench.subtaskList.actions.learnMaterial')}
                      >
                        <BookOpen size={15} />
                      </button>
                      <button
                        onClick={async () => {
                          // 无题时先打开「题目配置」（练习用），避免打开学习中心后无可练习内容
                          const cards =
                            (await api.study.getCards({ knowledge_point_id: kpId })) ?? [];
                          if (cards.length === 0) {
                            questionConfig.openFor(kpId, subtask.title);
                            return;
                          }
                          navigate(studyCenterUrl(kpId, graphId));
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                        title={t('scheduler.taskWorkbench.subtaskList.actions.studyCenter')}
                        aria-label={t('scheduler.taskWorkbench.subtaskList.actions.studyCenter')}
                      >
                        <GraduationCap size={15} />
                      </button>
                      <button
                        onClick={() => questionConfig.openFor(kpId, subtask.title)}
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                        title={t('scheduler.taskWorkbench.subtaskList.actions.createQuiz')}
                        aria-label={t('scheduler.taskWorkbench.subtaskList.actions.createQuiz')}
                      >
                        <Pencil size={15} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
            })}

            {selectedKpIds.size > 0 && (
              <div className="sticky bottom-0 flex items-center justify-between gap-3 p-3 bg-primary-50 dark:bg-slate-800 border border-primary-200 dark:border-primary-500/30 rounded-xl">
                <span className="text-sm text-primary-700 dark:text-primary-300">
                  {t('scheduler.taskWorkbench.overview.batchSelected', {
                    count: selectedKpIds.size,
                  })}
                </span>
                <button
                  onClick={() =>
                    navigate(createQuizForKps(Array.from(selectedKpIds), graphId))
                  }
                  className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                >
                  <FileCheck size={15} />
                  {t('scheduler.taskWorkbench.overview.createBatchQuiz')}
                </button>
              </div>
            )}

            {displayedSubtasks.length === 0 && !isAdding && (
              <EmptyState
                icon={<ListTodo size={32} />}
                title={t('scheduler.empty.subtasks')}
                action={{ label: t('scheduler.taskWorkbench.subtaskList.addFirstSubtask'), onClick: () => setIsAdding(true) }}
              />
            )}
          </div>
        </>
      )}
      {isAdding && showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t('common.restoreDraftTitle')}
          message={t('common.restoreDraftMessage')}
          isDangerous={false}
        />
      )}

      {/* 题目配置面板（练习用，区别于创建测验） */}
      <Suspense fallback={null}>
        <GenerateCardsModal
          isOpen={questionConfig.isOpen}
          onClose={questionConfig.close}
          onGenerate={questionConfig.onGenerate}
          nodeTitle={questionConfig.target?.title}
          graphId={graphId ?? undefined}
          selectedNodes={
            questionConfig.target
              ? [
                  {
                    id: questionConfig.target.kpId,
                    title: questionConfig.target.title,
                  },
                ]
              : []
          }
          graphNodes={
            questionConfig.target
              ? [
                  {
                    id: questionConfig.target.kpId,
                    title: questionConfig.target.title,
                  },
                ]
              : []
          }
          graphEdges={[]}
        />
      </Suspense>
    </div>
  );
};

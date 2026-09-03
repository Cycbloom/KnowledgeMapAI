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
}

interface KnowledgePoint {
  id: string;
  title: string;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  taskId,
  knowledgePointId: defaultKnowledgePointId,
  graphId,
  className = "",
  subtaskReloadKey,
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

  // 单趟统计完成数
  const { completedCount } = subtasks.reduce(
    (acc, st) => {
      if (st.status === "completed") acc.completedCount++;
      return acc;
    },
    { completedCount: 0 },
  );
  const progress =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

  // 实时掌握度：优先按学习卡计算，缺失时回退子任务已存值
  const masteryOf = (subtask: TaskSubtask): number | undefined => {
    const live = subtask.knowledge_point_id
      ? masteryByKp.get(subtask.knowledge_point_id)
      : undefined;
    return live != null ? live : subtask.mastery_level;
  };

  // 平均掌握度改用实时值（汇总）
  const avgMastery = useMemo(() => {
    if (subtasks.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const st of subtasks) {
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
  }, [subtasks, masteryByKp]);

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
            {t('scheduler.taskWorkbench.subtaskList.completionFormat', { completed: completedCount, total: subtasks.length })}
          </span>
          {subtasks.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('scheduler.taskWorkbench.subtaskList.avgMastery', { percent: avgMastery.toFixed(0) })}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
        >
          <Plus size={14} />
          {t('scheduler.taskWorkbench.subtaskList.add')}
        </button>
      </div>

      {isExpanded && (
        <>
          {subtasks.length > 0 && (
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
            {subtasks.map((subtask) => {
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

            {subtasks.length === 0 && !isAdding && (
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

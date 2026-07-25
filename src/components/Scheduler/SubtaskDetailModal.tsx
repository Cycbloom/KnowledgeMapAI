import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Clock,
  Calendar,
  ChevronRight,
  Save,
  ArrowRight,
  Lightbulb,
  History,
  AlertCircle,
} from "lucide-react";
import { LearningStateBadge } from "./LearningStateBadge";
import { MasteryProgressBar } from "./MasteryProgressBar";
import { subtasksApi, type ValidTransitionsResult } from "../../services/api/modules/scheduler/subtasks";
import { knowledgePointsApi, type TaskKnowledgePoint } from "../../services/api/modules/scheduler/knowledgePoints";
import { message } from "../../utils/messageHelper";
import { useTheme, useFocusTrap, useEscapeKey } from "../../hooks";
import { formatDate as formatDateUtil } from "../../utils/formatters";
import type {
  TaskSubtask,
  LearningState,
  StateHistoryEntry,
} from "@shared/types/scheduler";

interface SubtaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  subtask: TaskSubtask | null;
  onStateTransition?: (subtaskId: string, toState: LearningState, masteryLevel: number) => void;
  onMasteryUpdate?: (subtaskId: string, masteryLevel: number) => void;
}

const STATE_LABELS: Record<LearningState, string> = {
  learning: "学习",
  review: "复习",
  practice: "练习",
  quiz: "测验",
};

const STATE_DESCRIPTIONS: Record<LearningState, string> = {
  learning: "初始学习阶段，仅出现一次",
  review: "复习已学内容",
  practice: "简单题目快速检验",
  quiz: "综合题目全面评估",
};

export const SubtaskDetailModal: React.FC<SubtaskDetailModalProps> = ({
  isOpen,
  onClose,
  taskId,
  subtask,
  onStateTransition,
  onMasteryUpdate,
}) => {
  const { isDark } = useTheme();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);
  const [loading, setLoading] = useState(false);
  const [knowledgePoint, setKnowledgePoint] = useState<TaskKnowledgePoint | null>(null);
  const [validTransitions, setValidTransitions] = useState<ValidTransitionsResult | null>(null);
  const [masteryLevel, setMasteryLevel] = useState(subtask?.mastery_level ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [transitioningState, setTransitioningState] = useState<LearningState | null>(null);

  useEffect(() => {
    if (subtask) {
      setMasteryLevel(subtask.mastery_level);
      loadRelatedData();
    }
  }, [subtask]);

  const loadRelatedData = async () => {
    if (!subtask) return;

    setLoading(true);
    try {
      const [kpData, transitionsData] = await Promise.all([
        subtask.knowledge_point_id
          ? knowledgePointsApi.getTaskKnowledgePoints(taskId)
          : Promise.resolve([] as TaskKnowledgePoint[]),
        subtasksApi.getValidTransitions(taskId, subtask.id),
      ]);

      const kp = kpData.find(
        (k: TaskKnowledgePoint) => k.knowledge_point_id === subtask.knowledge_point_id
      );
      setKnowledgePoint(kp || null);

      setValidTransitions(transitionsData);
    } catch (error) {
      console.error("Failed to load related data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStateTransition = useCallback(
    async (toState: LearningState) => {
      if (!subtask || transitioningState) return;

      setTransitioningState(toState);
      try {
        await subtasksApi.transitionSubtask(taskId, subtask.id, {
          to_state: toState,
          mastery_level: masteryLevel,
        });

        message.success(`状态已切换为 ${STATE_LABELS[toState]}`);
        onStateTransition?.(subtask.id, toState, masteryLevel);
        loadRelatedData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "状态切换失败";
        message.error(errorMessage);
      } finally {
        setTransitioningState(null);
      }
    },
    [subtask, taskId, masteryLevel, transitioningState, onStateTransition]
  );

  const handleMasterySave = useCallback(async () => {
    if (!subtask || isSaving) return;

    setIsSaving(true);
    try {
      await subtasksApi.updateMastery(taskId, subtask.id, masteryLevel);

      message.success("掌握度已更新");
      onMasteryUpdate?.(subtask.id, masteryLevel);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "掌握度更新失败";
      message.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [subtask, taskId, masteryLevel, isSaving, onMasteryUpdate]);

  const formatDate = (dateString: string) => {
    return formatDateUtil(dateString, 'full-datetime');
  };

  const getMasteryColor = (level: number): string => {
    if (level < 30) return "text-red-500";
    if (level < 70) return "text-orange-500";
    return "text-green-500";
  };

  const otherValidTransitions = useMemo(
    () =>
      validTransitions
        ? validTransitions.valid_transitions.filter(
            (s) => s !== validTransitions.recommended_next
          )
        : [],
    [validTransitions]
  );

  if (!subtask) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-modal-overlay flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
              isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen size={20} className="text-primary-500" />
                子任务详情
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <section className={`p-4 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                  基本信息
                </h4>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {subtask.title}
                </h3>
                {subtask.description && (
                  <p className="text-slate-600 dark:text-slate-300 mb-3">
                    {subtask.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>创建：{formatDate(subtask.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>更新：{formatDate(subtask.updated_at)}</span>
                  </div>
                  {subtask.estimated_duration && (
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>预计：{subtask.estimated_duration} 分钟</span>
                    </div>
                  )}
                </div>
              </section>

              {knowledgePoint?.knowledge_point && (
                <section className={`p-4 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
                  <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <BookOpen size={14} />
                    知识点信息
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-400">名称</span>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {knowledgePoint.knowledge_point.title}
                      </p>
                    </div>
                    {knowledgePoint.knowledge_point.content && (
                      <div>
                        <span className="text-xs text-slate-400">内容摘要</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                          {knowledgePoint.knowledge_point.content}
                        </p>
                      </div>
                    )}
                    {knowledgePoint.notes && (
                      <div>
                        <span className="text-xs text-slate-400">备注</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {knowledgePoint.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section className={`p-4 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                  <AlertCircle size={14} />
                  学习状态
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">当前状态</span>
                    <LearningStateBadge state={subtask.learning_state} size="lg" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 dark:text-slate-300">掌握度</span>
                      <span className={`font-medium ${getMasteryColor(subtask.mastery_level)}`}>
                        {subtask.mastery_level}%
                      </span>
                    </div>
                    <MasteryProgressBar masteryLevel={subtask.mastery_level} size="lg" />
                  </div>
                  <p className="text-xs text-slate-400">
                    {STATE_DESCRIPTIONS[subtask.learning_state]}
                  </p>
                </div>
              </section>

              {!loading && validTransitions && validTransitions.valid_transitions.length > 0 && (
                <section className={`p-4 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
                  <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <ArrowRight size={14} />
                    状态转换
                  </h4>
                  <div className="space-y-3">
                    {validTransitions.recommended_next && (
                      <div className={`p-3 rounded-lg border-2 border-primary-500/50 bg-primary-50 dark:bg-primary-500/10`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb size={14} className="text-primary-500" />
                          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            推荐状态
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LearningStateBadge state={subtask.learning_state} size="sm" />
                            <ChevronRight size={14} className="text-slate-400" />
                            <LearningStateBadge state={validTransitions.recommended_next} size="sm" />
                          </div>
                          <button
                            onClick={() => handleStateTransition(validTransitions.recommended_next)}
                            disabled={transitioningState !== null}
                            className="px-3 py-1.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {transitioningState === validTransitions.recommended_next ? (
                              <span className="flex items-center gap-1">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                切换中
                              </span>
                            ) : (
                              "切换"
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          掌握度 {subtask.mastery_level}% → {STATE_LABELS[validTransitions.recommended_next]}
                        </p>
                      </div>
                    )}

                    <div>
                      <span className="text-xs text-slate-400 mb-2 block">可转换状态</span>
                      <div className="flex flex-wrap gap-2">
                        {otherValidTransitions.map((state) => (
                            <button
                              key={state}
                              onClick={() => handleStateTransition(state)}
                              disabled={transitioningState !== null}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                isDark
                                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {transitioningState === state ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                              ) : (
                                <LearningStateBadge state={state} size="sm" />
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className={`p-4 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                  <Save size={14} />
                  掌握度调整
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={masteryLevel}
                      onChange={(e) => setMasteryLevel(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                    />
                    <span className={`font-medium w-12 text-right ${getMasteryColor(masteryLevel)}`}>
                      {masteryLevel}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-400">
                      拖动滑块调整掌握度（0-100%）
                    </p>
                    <button
                      onClick={handleMasterySave}
                      disabled={isSaving || masteryLevel === subtask.mastery_level}
                      className="px-3 py-1.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                          保存中
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          保存
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {subtask.state_history && subtask.state_history.length > 0 && (
                <section className={`p-4 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
                  <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <History size={14} />
                    状态历史
                  </h4>
                  <div className="space-y-2">
                    {subtask.state_history
                      .slice()
                      .reverse()
                      .map((entry: StateHistoryEntry, index: number) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            isDark ? "bg-slate-800" : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-xs">
                            <LearningStateBadge state={entry.from_state} size="sm" />
                            <ChevronRight size={12} className="text-slate-400" />
                            <LearningStateBadge state={entry.to_state} size="sm" />
                          </div>
                          <span className="text-xs text-slate-400 ml-auto">
                            {formatDate(entry.changed_at)}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-500">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl font-medium ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SubtaskDetailModal;

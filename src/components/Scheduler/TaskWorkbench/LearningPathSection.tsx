import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Loader2,
  Route,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../services/api";
import { queryKeys } from "../../../hooks/queries/config";
import { useSchedulerOrchestrator } from "../../../hooks/scheduler/useSchedulerOrchestrator";
import { message } from "../../../utils/messageHelper";
import { formatDate as formatDateUtil } from "../../../utils/formatters";
import { ModalShell } from "../../common/ModalShell";
import { LearningPathWizard } from "../../Learning/LearningPathWizard";
import type { LearningPathResponse } from "../../../services/api/learningPaths";

interface LearningPathSectionProps {
  graphId?: string;
  /** 任务当前编排的学习路径 ID（持久化于 user_tasks.active_learning_path_id） */
  activeLearningPathId?: string | null;
  /** 生成默认路径后子任务被重排，通知宿主刷新子任务列表 */
  onSubtasksChanged?: () => void;
  /** 切换任务当前编排的学习路径（AI 路径生成后自动应用） */
  onActivePathChange?: (pathId: string | null) => void;
}

/** 后端 /generate-preview 扁平返回结构（见 learningPathRouteService），映射自 LearningPathPanel 的 TempLearningPath */
interface AiPathStage {
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  level?: string;
  priority: "high" | "medium" | "low";
  reason?: string;
  estimatedTime: number;
  prerequisites: string[];
}

interface AiPathPreview {
  graphId: string;
  graphTitle: string;
  estimatedTotalTime: number;
  stages: AiPathStage[];
  aiGenerated?: boolean;
  targetGoal?: string;
}

const MAX_VISIBLE = 3;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LearningPathSection: React.FC<LearningPathSectionProps> = ({
  graphId,
  activeLearningPathId,
  onSubtasksChanged,
  onActivePathChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startLearningForGraph } = useSchedulerOrchestrator();
  const [expanded, setExpanded] = useState(false);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const graphIdValue = graphId ?? "";
  const { data: paths = [], isLoading } = useQuery({
    queryKey: queryKeys.graphLearningPath(graphIdValue),
    queryFn: async () => {
      const result = await api.learningPaths.listForGraph(
        graphIdValue,
        "active",
      );
      return (Array.isArray(result) ? result : []) as LearningPathResponse[];
    },
    enabled: !!graphId,
  });

  if (!graphId) return null;

  const visiblePaths = expanded ? paths : paths.slice(0, MAX_VISIBLE);
  const hiddenCount = paths.length - MAX_VISIBLE;

  const handleGenerate = async () => {
    try {
      await startLearningForGraph.mutateAsync({ graphId });
      message.success(t("scheduler.taskWorkbench.learningPath.generateSuccess"));
      onSubtasksChanged?.();
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : t("scheduler.taskWorkbench.learningPath.generateFailed");
      message.error(errMsg);
    }
  };

  /** AI 规划向导完成：生成预览 → 直接落库保存（复用图编辑器 LearningPathPanel 的生成/保存链路） */
  const handleAiGenerate = async (data: {
    targetGoal: string;
    currentKnowledge: Record<string, string>;
    learningStyle: "sequential" | "exploratory" | "focused";
    dailyTimeMinutes: number;
  }) => {
    setAiWizardOpen(false);
    setIsGenerating(true);
    try {
      const knowledgeStr = Object.entries(data.currentKnowledge)
        .map(([k, v]) => `${k}: ${v}`)
        .join("；");

      const preview = (await api.learningPath.generate({
        graph_id: graphId,
        learning_style: data.learningStyle,
        daily_time_minutes: data.dailyTimeMinutes,
        target_goal: data.targetGoal,
        current_knowledge: knowledgeStr,
      })) as AiPathPreview;

      const nodes = (preview.stages ?? []).map((stage, index) => ({
        knowledge_point_id: stage.nodeId,
        order_index: index,
        title: stage.nodeTitle,
        description: stage.reason,
        estimated_time: stage.estimatedTime,
        // 不区分里程碑：所有知识点均按普通节点参与容量装箱
        is_milestone: false,
        prerequisites: (stage.prerequisites ?? []).filter((id) =>
          UUID_PATTERN.test(id),
        ),
      }));

      const created = (await api.learningPaths.create({
        title:
          preview.targetGoal ||
          preview.graphTitle ||
          t("scheduler.taskWorkbench.learningPath.aiPathTitle"),
        description: t("scheduler.taskWorkbench.learningPath.aiPathDescription", {
          hours: Math.round(preview.estimatedTotalTime / 60),
        }),
        goal: preview.targetGoal,
        source_graph_id: graphId,
        total_estimated_time: preview.estimatedTotalTime,
        ai_generated: true,
        daily_minutes_target: data.dailyTimeMinutes,
        nodes,
      })) as LearningPathResponse;

      // AI 路径生成后自动应用为任务当前编排，并刷新子任务列表
      onActivePathChange?.(created.id);

      queryClient.invalidateQueries({
        queryKey: queryKeys.graphLearningPath(graphId),
      });
      message.success(t("scheduler.taskWorkbench.learningPath.aiGenerateSuccess"));
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : t("scheduler.taskWorkbench.learningPath.aiGenerateFailed");
      message.error(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-500 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("scheduler.taskWorkbench.learningPath.title")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiWizardOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/30 transition-colors"
            >
              <Wand2 size={12} />
              {t("scheduler.taskWorkbench.learningPath.aiPlan")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/learning-paths")}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/30 transition-colors"
            >
              <ExternalLink size={12} />
              {t("scheduler.taskWorkbench.learningPath.manageLabel")}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        ) : paths.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("scheduler.taskWorkbench.learningPath.emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t("scheduler.taskWorkbench.learningPath.emptyDescription")}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={startLearningForGraph.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles size={13} />
                {startLearningForGraph.isPending
                  ? t("scheduler.taskWorkbench.learningPath.generating")
                  : t("scheduler.taskWorkbench.learningPath.generateDefault")}
              </button>
              <button
                type="button"
                onClick={() => setAiWizardOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/30 transition-colors"
              >
                <Wand2 size={13} />
                {t("scheduler.taskWorkbench.learningPath.aiPlan")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visiblePaths.map((path) => (
              <PathRow
                key={path.id}
                path={path}
                active={path.id === activeLearningPathId}
                onClick={() => navigate(`/learning-paths/${path.id}`)}
              />
            ))}
            {hiddenCount > 0 && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <ChevronDown size={13} />
                {t("scheduler.taskWorkbench.learningPath.moreCount", {
                  count: hiddenCount,
                })}
              </button>
            )}
            {expanded && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <ChevronUp size={13} />
                {t("scheduler.taskWorkbench.learningPath.collapse")}
              </button>
            )}
          </div>
        )}
      </section>

      {/* AI 规划向导（复用图编辑器 LearningPathWizard） */}
      <ModalShell
        isOpen={aiWizardOpen}
        onClose={() => setAiWizardOpen(false)}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl"
      >
        <LearningPathWizard
          graphId={graphId}
          onComplete={handleAiGenerate}
          onCancel={() => setAiWizardOpen(false)}
        />
      </ModalShell>

      {/* AI 生成中遮罩 */}
      <ModalShell
        isOpen={isGenerating}
        onClose={() => undefined}
        closeOnEscape={false}
        closeOnOverlayClick={false}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {t("scheduler.taskWorkbench.learningPath.aiGenerating")}
          </p>
        </div>
      </ModalShell>
    </>
  );
};

interface PathRowProps {
  path: LearningPathResponse;
  active: boolean;
  onClick: () => void;
}

const PathRow: React.FC<PathRowProps> = ({ path, active, onClick }) => {
  const { t } = useTranslation();
  const windowLabel =
    path.scheduled_start_date && path.scheduled_end_date
      ? t("scheduler.taskWorkbench.learningPath.scheduledWindow", {
          start: formatDateUtil(path.scheduled_start_date, "short-date"),
          end: formatDateUtil(path.scheduled_end_date, "short-date"),
        })
      : t("scheduler.taskWorkbench.learningPath.notScheduled");

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-500 bg-slate-50/60 dark:bg-slate-700/40 hover:border-primary-300 dark:hover:border-primary-500/40 hover:bg-primary-50/40 dark:hover:bg-primary-500/5 transition-all text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {path.title}
          </span>
          {active && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300">
              {t("scheduler.taskWorkbench.learningPath.activeBadge")}
            </span>
          )}
        </span>
        <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t("scheduler.taskWorkbench.learningPath.nodeCount", {
            completed: path.completed_nodes_count ?? 0,
            total: path.nodes_count ?? 0,
          })}
          {windowLabel ? ` · ${windowLabel}` : ""}
        </span>
      </span>
      <ChevronRight
        size={15}
        className="shrink-0 text-slate-400 dark:text-slate-500"
      />
    </button>
  );
};

export default LearningPathSection;

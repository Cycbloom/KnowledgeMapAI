import React, {
  useState,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Clock,
  ListChecks,
  BookOpen,
  GraduationCap,
  Pencil,
  ChevronRight,
  Plus,
  Network,
} from "lucide-react";
import { api } from "../../../services/api";
import { TaskSubtask } from "../../../types";
import { LEARNING_STATE_CONFIGS, type LearningState } from "@shared/types";
import { EmptyState } from "../../common/EmptyState";
import { MasteryProgressBar } from "../MasteryProgressBar";
import { useKnowledgePointMastery } from "@/hooks/useKnowledgePointMastery";
import { useQuestionConfigModal } from "@/hooks/useQuestionConfigModal";
import { useGraphData } from "../../../hooks/queries";
import { useStore } from "../../../store/useStore";
import { message } from "../../../utils/messageHelper";
import { asyncConfirm } from "@/utils/asyncConfirm";
import type {
  LoopsDecision,
  SmallLoopDecision,
} from "@/services/api/modules/scheduler/orchestrator";
import {
  learningMaterialUrl,
  studyCenterUrl,
  createQuizForGraph,
} from "@/utils/studyUrls";

const GenerateCardsModal = lazy(() =>
  import("../../Learning/GenerateCardsModal").then((module) => ({
    default: module.GenerateCardsModal,
  })),
);

interface OverviewTabProps {
  taskId: string;
  graphId?: string;
  status?: string;
  onGoSubtasks?: () => void;
  /** 由宿主（TaskWorkbench）在深度拓展完成后递增，触发本组件重载子任务列表 */
  subtaskReloadKey?: number;
  /** 批量深度拓展创建的后台任务 id 上报给宿主，供其监听完成后再刷新 */
  onExpansionTasksCreated?: (taskIds: string[]) => void;
}

const STAGES: LearningState[] = ["learning", "review", "practice", "quiz"];

/**
 * 学习图谱「概览」：把图谱大任务当作一个用户级进程，展示大循环（大任务级）进度，
 * 并提供「当前子任务」的多个操作入口卡片。知识点子任务的详细编排归口到「子任务编排」Tab。
 */
export const OverviewTab: React.FC<OverviewTabProps> = ({
  taskId,
  graphId,
  status,
  onGoSubtasks,
  subtaskReloadKey,
  onExpansionTasksCreated,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const questionConfig = useQuestionConfigModal(graphId);
  const [loops, setLoops] = useState<LoopsDecision | null>(null);
  const [nextAction, setNextAction] = useState<
    | (NonNullable<SmallLoopDecision["nextAction"]> & {
        graphId?: string;
        url?: string;
        taskTitle?: string;
      })
    | undefined
  >(undefined);

  // —— 图谱深度拓展：批量 expand_graph 后台任务 ——
  // 复用 useGraphData 拿节点/边：识别顶层(core)节点并枚举，复用图编辑器 depth 拓展逻辑
  const { data: graphData } = useGraphData(graphId ?? "");
  const graphNodes = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const graphsEdges = useMemo(() => graphData?.edges ?? [], [graphData]);
  const coreNodes = useMemo(
    () => graphNodes.filter((n) => n?.level === "core"),
    [graphNodes],
  );
  const hasCore = coreNodes.length > 0;

  /** 深度拓展顶层(core)节点：逐个创建 expand_graph 后台任务（复用图编辑器 logic） */
  const handleDeepExpand = async () => {
    if (!graphId) return undefined;
    if (coreNodes.length === 0) return undefined;
    if (!(await asyncConfirm({
      title: t("scheduler.taskWorkbench.overview.deepExpandConfirmTitle"),
      message: t("scheduler.taskWorkbench.overview.deepExpandConfirmMsg", {
        count: coreNodes.length,
      }),
    }))) {
      return undefined;
    }

    const aiText = useStore.getState().user?.profile?.settings?.ai_config?.text;
    const provider = aiText?.provider;
    const model = aiText?.model;
    const existingTitles = graphNodes.map((n) => n.title);
    let created = 0;
    const createdTaskIds: string[] = [];
    try {
      for (const node of coreNodes) {
        // 现有子节点标题（目标节点直接出边）
        const childIds = new Set<string>();
        for (const e of graphsEdges) {
          if (e.source_knowledge_point_id === node.id) {
            childIds.add(e.target_knowledge_point_id);
          }
        }
        const childTitles = graphNodes
          .filter((n) => childIds.has(n.id))
          .map((n) => n.title);
        const createdTask = (await api.tasks.create({
          type: "expand_graph",
          payload: {
            graph_id: graphId,
            node_id: node.id,
            node_title: node.title,
            node_content: node.content,
            existing_nodes: existingTitles,
            child_nodes: childTitles,
            provider,
            model,
          },
        })) as { id?: string } | null;
        if (createdTask?.id) createdTaskIds.push(createdTask.id);
        created += 1;
      }
      // 上报创建的后台任务 id，由宿主监听全部完成后刷新任务/子任务
      if (createdTaskIds.length > 0) onExpansionTasksCreated?.(createdTaskIds);
      message.success(t("scheduler.taskWorkbench.overview.deepExpandStart", { count: created }));
    } catch (error: unknown) {
      message.error(t("scheduler.taskWorkbench.overview.deepExpandFail"));
      console.error("Failed to create expand_graph tasks:", error);
    }
    return undefined;
  };

  useEffect(() => {
    let cancelled = false;
    api.scheduler
      .getLoops()
      .then((data) => {
        if (!cancelled) setLoops(data);
      })
      .catch(() => {
        // 调度决策拉取失败不影响概览其余部分，静默降级
      });
    api.scheduler
      .getNextActionForTask(taskId)
      .then((res) => {
        if (!cancelled) setNextAction(res.action ?? undefined);
      })
      .catch(() => {
        // 同步失败降级为无推荐动作
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const loadSubtasks = async () => {
    try {
      const data = await api.scheduler.getSubtasks(taskId);
      setSubtasks(data ?? []);
    } catch {
      setSubtasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubtasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 深度拓展完成后由宿主递增 subtaskReloadKey → 重新加载子任务
  useEffect(() => {
    if (subtaskReloadKey === undefined) return;
    loadSubtasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtaskReloadKey]);

  const kpIds = useMemo(
    () => Array.from(new Set(subtasks.map((s) => s.knowledge_point_id))),
    [subtasks],
  );
  const { masteryByKp } = useKnowledgePointMastery(kpIds);

  const getStatusLabel = (raw?: string): string => {
    switch (raw) {
      case "completed":
        return t("scheduler.taskWorkbench.statusCompleted");
      case "in_progress":
        return t("scheduler.taskWorkbench.statusInProgress");
      case "paused":
        return t("scheduler.taskWorkbench.statusPaused");
      case "cancelled":
        return t("scheduler.taskWorkbench.statusCancelled");
      default:
        return t("scheduler.taskWorkbench.statusPending");
    }
  };

  // 当前正在处理的子任务：优先 in_progress，否则为下一个待处理项
  const current = useMemo(
    () =>
      (subtasks.find((s) => s.status === "in_progress") ||
        subtasks.find((s) => s.status !== "completed")) ||
      null,
    [subtasks],
  );
  const kpId = current?.knowledge_point_id;
  const currentMastery = kpId ? masteryByKp.get(kpId) : undefined;

  // 大/小循环调度决策派生（接入 getLoops）
  const bigType = loops?.big.type;
  const isReviewInterrupt = bigType === "review";
  const isThisGraphAdvancing =
    bigType === "graph" && loops?.big.graphTask?.taskId === taskId;
  const schedulerNextSubtaskTitle = isThisGraphAdvancing
    ? loops?.small?.nextSubtask?.title
    : undefined;
  const otherGraphTitle =
    bigType === "graph" && !isThisGraphAdvancing
      ? loops?.big.graphTask?.taskTitle
      : undefined;
  const reviewKpId = loops?.big.review?.knowledgePointId;
  const reviewGraphId = loops?.big.review?.graphId;
  const reviewTitle = loops?.big.review?.title;

  const completedCount = useMemo(
    () => subtasks.filter((s) => s.status === "completed").length,
    [subtasks],
  );
  const progress =
    subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

  const stageCounts = useMemo(() => {
    const counts: Record<LearningState, number> = {
      learning: 0,
      review: 0,
      practice: 0,
      quiz: 0,
    };
    for (const s of subtasks) {
      if (s.learning_state && s.learning_state in counts) {
        counts[s.learning_state]++;
      }
    }
    return counts;
  }, [subtasks]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    );
  }

  interface OverviewAction {
    key: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
    extra?: { title: string; icon: React.ReactNode; onClick: () => void };
  }

  const actions: OverviewAction[] | [] =
    current && kpId
      ? [
          {
            key: "learn",
            icon: <BookOpen size={18} className="text-primary-500" />,
            title: t("scheduler.taskWorkbench.overview.cardLearnTitle"),
            desc: t("scheduler.taskWorkbench.overview.cardLearnDesc", {
              title: current.title,
            }),
            onClick: () => navigate(learningMaterialUrl(kpId, graphId)),
          },
          {
            key: "practice",
            icon: <GraduationCap size={18} className="text-primary-500" />,
            title: t("scheduler.taskWorkbench.overview.cardPracticeTitle"),
            desc: t("scheduler.taskWorkbench.overview.cardPracticeDesc", {
              title: current.title,
            }),
            onClick: async () => {
              const cards = (await api.study.getCards({ knowledge_point_id: kpId })) ?? [];
              if (cards.length === 0) {
                // 没有题目 → 打开「题目配置」面板（练习用，区别于创建测验）
                questionConfig.openFor(kpId, current.title);
                return;
              }
              // 已有题目 → 直接打开学习中心练习
              navigate(studyCenterUrl(kpId, graphId));
            },
            // 小按钮：跳过判断，始终进入题目配置
            extra: {
              title: t("scheduler.taskWorkbench.overview.createQuestions"),
              icon: <Plus size={16} />,
              onClick: () => questionConfig.openFor(kpId, current.title),
            },
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      {/* 大循环：图谱大任务级 */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-500 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={16} className="text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t("scheduler.taskWorkbench.overview.bigLoopTitle")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {hasCore && graphId ? (
              <button
                type="button"
                onClick={() => { void handleDeepExpand(); }}
                title={t("scheduler.taskWorkbench.overview.deepExpandHint")}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/30 transition-colors"
              >
                <Network size={13} />
                {t("scheduler.taskWorkbench.overview.deepExpand")}
              </button>
            ) : null}
            <button
              onClick={() => navigate(createQuizForGraph(graphId))}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/30 transition-colors"
            >
              <Pencil size={13} />
              {t("scheduler.taskWorkbench.overview.createQuiz")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("scheduler.taskWorkbench.overview.completion")}
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
              {progress}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("scheduler.taskWorkbench.overview.subtaskProgress", {
                completed: completedCount,
                total: subtasks.length,
              })}
            </p>
            {subtasks.length > 0 && (
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 四阶段分布 */}
        <div className="flex flex-wrap gap-2">
          {STAGES.map((stage) => {
            const config = LEARNING_STATE_CONFIGS[stage];
            return (
              <span
                key={stage}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.color} ${config.borderColor}`}
              >
                {stageCounts[stage] > 0 && (
                  <span className="tabular-nums font-bold">
                    {stageCounts[stage]}
                  </span>
                )}
                {t(config.labelKey)}
              </span>
            );
          })}
          {status && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500">
              <Clock size={12} />
              {t("scheduler.taskWorkbench.overview.taskStatus", {
                status: getStatusLabel(status),
              })}
            </span>
          )}
        </div>

        {/* 调度决策条（接入大/小循环） */}
        {isReviewInterrupt && reviewKpId ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
            <span className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Clock size={13} className="shrink-0" />
              {t("scheduler.taskWorkbench.overview.schedulerReviewHint", {
                title: reviewTitle ?? "",
              })}
            </span>
            <button
              onClick={() =>
                reviewKpId && navigate(studyCenterUrl(reviewKpId, reviewGraphId))
              }
              className="shrink-0 px-2.5 py-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
            >
              {t("scheduler.taskWorkbench.overview.schedulerGoReview")}
            </button>
          </div>
        ) : isThisGraphAdvancing && schedulerNextSubtaskTitle ? (
          <div className="mt-3 text-xs text-primary-600 dark:text-primary-400 flex items-center gap-2">
            <ListChecks size={13} className="shrink-0" />
            {t("scheduler.taskWorkbench.overview.schedulerNextSubtask", {
              title: schedulerNextSubtaskTitle,
            })}
          </div>
        ) : otherGraphTitle ? (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {t("scheduler.taskWorkbench.overview.schedulerOtherGraph", {
              title: otherGraphTitle,
            })}
          </div>
        ) : bigType === "empty" ? (
          <div className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            {t("scheduler.taskWorkbench.overview.schedulerIdle")}
          </div>
        ) : null}

        {/* 执行动作：把小循环推荐的下一步直接喂给跳转 */}
        {isThisGraphAdvancing && nextAction?.url && nextAction.activity && (
          <button
            onClick={() => nextAction.url && navigate(nextAction.url)}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            {t("scheduler.taskWorkbench.overview.schedulerGoNext", {
              action: t(`learning.stageLabels.${nextAction.activity}`),
            })}
          </button>
        )}
      </section>

      {/* 当前子任务 + 多入口卡片 */}
      {subtasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={32} />}
          title={t("scheduler.taskWorkbench.overview.emptyTitle")}
          description={t("scheduler.taskWorkbench.overview.emptyDescription")}
        />
      ) : current ? (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-500 p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
            {t("scheduler.taskWorkbench.overview.currentSubtask")}
          </h3>

          {/* 当前子任务概要 */}
          <div className="mb-3 p-3 rounded-xl border border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/10">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {current.title}
              </p>
              {current.learning_state && (
                <span className="shrink-0 text-xs text-primary-700 dark:text-primary-300">
                  {t("scheduler.taskWorkbench.overview.estMinutes", {
                    count: current.estimated_duration ?? 0,
                  })}
                </span>
              )}
            </div>
            {currentMastery !== undefined && (
              <MasteryProgressBar masteryLevel={currentMastery} size="sm" showLabel />
            )}
          </div>

          {/* 操作入口卡片 */}
          <div className="space-y-2">
            {actions.map((action) => (
              <div
                key={action.key}
                className="w-full flex items-center gap-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 hover:border-primary-300 dark:hover:border-primary-500/40 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-all"
              >
                <button
                  onClick={action.onClick}
                  className="flex-1 min-w-0 flex items-center gap-3 py-0.5 text-left"
                >
                  <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-500/15">
                    {action.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">
                      {action.title}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {action.desc}
                    </span>
                  </span>
                </button>
                {action.extra && (
                  <button
                    onClick={action.extra.onClick}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                    title={action.extra.title}
                    aria-label={action.extra.title}
                  >
                    {action.extra.icon}
                  </button>
                )}
                <ChevronRight
                  size={16}
                  className="shrink-0 text-slate-400 dark:text-slate-500"
                />
              </div>
            ))}
          </div>

          {onGoSubtasks && (
            <button
              onClick={onGoSubtasks}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-xl border border-primary-200 dark:border-primary-500/30 transition-colors"
            >
              <ListChecks size={15} />
              {t("scheduler.taskWorkbench.overview.goSubtasks")}
            </button>
          )}
        </section>
      ) : null}

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

export default OverviewTab;
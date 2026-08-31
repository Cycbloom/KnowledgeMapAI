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
} from "lucide-react";
import { api } from "../../../services/api";
import { TaskSubtask } from "../../../types";
import { LEARNING_STATE_CONFIGS, type LearningState } from "@shared/types";
import { EmptyState } from "../../common/EmptyState";
import { MasteryProgressBar } from "../MasteryProgressBar";
import { useKnowledgePointMastery } from "@/hooks/useKnowledgePointMastery";
import { useLevelTestNotificationStore } from "@/store/useLevelTestNotificationStore";
import { message } from "@/utils/messageHelper";
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
import type { GenerateCardsFullConfig } from "../../Learning/GenerateCardsModal";

interface OverviewTabProps {
  taskId: string;
  graphId?: string;
  status?: string;
  onGoSubtasks?: () => void;
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
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<{
    kpId: string;
    title: string;
  } | null>(null);

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

  // 始终打开题目生成面板（跳过空题判断）
  const openGenerateModal = (kpId: string, title: string) => {
    setPendingTarget({ kpId, title });
    setIsGenModalOpen(true);
  };

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
                // 没有题目 → 打开生成题目面板
                openGenerateModal(kpId, current.title);
                return;
              }
              // 已有题目 → 直接打开学习中心练习
              navigate(studyCenterUrl(kpId, graphId));
            },
            // 小按钮：跳过判断，始终进入题目生成
            extra: {
              title: t("scheduler.taskWorkbench.overview.createQuestions"),
              icon: <Plus size={16} />,
              onClick: () => openGenerateModal(kpId, current.title),
            },
          },
        ]
      : [];

  // 生成题目：提交后台任务，成功后经全局 LevelTestNotification 弹窗提示并进入练习
  const handleGenerateCards = async (
    config: GenerateCardsFullConfig & { targetNodeIds: string[] },
  ) => {
    const target = pendingTarget;
    if (!target) return;

    const cardsPerTypeSrc = config.cardsPerType;
    const cardsPerTypeNum: Record<string, number> | undefined = cardsPerTypeSrc
      ? (() => {
          const out: Record<string, number> = {};
          for (const [k, v] of Object.entries(cardsPerTypeSrc)) {
            if (v !== undefined) out[k] = Number(v);
          }
          return Object.keys(out).length > 0 ? out : undefined;
        })()
      : undefined;

    const countPerDiffSrc = config.countPerDifficulty;
    const countPerDiffNum:
      | { easy?: number; medium?: number; hard?: number }
      | undefined = countPerDiffSrc
      ? (() => {
          const out: { easy?: number; medium?: number; hard?: number } = {};
          for (const k of ["easy", "medium", "hard"] as const) {
            const v = countPerDiffSrc[k];
            if (v !== undefined) out[k] = Number(v);
          }
          return Object.values(out).some((x) => x !== undefined) ? out : undefined;
        })()
      : undefined;

    const countMatrixSrc = config.countMatrix;
    const countMatrixNum =
      countMatrixSrc && Object.keys(countMatrixSrc).length > 0
        ? Object.fromEntries(
            Object.entries(countMatrixSrc).map(([k, v]) => [
              k,
              {
                easy: Number(v.easy ?? 0),
                medium: Number(v.medium ?? 0),
                hard: Number(v.hard ?? 0),
              },
            ]),
          )
        : undefined;

    try {
      const result = await api.ai.batchGenerateCards([target.kpId], {
        count: config.count,
        types: config.types,
        difficulty: config.difficulty,
        coverage: config.coverage,
        custom_prompt: config.customPrompt || undefined,
        cards_per_type: cardsPerTypeNum,
        count_per_difficulty: countPerDiffNum as
          | { easy?: number; medium?: number; hard?: number }
          | undefined,
        count_matrix: countMatrixNum,
      });
      if (result.success) {
        if (result.taskIds?.length) {
          setIsGenModalOpen(false);
          setPendingTarget(null);
          useLevelTestNotificationStore
            .getState()
            .startGenerationTracking(
              result.taskIds,
              target.kpId,
              graphId ?? "",
              "learning",
            );
        } else {
          message.success(t("learning.cards.taskSubmitted"));
        }
      } else {
        const errMsg = result.message || result.error || t("learning.cards.unknownError");
        message.error(t("learning.cards.submitFailed", { error: errMsg }));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("learning.cards.unknownError");
      message.error(t("learning.cards.submitFailed", { error: errorMessage }));
    }
  };

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
          <button
            onClick={() => navigate(createQuizForGraph(graphId))}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg border border-primary-200 dark:border-primary-500/30 transition-colors"
          >
            <Pencil size={13} />
            {t("scheduler.taskWorkbench.overview.createQuiz")}
          </button>
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

      {/* 生成题目面板：仅当当前子任务无题目时打开 */}
      <Suspense fallback={null}>
        <GenerateCardsModal
          isOpen={isGenModalOpen}
          onClose={() => {
            setIsGenModalOpen(false);
            setPendingTarget(null);
          }}
          onGenerate={handleGenerateCards}
          nodeTitle={pendingTarget?.title}
          graphId={graphId ?? undefined}
          selectedNodes={
            pendingTarget
              ? [{ id: pendingTarget.kpId, title: pendingTarget.title }]
              : []
          }
          graphNodes={
            pendingTarget
              ? [{ id: pendingTarget.kpId, title: pendingTarget.title }]
              : []
          }
          graphEdges={[]}
        />
      </Suspense>
    </div>
  );
};

export default OverviewTab;
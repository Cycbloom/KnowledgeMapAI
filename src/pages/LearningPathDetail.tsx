import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useNavigateBack } from "../hooks/common/useNavigateBack";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route } from "lucide-react";
import { learningPathsApi, NodeStatus, type LearningPlanResponse } from "../services/api/learningPaths";
import { pathTasksApi } from "../services/api/modules/scheduler";
import { learningPathKeys, useLearningPathPlans } from "../hooks/queries/useLearningPathQueries";
import { useError } from "../hooks";
import { useDocumentTitle } from "../hooks/common/useDocumentTitle";
import PathHeaderSection from "../components/LearningPath/PathHeaderSection";
import PathNodeListSection from "../components/LearningPath/PathNodeListSection";
import PathMilestonesSection from "../components/LearningPath/PathMilestonesSection";
import PathProgressOverview from "../components/LearningPath/PathProgressOverview";
import PathPlansSection from "../components/LearningPath/PathPlansSection";
import PathSuggestionsSection from "../components/LearningPath/PathSuggestionsSection";
import PathActionBar from "../components/LearningPath/PathActionBar";
import type {
  LearningPathDetail,
  ApiLearningPathNode,
  LearningPathNode,
  LearningPathPlan,
} from "../components/LearningPath/types";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { SkeletonCard } from "@/components/common";
import { message } from "../utils/messageHelper";

const LearningPathDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id: pathId } = useParams<{ id: string }>();
  const { goBack } = useNavigateBack();

  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["nodes", "progress", "plans"]),
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isBatchConverting, setIsBatchConverting] = useState(false);

  const queryClient = useQueryClient();
  const { handleError } = useError();

  const mapPathDetail = (result: unknown): LearningPathDetail | null => {
    if (!result) return null;
    const r = result as Record<string, unknown>;
    const nodes = (r.nodes as ApiLearningPathNode[] | undefined) ?? [];
    const mappedNodes = nodes.map((node: ApiLearningPathNode) => ({
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

    const progress = (r.progress as Record<string, number>) || {
      total_nodes: 0,
      completed_nodes: 0,
      in_progress_nodes: 0,
      pending_nodes: 0,
      skipped_nodes: 0,
      total_time_spent: 0,
      progress_percentage: 0,
    };

    return {
      id: r.id as string,
      title: r.title as string,
      description: r.description as string,
      graph_id: r.source_graph_id as string,
      graph_title: undefined,
      status: (r.status as "completed" | "paused" | "active" | "archived") || "active",
      goal_type: "natural_language",
      goal_content: r.goal as string,
      target_knowledge_point_id: undefined,
      daily_minutes_target: r.daily_minutes_target as number,
      target_completion_date: r.target_date as string,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      nodes: mappedNodes,
      milestones: [],
      plans: [],
      suggestions: [],
      progress: {
        completed_nodes: progress.completed_nodes || 0,
        total_nodes: progress.total_nodes || 0,
        total_time_spent: progress.total_time_spent || 0,
        estimated_total_time: (r.total_estimated_time as number) || 0,
        completion_percentage: progress.progress_percentage || 0,
        current_streak: 0,
        longest_streak: 0,
      },
    };
  };

  const {
    data: pathDetail,
    isLoading,
  } = useQuery({
    queryKey: learningPathKeys.mappedDetail(pathId ?? ""),
    queryFn: async () => {
      if (!pathId) throw new Error("pathId is required");
      const result = await learningPathsApi.get(pathId);
      return mapPathDetail(result);
    },
    enabled: !!pathId,
    // 学习路径详情低频变化，节点状态更新已失效该键
    staleTime: 5 * 60 * 1000,
  });

  useDocumentTitle(pathDetail?.title, t("documentTitle.suffix"));

  // 统一日计划：日历排期（learning_path_schedule）是事实源，此处直接消费派生日计划
  const { data: schedulePlansData } = useLearningPathPlans(pathId ?? "");
  const plans: LearningPathPlan[] = useMemo(() => {
    const derived = ((schedulePlansData ?? []) as LearningPlanResponse[]).map(
      (p) => ({
        id: p.id,
        date: (p.started_at ?? "").slice(0, 10),
        planned_nodes: p.planned_nodes ?? [],
        estimated_minutes: p.planned_duration,
        completed: p.status === "completed",
      }),
    );
    if (derived.length > 0) return derived;
    return pathDetail?.plans ?? [];
  }, [schedulePlansData, pathDetail]);

  const handleUpdateNodeStatus = async (nodeId: string, status: NodeStatus) => {
    if (!pathId) return;

    setIsUpdating(true);
    try {
      await learningPathsApi.updateNodeStatus(pathId, nodeId, status);
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.mappedDetail(pathId ?? "") });
      message.success(t("learningPaths.detail.nodeStatusUpdated"));
    } catch (error) {
      handleError(error, {
        context: "UpdateNodeStatus",
        fallbackMessage: t("learningPaths.detail.updateNodeStatusFailed"),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConvertToTask = async (node: LearningPathNode) => {
    if (!pathId) return;

    try {
      await pathTasksApi.convertNodeToTask({
        path_id: pathId,
        node_id: node.id,
        title: node.title,
        description: node.content,
        estimated_duration: node.estimated_minutes,
        knowledge_point_id: node.node_id,
        priority: node.difficulty_level || 2,
      });
      message.success(t("learningPaths.detail.taskCreated", { title: node.title }));
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.mappedDetail(pathId ?? "") });
    } catch (error) {
      handleError(error, {
        context: "ConvertToTask",
        fallbackMessage: t("learningPaths.detail.createTaskFailed"),
      });
    }
  };

  const handleBatchConvertToTasks = async () => {
    if (!pathId || selectedNodeIds.size === 0) return;

    setIsBatchConverting(true);
    try {
      const result = await pathTasksApi.batchConvertNodesToTasks(
        pathId,
        Array.from(selectedNodeIds)
      );

      if (result.converted_count > 0) {
        message.success(t("learningPaths.detail.batchConvertSuccess", { count: result.converted_count }));
      }

      if (result.failed_count > 0) {
        message.warning(t("learningPaths.detail.batchConvertPartialFailed", { count: result.failed_count }));
      }

      setSelectedNodeIds(new Set());
      setIsSelectionMode(false);
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.mappedDetail(pathId ?? "") });
    } catch (error) {
      handleError(error, {
        context: "BatchConvertToTasks",
        fallbackMessage: t("learningPaths.detail.batchConvertFailed"),
      });
    } finally {
      setIsBatchConverting(false);
    }
  };

  const toggleNodeSelection = (nodeId: string) => {
    const newSelected = new Set(selectedNodeIds);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedNodeIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (!pathDetail) return;

    const pendingNodes = pathDetail.nodes.filter(
      (n) => n.status === "pending" && !n.related_task_id
    );

    if (selectedNodeIds.size === pendingNodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(pendingNodes.map((n) => n.id)));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedNodeIds(new Set());
  };

  const handleAutoSchedule = async () => {
    if (!pathId || !pathDetail) return;

    setIsUpdating(true);
    try {
      const result = await learningPathsApi.autoSchedule(pathId, {
        start_date: new Date().toISOString(),
        daily_minutes: pathDetail.daily_minutes_target || 30,
      });

      message.success(t("learningPaths.detail.autoScheduleSuccess", { total: result.total_tasks, days: result.estimated_days }));

      await queryClient.invalidateQueries({ queryKey: learningPathKeys.mappedDetail(pathId ?? "") });
    } catch (error) {
      handleError(error, {
        context: "AutoSchedule",
        fallbackMessage: t("learningPaths.detail.autoScheduleFailed"),
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
      await queryClient.invalidateQueries({ queryKey: learningPathKeys.mappedDetail(pathId ?? "") });
      message.success(t("learningPaths.detail.pathStatusUpdated"));
    } catch (error) {
      handleError(error, {
        context: "UpdatePathStatus",
        fallbackMessage: t("learningPaths.detail.updateStatusFailed"),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePath = async () => {
    if (!pathId || !await asyncConfirm({ title: t('learningPaths.detail.deletePathTitle'), message: t('learningPaths.detail.deletePathConfirm'), isDangerous: true }))
      {return;}

    try {
      await learningPathsApi.delete(pathId);
      message.success(t("learningPaths.messages.deleteSuccess"));
      goBack();
    } catch (error) {
      handleError(error, {
        context: "DeletePath",
        fallbackMessage: t("learningPaths.messages.deleteFailed"),
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

  const progressPercentage = useMemo(() => {
    if (!pathDetail || !pathDetail.progress) return 0;
    return pathDetail.progress.completion_percentage || 0;
  }, [pathDetail]);

  const nodesByStatus = useMemo(() => {
    if (!pathDetail || !pathDetail.nodes)
      {return {} as Record<NodeStatus, number>;}
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <SkeletonCard lines={2} className="mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <SkeletonCard lines={5} />
              <SkeletonCard lines={3} />
            </div>
            <div className="space-y-6">
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={2} />
            </div>
          </div>
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
            {t("learningPaths.detail.pathNotExist")}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t("learningPaths.detail.pathNotExistDesc")}
          </p>
          <button
            onClick={() => goBack()}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="sr-only">{t('learningPaths.learningPathDetail.title')}</h1>
        <PathHeaderSection
          pathDetail={pathDetail}
          progressPercentage={progressPercentage}
          showActions={showActions}
          onShowActionsChange={setShowActions}
          onAutoSchedule={handleAutoSchedule}
          onUpdatePathStatus={handleUpdatePathStatus}
          onDeletePath={handleDeletePath}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <PathNodeListSection
              pathDetail={pathDetail}
              expandedSections={expandedSections}
              selectedNode={selectedNode}
              isSelectionMode={isSelectionMode}
              selectedNodeIds={selectedNodeIds}
              isUpdating={isUpdating}
              isBatchConverting={isBatchConverting}
              onToggleSection={toggleSection}
              onSelectedNodeChange={setSelectedNode}
              onSetIsSelectionMode={setIsSelectionMode}
              onToggleNodeSelection={toggleNodeSelection}
              onToggleSelectAll={toggleSelectAll}
              onExitSelectionMode={exitSelectionMode}
              onBatchConvertToTasks={handleBatchConvertToTasks}
              onUpdateNodeStatus={handleUpdateNodeStatus}
              onConvertToTask={handleConvertToTask}
            />

            <PathMilestonesSection
              milestones={pathDetail.milestones ?? []}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
            />
          </div>

          <div className="space-y-6">
            <PathProgressOverview
              pathDetail={pathDetail}
              nodesByStatus={nodesByStatus}
            />

            <PathPlansSection
              plans={plans}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
            />

            <PathSuggestionsSection
              suggestions={pathDetail.suggestions ?? []}
              expandedSections={expandedSections}
              onToggleSection={toggleSection}
            />
          </div>
        </div>

        <PathActionBar
          pathDetail={pathDetail}
          isUpdating={isUpdating}
          onAutoSchedule={handleAutoSchedule}
          onUpdatePathStatus={handleUpdatePathStatus}
          onDeletePath={handleDeletePath}
        />
      </div>
    </div>
  );
};

export default LearningPathDetailPage;

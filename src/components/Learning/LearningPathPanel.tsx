import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Route,
  Clock,
  TrendingUp,
  CheckCircle2,
  BookOpen,
  BarChart3,
  RefreshCw,
  Sparkles,
  Wand2,
  ExternalLink,
  Trash2,
  Play,
  Pause,
  Settings2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { message } from "../../utils/messageHelper";
import { useError } from "../../hooks";
import { useActivityTracker } from "../../hooks/useActivityTracker";
import { LearningPathWizard } from "./LearningPathWizard";
import {
  useLearningPaths,
  useLearningPath,
} from "../../hooks/queries/useLearningPathQueries";
import {
  useCreateLearningPathMutation,
  useDeleteLearningPathMutation,
  useUpdateLearningPathMutation,
} from "../../hooks/mutations/useLearningPathMutations";
import { LearningPathStatus } from "../../services/api/learningPaths";

interface LearningPathStage {
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  level: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  estimatedTime: number;
  prerequisites: string[];
  isCompleted: boolean;
  masteryLevel: number;
  nextReviewDate: string | null;
}

interface TempLearningPath {
  graphId: string;
  graphTitle: string;
  totalNodes: number;
  completedNodes: number;
  estimatedTotalTime: number;
  stages: LearningPathStage[];
  todayPlan: LearningPathStage[];
  predictions: {
    completionDate: string;
    weeklyProgress: number[];
    recommendedDailyTime: number;
  };
  suggestions: string[];
  aiGenerated?: boolean;
  targetGoal?: string;
}

interface SavedLearningPath {
  id: string;
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  total_estimated_time: number;
  ai_generated: boolean;
  status: LearningPathStatus;
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes_count?: number;
  completed_nodes_count?: number;
  progress_percentage?: number;
}

interface LearningPathPanelProps {
  graphId: string;
  onNodeSelect?: (nodeId: string) => void;
  onPathSelect?: (pathId: string | null) => void;
  selectedPathId?: string | null;
  onStartNarrative?: () => void;
}

type ViewMode = "list" | "create" | "wizard" | "detail";

export const LearningPathPanel: React.FC<LearningPathPanelProps> = ({
  graphId,
  onNodeSelect,
  onPathSelect,
  selectedPathId,
  onStartNarrative,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tempPath, setTempPath] = useState<TempLearningPath | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [selectedPath, setSelectedPath] = useState<SavedLearningPath | null>(
    null,
  );
  const [selectedStyle, setSelectedStyle] = useState<
    "sequential" | "exploratory" | "focused" | "custom"
  >("sequential");
  const [dailyTime, setDailyTime] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { handleError } = useError();
  const { recordActivity } = useActivityTracker();

  const { data: savedPaths = [], isLoading: isLoadingPaths } =
    useLearningPaths();
  const { data: selectedPathDetail } = useLearningPath(selectedPathId || "");
  const createMutation = useCreateLearningPathMutation();
  const deleteMutation = useDeleteLearningPathMutation();
  const updateMutation = useUpdateLearningPathMutation();

  const graphPaths = savedPaths.filter(
    (p: SavedLearningPath) => p.source_graph_id === graphId,
  );

  useEffect(() => {
    if (
      graphId &&
      graphPaths.length === 0 &&
      !tempPath &&
      !hasInitialized &&
      !isLoadingPaths
    ) {
      setHasInitialized(true);
      generateTempPath();
    }
  }, [graphId, graphPaths.length, tempPath, hasInitialized, isLoadingPaths]);

  if (!graphId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Route className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-sm">{t("learning.learningPath.selectGraph")}</p>
      </div>
    );
  }

  const generateTempPath = async () => {
    setIsGenerating(true);
    try {
      const result = await api.learningPath.generate({
        graph_id: graphId,
        learning_style: selectedStyle,
        daily_time_minutes: dailyTime,
      }) as TempLearningPath;
      setTempPath(result);
    } catch (error) {
      handleError(error, {
        context: "LearningPath",
        fallbackMessage: t("learning.learningPath.generateFailed"),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWizardComplete = async (data: {
    targetGoal: string;
    currentKnowledge: Record<string, string>;
    learningStyle: "sequential" | "exploratory" | "focused";
    dailyTimeMinutes: number;
  }) => {
    setIsGenerating(true);
    setGenerationStep(t("learning.learningPath.analyzingGraph"));
    message.info(t("learning.learningPath.aiAnalyzing"));

    try {
      const knowledgeStr = Object.entries(data.currentKnowledge)
        .map(([k, v]) => `${k}: ${v}`)
        .join("；");

      setGenerationStep(t("learning.learningPath.planningPath"));
      const result = await api.learningPath.generate({
        graph_id: graphId,
        learning_style: data.learningStyle,
        daily_time_minutes: data.dailyTimeMinutes,
        target_goal: data.targetGoal,
        current_knowledge: knowledgeStr,
      }) as TempLearningPath;

      setGenerationStep(t("learning.learningPath.optimizingOrder"));
      setTempPath(result);
      setViewMode("create");
      message.success(t("learning.learningPath.pathGenerated"));
    } catch (error) {
      handleError(error, {
        context: "AIPath",
        fallbackMessage: t("learning.learningPath.aiGenerateFailed"),
      });
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleSavePath = async () => {
    if (!tempPath) return;

    setIsGenerating(true);
    try {
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const nodes = tempPath.stages.map((stage, index) => ({
        knowledge_point_id: stage.nodeId,
        order_index: index,
        title: stage.nodeTitle,
        description: stage.reason,
        estimated_time: stage.estimatedTime,
        is_milestone: stage.priority === "high",
        prerequisites: stage.prerequisites.filter((id) => uuidPattern.test(id)),
      }));

      await createMutation.mutateAsync({
        title: tempPath.targetGoal || `学习路径 - ${tempPath.graphTitle}`,
        description: t("learning.learningPath.pathDescription", {
          hours: Math.round(tempPath.estimatedTotalTime / 60),
        }),
        goal: tempPath.targetGoal,
        source_graph_id: graphId,
        total_estimated_time: tempPath.estimatedTotalTime,
        ai_generated: tempPath.aiGenerated || true,
        daily_minutes_target: dailyTime,
        nodes,
      });

      setTempPath(null);
      setViewMode("list");
      message.success(t("learning.learningPath.pathSaved"));
    } catch (error) {
      handleError(error, {
        context: "SavePath",
        fallbackMessage: t("learning.learningPath.saveFailed"),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeletePath = async (pathId: string) => {
    if (!await asyncConfirm({ title: t('common.confirm.deleteTitle'), message: t("learning.learningPath.confirmDelete"), isDangerous: true })) return;

    try {
      await deleteMutation.mutateAsync(pathId);
      message.success(t("learning.learningPath.pathDeleted"));
      if (selectedPath?.id === pathId) {
        setSelectedPath(null);
      }
    } catch (error) {
      handleError(error, {
        context: "DeletePath",
        fallbackMessage: t("learning.learningPath.deleteFailed"),
      });
    }
  };

  const handleToggleStatus = async (path: SavedLearningPath) => {
    const newStatus = path.status === "active" ? "paused" : "active";
    try {
      await updateMutation.mutateAsync({
        id: path.id,
        data: { status: newStatus },
      });
      message.success(
        newStatus === "active"
          ? t("learning.learningPath.pathResumed")
          : t("learning.learningPath.pathPaused"),
      );
    } catch (error) {
      handleError(error, {
        context: "UpdateStatus",
        fallbackMessage: t("learning.learningPath.updateFailed"),
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 bg-red-50 dark:bg-red-900/20";
      case "medium":
        return "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
      case "low":
        return "text-green-500 bg-green-50 dark:bg-green-900/20";
      default:
        return "text-gray-500 bg-gray-50 dark:bg-gray-900/20";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return t("learning.learningPath.priorityHigh");
      case "medium":
        return t("learning.learningPath.priorityMedium");
      case "low":
        return t("learning.learningPath.priorityLow");
      default:
        return priority;
    }
  };

  const getStatusBadge = (status: LearningPathStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {t("learning.learningPath.statusActive")}
          </span>
        );
      case "paused":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            {t("learning.learningPath.statusPaused")}
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
            {t("learning.learningPath.statusCompleted")}
          </span>
        );
      case "archived":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            {t("learning.learningPath.statusArchived")}
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoadingPaths && graphPaths.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const learningStyles: Array<{ value: "sequential" | "exploratory" | "focused" | "custom"; label: string }> = [
    { value: "sequential", label: t("learning.learningPath.styleSequential") },
    {
      value: "exploratory",
      label: t("learning.learningPath.styleExploratory"),
    },
    { value: "focused", label: t("learning.learningPath.styleFocused") },
    { value: "custom", label: t("learning.learningPath.styleCustom") },
  ];

  const renderToolbar = () => (
    <div className="sticky top-0 z-20 rounded-lg border bg-gray-50 dark:bg-slate-900/95 backdrop-blur-md border-gray-200 dark:border-slate-500 shadow-sm mx-0 mb-4">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t("learning.learningPath.title")}
            </h2>
            {graphPaths.length > 0 && (
              <p className="text-sm text-gray-500">
                {t("learning.learningPath.pathCount", { count: graphPaths.length })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("wizard")}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gradient-to-r from-primary-500 to-pink-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600"
          >
            <Wand2 size={14} />
            {t("learning.learningPath.aiPlan")}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <Settings2 size={20} />
          </button>
          {graphPaths.length > 0 && (
            <button
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <BarChart3 size={20} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-slate-500 overflow-hidden"
          >
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("learning.learningPath.learningStyle")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {learningStyles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setSelectedStyle(style.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        selectedStyle === style.value
                          ? "bg-primary-500 text-white"
                          : "bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("learning.learningPath.dailyTime", {
                    minutes: dailyTime,
                  })}
                </label>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={10}
                  value={dailyTime}
                  onChange={(e) => setDailyTime(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <button
                onClick={() => generateTempPath()}
                className="w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                {t("learning.learningPath.generatePreview")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="learning-path-panel h-full flex flex-col space-y-4 relative overflow-hidden">
      {renderToolbar()}
      {isGenerating && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <RefreshCw className="w-12 h-12 animate-spin text-primary-500" />
              <Sparkles className="w-5 h-5 text-primary-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {generationStep || t("learning.learningPath.generating")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("learning.learningPath.aiPlanning")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}
      {viewMode === "wizard" ? (
        <LearningPathWizard
          graphId={graphId}
          onComplete={handleWizardComplete}
          onCancel={() => setViewMode("list")}
        />
      ) : viewMode === "create" && tempPath ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-pink-500 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t("learning.learningPath.previewPath")}
                </h2>
                <p className="text-sm text-gray-500">{tempPath.graphTitle}</p>
              </div>
            </div>
          </div>

          {tempPath.aiGenerated && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex-shrink-0">
              <Sparkles size={14} className="text-primary-500" />
              <span className="text-xs text-primary-600 dark:text-primary-400">
                {t("learning.learningPath.aiGeneratedTarget", {
                  goal: tempPath.targetGoal,
                })}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 flex-shrink-0">
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary-500">
                {tempPath.totalNodes}
              </div>
              <div className="text-xs text-gray-500">
                {t("learning.learningPath.totalNodes")}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-500">
                {tempPath.completedNodes}
              </div>
              <div className="text-xs text-gray-500">
                {t("learning.learningPath.mastered")}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary-500">
                {Math.round(tempPath.estimatedTotalTime / 60)}h
              </div>
              <div className="text-xs text-gray-500">
                {t("learning.learningPath.estimatedTime")}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {tempPath.stages.slice(0, 8).map((stage, index) => (
              <div
                key={stage.nodeId}
                onClick={() => onNodeSelect?.(stage.nodeId)}
                className="flex items-center gap-3 p-2 bg-white dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600"
              >
                <div className="text-xs text-gray-400 w-6">{index + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {stage.nodeTitle}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {stage.estimatedTime}
                  {t("learning.learningPath.minutes")}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(stage.priority)}`}
                >
                  {getPriorityLabel(stage.priority)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setViewMode("wizard")}
              className="flex-1 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
            >
              {t("learning.learningPath.replan")}
            </button>
            <button
              onClick={handleSavePath}
              disabled={isGenerating}
              className="flex-1 py-2 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t("learning.learningPath.saving")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t("learning.learningPath.savePath")}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {graphPaths.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
              <div className="space-y-2">
                {graphPaths.map((path) => {
                  const isSelected = selectedPathId === path.id;

                  return (
                    <div
                      key={path.id}
                      className={`bg-white dark:bg-slate-700 rounded-lg transition-all ${
                        isSelected ? "ring-2 ring-primary-500" : ""
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Route className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {path.title}
                            </span>
                            {getStatusBadge(path.status)}
                          </div>
                        </div>

                        {path.description && (
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                            {path.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {t("learning.learningPath.nodeCount", {
                              count: path.nodes_count || 0,
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round((path.total_estimated_time || 0) / 60)}h
                          </span>
                          {path.progress_percentage !== undefined && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {path.progress_percentage}%
                            </span>
                          )}
                        </div>

                        {path.progress_percentage !== undefined &&
                          path.progress_percentage > 0 && (
                            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3">
                              <div
                                className="h-full bg-gradient-to-r from-primary-500 to-primary-500"
                                style={{
                                  width: `${path.progress_percentage}%`,
                                }}
                              />
                            </div>
                          )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (isSelected) {
                                onPathSelect?.(null);
                              } else {
                                onPathSelect?.(path.id);
                              }
                            }}
                            className={`flex-1 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                              isSelected
                                ? "bg-gray-500 text-white hover:bg-gray-600"
                                : "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                            }`}
                          >
                            <Route className="w-3 h-3" />
                            {isSelected
                              ? t("learning.learningPath.deselect")
                              : t("learning.learningPath.switchToPath")}
                          </button>
                          {isSelected && onStartNarrative && (
                            <button
                              onClick={onStartNarrative}
                              className="py-1.5 px-2 text-xs rounded flex items-center justify-center gap-1 transition-colors bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                              title={t("graphEditor.narrative.startNarrative", "叙事播放")}
                            >
                              <Play className="w-3 h-3" />
                              {t("graphEditor.narrative.startNarrative", "叙事播放")}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              window.open(
                                `/learning-paths/${path.id}`,
                                "_blank",
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-slate-600"
                            title={t("learning.learningPath.viewDetails")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(path)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-slate-600"
                            title={
                              path.status === "active"
                                ? t("learning.learningPath.pause")
                                : t("learning.learningPath.resume")
                            }
                          >
                            {path.status === "active" ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePath(path.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t("learning.learningPath.delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {isSelected &&
                          selectedPathDetail?.nodes &&
                          selectedPathDetail.nodes.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
                                {t("learning.learningPath.learningOrder")}
                              </div>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {selectedPathDetail.nodes.map(
                                  (node, index) => {
                                    const nodeStatus = node.status || "pending";
                                    const isCompleted =
                                      nodeStatus === "completed";
                                    const isInProgress =
                                      nodeStatus === "in_progress";

                                    return (
                                      <div
                                        key={node.id}
                                        onClick={() => {
                                          const kpId =
                                            node.knowledge_point_id || node.id;
                                          if (kpId) {
                                            const progressMap: Record<
                                              string,
                                              number
                                            > = {
                                              completed: 100,
                                              in_progress: 50,
                                              pending: 0,
                                              skipped: 0,
                                            };
                                            recordActivity({
                                              activity_type: "path_progress",
                                              title: `学习路径进展: ${node.title}`,
                                              knowledge_point_id: kpId,
                                              graph_id: graphId,
                                              metadata: {
                                                path_id: path.id,
                                                node_id: node.id,
                                                progress:
                                                  progressMap[node.status ?? 'pending'] ?? 0,
                                              },
                                            });
                                            onNodeSelect?.(kpId);
                                          }
                                        }}
                                        className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                      >
                                        <div
                                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                            isCompleted
                                              ? "bg-green-500 text-white"
                                              : isInProgress
                                                ? "bg-primary-500 text-white"
                                                : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                                          }`}
                                        >
                                          {isCompleted ? (
                                            <CheckCircle2 className="w-3 h-3" />
                                          ) : (
                                            index + 1
                                          )}
                                        </div>
                                        <span className="text-xs text-gray-700 dark:text-gray-200 truncate flex-1">
                                          {node.title}
                                        </span>
                                        {node.estimated_time && (
                                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5" />
                                            {node.estimated_time}
                                            {t("learning.learningPath.min")}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <Route className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t("learning.learningPath.noLearningPath")}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {t("learning.learningPath.useAIToCreate")}
              </p>
              <button
                onClick={() => setViewMode("wizard")}
                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg text-sm hover:from-primary-600 hover:to-primary-600 flex items-center gap-2 mx-auto"
              >
                <Wand2 className="w-4 h-4" />
                {t("learning.learningPath.startAIPlan")}
              </button>
            </div>
          )}

          {tempPath && (
            <div className="border-t dark:border-slate-500 pt-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("learning.learningPath.previewPath")}
                </span>
                <button
                  onClick={() => setTempPath(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {t("learning.learningPath.clear")}
                </button>
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                    {tempPath.targetGoal ||
                      t("learning.learningPath.aiGeneratedPath")}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-primary-600 dark:text-primary-400 mb-2">
                  <span>
                    {t("learning.learningPath.knowledgePoints", {
                      count: tempPath.totalNodes,
                    })}
                  </span>
                  <span>
                    {t("learning.learningPath.hours", {
                      hours: Math.round(tempPath.estimatedTotalTime / 60),
                    })}
                  </span>
                </div>
                <button
                  onClick={handleSavePath}
                  disabled={isGenerating}
                  className="w-full py-1.5 bg-primary-500 text-white rounded text-xs hover:bg-primary-600 disabled:opacity-50"
                >
                  {isGenerating
                    ? t("learning.learningPath.saving")
                    : t("learning.learningPath.saveThisPath")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LearningPathPanel;

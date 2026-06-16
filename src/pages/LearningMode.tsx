import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Microscope,
  MessageSquare,
  Bot,
  Loader2,
  Sparkles,
  GraduationCap,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Network,
  Sun,
  Moon,
  BrainCircuit,
  Home,
  X,
  Plus,
  Route,
  MessageCircle,
  Brain,
  Settings,
  FileText,
  GitMerge,
  ChevronDown,
  Zap,
  Eye,
  Layers,
  FileCheck,
  Info,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLearningSettingsStore } from "../store/useLearningSettingsStore";
import { LearningSettingsPanel } from "../components/Learning/LearningSettingsPanel";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { message as msgHelper } from "../utils/messageHelper";
import {
  useTheme,
  useNetworkStatus,
  useAILanguage,
  useQuoteShortcut,
} from "../hooks";
import { useGraph, useGraphData, useGraphNodeStatus } from "../hooks/queries";
import { useTimerStore } from "../store/useTimerStore";
import {
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
} from "../utils/errors";
import { isCapacitorMobile } from "../config/mobileApiConfig";
import { mobileAIService, AICardGenError } from "../services/mobile/aiService";
import { getMobileSupabaseClient } from "../lib/supabase";
import { GraphOutline } from "../components/GraphEditor/panels/GraphOutline";
import { GenerateCardsModal } from "../components/Learning/GenerateCardsModal";
import { LearningPathPanel } from "../components/Learning/LearningPathPanel";
import { LearningPathOutline } from "../components/Learning/LearningPathOutline";
import { LearningFocusPanel } from "../components/Learning/LearningFocusPanel";
import { HighlightedReader } from "../components/Learning/HighlightedReader";
import { GraphOverviewPanel } from "../components/Learning/GraphOverviewPanel";
import { GraphOverviewEditModal } from "../components/Learning/GraphOverviewEditModal";
import { LiteratureExtractPanel } from "../components/LiteratureExtract/LiteratureExtractPanel";
import { RAGChatPanel, addQuote } from "../components/RAGChat";
import { NodeLevel, Keyword } from "../types";
import { useFocusStore } from "../store/useFocusStore";
import { useActivityTracker } from "../hooks/useActivityTracker";
import { schedulerApi } from "../services/api";
import type { StudyMode } from "../../shared/types/scheduler";
import {
  STUDY_MODE_PRESETS,
  DEFAULT_STUDY_MODE,
} from "../../shared/constants/studyModePresets";

const ConceptAggregationPanel = lazy(() =>
  import("../components/ConceptAggregation/ConceptAggregationPanel").then(
    (module) => ({ default: module.ConceptAggregationPanel }),
  ),
);

type OutlineMode = "graph" | "learning-path";

export const LearningMode = () => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { language: aiLanguage } = useAILanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get("node_id");
  const graphId = searchParams.get("graph_id");

  const [nodeTitle, setNodeTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 1280);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const isOnline = useNetworkStatus();

  const [isCreateNodeModalOpen, setIsCreateNodeModalOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<
    "chat" | "learning-path" | "literature-extract" | "concept-aggregation"
  >("chat");

  useQuoteShortcut({
    onAddQuote: addQuote,
    isChatOpen: isChatOpen && rightPanelMode === "chat",
    onOpenChat: () => {
      if (!isChatOpen) setIsChatOpen(true);
      if (rightPanelMode !== "chat") setRightPanelMode("chat");
    },
  });

  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeContent, setNewNodeContent] = useState("");
  const [newNodeLevel, setNewNodeLevel] = useState<NodeLevel>("leaf");
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string>("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [outlineMode, setOutlineMode] = useState<OutlineMode>("graph");
  const [selectedLearningPathId, setSelectedLearningPathId] = useState<
    string | null
  >(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOverviewEditModalOpen, setIsOverviewEditModalOpen] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>(DEFAULT_STUDY_MODE);
  const [isStudyModeDropdownOpen, setIsStudyModeDropdownOpen] = useState(false);
  const [linkedTask, setLinkedTask] = useState<{
    mainTaskId: string;
    graphName: string;
    totalNodes: number;
    completedNodes: number;
    progress: number;
    subtaskId?: string;
  } | null>(null);
  const { fontSize, readingMode, contentWidthMode } =
    useLearningSettingsStore();
  const queryClient = useQueryClient();

  const startFocusTimer = useTimerStore((s) => s.start);
  const completeFocusTimer = useTimerStore((s) => s.complete);
  const focusTaskId = useTimerStore((s) => s.taskId);
  const isFocusTimerActive = useTimerStore((s) => s.isActive);

  useEffect(() => {
    if (nodeId && !focusTaskId && !isFocusTimerActive) {
      startFocusTimer(nodeId, 25);
    }
  }, [nodeId, focusTaskId, isFocusTimerActive, startFocusTimer]);

  useEffect(() => {
    if (nodeId && nodeTitle) {
      activityRef.current = true;
      activityFnsRef.current.startActivity(
        "focus_study",
        `阅读学习资料: ${nodeTitle}`,
        {
          knowledge_point_id: nodeId,
          task_id: linkedTask?.mainTaskId,
        },
      );
    }
    return () => {
      if (activityRef.current) {
        activityFnsRef.current.endActivity();
        activityRef.current = false;
      }
    };
  }, [nodeId, nodeTitle, linkedTask?.mainTaskId]);

  useEffect(() => {
    if (!graphId) return;

    const fetchLinkedTask = async () => {
      try {
        const result = await schedulerApi.linkTaskForGraph(graphId);
        if (result?.data) {
          const data = result.data;
          setLinkedTask({
            mainTaskId: data.mainTaskId,
            graphName: data.graphName,
            totalNodes: data.totalNodes,
            completedNodes: data.completedNodes,
            progress:
              data.totalNodes > 0
                ? Math.round((data.completedNodes / data.totalNodes) * 100)
                : 0,
            subtaskId: data.subtasks?.find(
              (s: { knowledgePointId: string }) =>
                s.knowledgePointId === nodeId,
            )?.id,
          });
        }
      } catch (error) {
        console.error("Failed to link task:", error);
      }
    };

    fetchLinkedTask();
  }, [graphId, nodeId]);

  const [generateProgress, setGenerateProgress] = useState<{
    current: number;
    total: number;
    isGenerating: boolean;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    enterFocusMode,
    exitFocusMode,
    highlightEnabled,
    setHighlightEnabled,
  } = useFocusStore();
  const { startActivity, endActivity } = useActivityTracker();
  const activityRef = useRef(false);
  const activityFnsRef = useRef({ startActivity, endActivity });
  activityFnsRef.current = { startActivity, endActivity };

  const handleSelectLearningPath = (pathId: string | null) => {
    if (pathId) {
      setSelectedLearningPathId(pathId);
      setOutlineMode("learning-path");
      setSelectedNodeIds(new Set());
    }
  };

  const handleBackToGraphOutline = () => {
    setOutlineMode("graph");
    setSelectedLearningPathId(null);
  };

  const handleStudyModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
    setIsStudyModeDropdownOpen(false);
  };

  const getStudyModeIcon = (mode: StudyMode) => {
    const iconMap: Record<StudyMode, typeof Zap> = {
      drill: Zap,
      deep: BookOpen,
      preview: Eye,
      review: RefreshCw,
      quiz: FileCheck,
      mixed: Layers,
    };
    return iconMap[mode];
  };

  const shouldShowArticle = (): boolean => {
    const stages = STUDY_MODE_PRESETS[studyMode]?.workflow.stages ?? [];
    return stages.includes("learn");
  };

  const shouldShowQuiz = (): boolean => {
    const stages = STUDY_MODE_PRESETS[studyMode]?.workflow.stages ?? [];
    return stages.includes("quiz") || stages.includes("practice");
  };

  const getStrategyHint = (
    mode: StudyMode,
    nodeStatus:
      | { mastered: boolean; due?: boolean; review_count?: number }
      | undefined,
  ): string | null => {
    if (mode !== "mixed") return null;

    if (!nodeStatus) {
      return t("learning.studyMode.strategyHintNew");
    }
    if (!nodeStatus.mastered && (nodeStatus.review_count ?? 0) < 3) {
      return t("learning.studyMode.strategyHintLow");
    }
    if (nodeStatus.mastered) {
      return t("learning.studyMode.strategyHintHigh");
    }
    return t("learning.studyMode.strategyHintMedium");
  };

  useEffect(() => {
    const handleClickOutside = () => setIsStudyModeDropdownOpen(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && !nodeId) {
      setIsOutlineOpen(true);
    }
  }, [isMobile, nodeId]);

  const { data: graphData } = useGraphData(graphId || "");
  const { data: graphMeta } = useGraph(graphId || "");
  const { data: _nodeStatus } = useGraphNodeStatus(graphId || "");

  const handleGenerateCards = async (targetNodeId: string) => {
    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([targetNodeId], {
        count: 10,
        types: [
          "qa",
          "choice",
          "true_false",
          "multi_choice",
          "fill_in_the_blank",
        ],
      });

      if (result.success) {
        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("learning.cards.taskSubmitted"),
          duration: 5000,
          action: {
            label: t("learning.cards.viewTasks"),
            onClick: () => navigate("/tasks"),
          },
        });
      }
    } catch (cardError) {
      console.error("Failed to generate cards:", cardError);
      msgHelper.error(t("learning.cards.generateFailed"));
    } finally {
      setIsGeneratingCards(false);
    }
  };

  useEffect(() => {
    if (!nodeId) {
      setNodeTitle("");
      setArticleContent("");
      setKeywords([]);
      return;
    }

    const loadData = async () => {
      try {
        setIsGenerating(true);

        const node = await api.nodes.get(nodeId);

        if (!node) {
          msgHelper.error(t("learning.node.loadFailed"));
          return;
        }

        setNodeTitle(node.title || "");
        setKeywords(node.keywords || []);

        if (
          node.learning_material &&
          node.learning_material.trim().length > 0
        ) {
          setArticleContent(node.learning_material);

          setIsGenerating(false);
          return;
        }

        const response = await api.ai.generateLearningMaterial({
          topic: node.title || "",
          context: node.content,
          level: node.level,
          graph_id: graphId || undefined,
          language: aiLanguage,
        });

        if (response.content) {
          setArticleContent(response.content);
          const responseKeywords = response.keywords || [];
          setKeywords(responseKeywords);

          try {
            await api.nodes.update(nodeId, {
              learning_material: response.content,
              keywords: responseKeywords,
            });

            frontendEventBus.publish("message_show", {
              type: "success",
              content: t("learning.material.generated"),
              duration: 8000,
              action: {
                label: t("learning.material.generateCards"),
                onClick: () => handleGenerateCards(nodeId),
              },
            });
          } catch (saveError) {
            console.error("Failed to save learning material:", saveError);
            msgHelper.error(t("learning.material.saveFailed"));
          }
        } else {
          msgHelper.error(t("learning.material.aiFailed"));
        }
      } catch (error) {
        console.error("Failed to load learning material:", error);
        msgHelper.error(t("learning.material.generateFailed"));
      } finally {
        setIsGenerating(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const handleCreateNode = async () => {
    if (!graphId || !newNodeTitle.trim()) {
      msgHelper.warning(t("learning.node.enterTitle"));
      return;
    }

    try {
      const newNode = await api.nodes.create({
        graph_id: graphId,
        title: newNodeTitle,
        content: newNodeContent,
        x_position: Math.round((Math.random() - 0.5) * 20),
        y_position: Math.round((Math.random() - 0.5) * 20),
        level: newNodeLevel,
        properties: {},
      });

      if (selectedParentNodeId) {
        await api.edges.create({
          source_knowledge_point_id: selectedParentNodeId,
          target_knowledge_point_id: newNode.id,
          graph_id: graphId,
          relationship_type: "contains",
        });
      }

      msgHelper.success(t("learning.node.createSuccess"));

      setNewNodeTitle("");
      setNewNodeContent("");
      setNewNodeLevel("leaf");
      setSelectedParentNodeId("");
      setIsCreateNodeModalOpen(false);

      queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });
      queryClient.invalidateQueries({
        queryKey: ["graphLearningPath", graphId],
      });

      if (graphData) {
        navigate(`/learning?graph_id=${graphId}&node_id=${newNode.id}`);
      }
    } catch (error) {
      console.error("Failed to create node:", error);
      msgHelper.error(t("learning.node.createFailed"));
    }
  };

  const handleStartChallenge = async () => {
    if (!nodeId || !graphId) {
      msgHelper.warning(t("learning.challenge.missingParams"));
      return;
    }

    try {
      let taskId: string;

      const existingTask = await schedulerApi.get(nodeId).catch(() => null);

      if (existingTask?.id) {
        taskId = existingTask.id;
      } else {
        const newTask = await schedulerApi.create({
          title: nodeTitle || `学习: ${nodeId}`,
          knowledge_point_id: nodeId,
          task_type: "learning",
          queue_level: 1,
          estimated_duration: 30,
        });
        taskId = newTask.id;
      }

      await completeFocusTimer();

      await schedulerApi.createFirstReviewTask({
        knowledge_point_id: nodeId,
        task_id: taskId,
      });

      msgHelper.success(t("learning.challenge.completed"));
    } catch (error) {
      console.error("Failed to create review task:", error);
    }

    navigate(
      `/study?node_id=${nodeId}&graph_id=${graphId}&mode=quiz&from=learning`,
    );
  };

  const handleRegenerateMaterial = async () => {
    if (!nodeId || !graphId) {
      msgHelper.warning(t("learning.challenge.missingParams"));
      return;
    }

    if (!isOnline) {
      msgHelper.error(t("learning.material.regenerateOffline"));
      return;
    }

    setIsGenerating(true);
    setArticleContent("");

    try {
      const node = await api.nodes.get(nodeId);

      const response = await api.ai.generateLearningMaterial({
        topic: node.title || "",
        context: node.content,
        level: node.level,
        graph_id: graphId,
        language: aiLanguage,
      });

      if (response.content) {
        setArticleContent(response.content);
        setKeywords(response.keywords || []);

        await api.nodes.update(nodeId, {
          learning_material: response.content,
          keywords: response.keywords || [],
        });

        queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });

        msgHelper.success(t("learning.material.regenerated"));
      }
    } catch (error) {
      console.error("Failed to regenerate learning material:", error);
      msgHelper.error(t("learning.material.regenerateFailed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualGenerateCards = async (config: {
    count: number;
    types: string[];
  }) => {
    if (!nodeId) {
      msgHelper.warning(t("learning.cards.selectNode"));
      return;
    }

    if (!isOnline) {
      msgHelper.error(t("learning.cards.offline"));
      return;
    }

    const isMobile = isCapacitorMobile();

    if (isMobile) {
      if (!mobileAIService.isConfigured()) {
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.cards.configureApiKey"),
          action: {
            label: t("learning.cards.goToSettings"),
            onClick: () => navigate("/settings?tab=ai"),
          },
        });
        return;
      }

      setIsGeneratingCards(true);
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const client = getMobileSupabaseClient();
        if (!client) {
          throw new Error("Supabase client not initialized");
        }

        const { data: graphNodes, error: gnError } = await client
          .from("graph_nodes")
          .select(
            `
            knowledge_point_id,
            graph_id,
            knowledge_points (
              id,
              title,
              content
            )
          `,
          )
          .eq("knowledge_point_id", nodeId)
          .is("deleted_at", null);

        if (gnError) {
          console.error("查询 graph_nodes 失败:", gnError);
          msgHelper.error(t("learning.cards.queryFailed"));
          return;
        }

        if (!graphNodes || graphNodes.length === 0) {
          msgHelper.error(t("learning.cards.nodeNotFound"));
          return;
        }

        const graphNode = graphNodes[0] as unknown as {
          knowledge_point_id: string;
          graph_id: string;
          knowledge_points?: {
            id: string;
            title?: string | null;
            content?: string | null;
          } | null;
        };

        const node = {
          knowledge_point_id: graphNode.knowledge_point_id,
          graph_id: graphNode.graph_id,
          title: graphNode.knowledge_points?.title || "",
          content: graphNode.knowledge_points?.content || "",
        };

        const totalCards = config.count;
        setGenerateProgress({
          current: 0,
          total: totalCards,
          isGenerating: true,
        });

        let generatedCount = 0;
        let savedCount = 0;
        const batchSize = 3;
        const batches = Math.ceil(totalCards / batchSize);

        for (let i = 0; i < batches; i++) {
          if (signal.aborted) {
            msgHelper.info(
              t("learning.cards.cancelled", { count: savedCount }),
            );
            break;
          }

          const remainingCards = totalCards - generatedCount;
          const currentBatchSize = Math.min(batchSize, remainingCards);

          setGenerateProgress({
            current: generatedCount,
            total: totalCards,
            isGenerating: true,
          });

          msgHelper.info(
            t("learning.cards.generating", {
              start: generatedCount + 1,
              end: generatedCount + currentBatchSize,
              total: totalCards,
            }),
            { duration: 3000 },
          );

          try {
            const result = await mobileAIService.generateAndSaveCards(
              node.title || "",
              node.content || "",
              node.knowledge_point_id,
              node.graph_id,
              {
                types: config.types,
                count: currentBatchSize,
              },
            );

            if (result.success) {
              generatedCount += currentBatchSize;
              savedCount += result.savedCount;
              setGenerateProgress({
                current: generatedCount,
                total: totalCards,
                isGenerating: true,
              });
            }
          } catch (batchError) {
            console.error(`Batch ${i + 1} failed:`, batchError);
            msgHelper.warning(
              t("learning.cards.batchFailed", { batch: i + 1 }),
              { duration: 3000 },
            );
          }
        }

        if (!signal.aborted && savedCount > 0) {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("learning.cards.generateSuccess", { count: savedCount }),
            duration: 5000,
            action: {
              label: t("learning.cards.startChallenge"),
              onClick: handleStartChallenge,
            },
          });
        }
      } catch (error) {
        console.error("[LearningMode] 移动端题目生成异常:", error);

        const isAICardGenError = (err: unknown): err is AICardGenError => {
          return (
            typeof err === "object" &&
            err !== null &&
            "type" in err &&
            "suggestion" in err
          );
        };

        if (isAICardGenError(error)) {
          switch (error.type) {
            case "api_key_missing":
            case "api_key_invalid":
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 8000,
                action: {
                  label: t("learning.cards.goToSettings"),
                  onClick: () => navigate("/settings?tab=ai"),
                },
              });
              break;

            case "quota_exceeded":
              msgHelper.error(error.message, { duration: 8000 });
              msgHelper.info(error.suggestion, { duration: 8000 });
              break;

            case "rate_limited":
              frontendEventBus.publish("message_show", {
                type: "warning",
                content: error.message,
                duration: 5000,
                action: {
                  label: t("learning.cards.retryLater"),
                  onClick: () => setIsGenModalOpen(true),
                },
              });
              break;

            case "network_error":
            case "timeout":
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 5000,
                action: {
                  label: t("learning.cards.retry"),
                  onClick: () => handleManualGenerateCards(config),
                },
              });
              break;

            case "database_error":
              msgHelper.error(error.message, { duration: 8000 });
              frontendEventBus.publish("message_show", {
                type: "info",
                content: error.suggestion,
                duration: 8000,
                action: error.retryable
                  ? {
                      label: t("learning.cards.retry"),
                      onClick: () => handleManualGenerateCards(config),
                    }
                  : undefined,
              });
              break;

            case "invalid_response":
              frontendEventBus.publish("message_show", {
                type: "warning",
                content: error.message,
                duration: 5000,
                action: {
                  label: t("learning.cards.retry"),
                  onClick: () => handleManualGenerateCards(config),
                },
              });
              break;

            default:
              msgHelper.error(error.message, { duration: 5000 });
          }
        } else {
          let errorMessage = t("learning.cards.generateFailed");
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          frontendEventBus.publish("message_show", {
            type: "error",
            content: errorMessage,
            duration: 5000,
            action: {
              label: t("learning.cards.retry"),
              onClick: () => handleManualGenerateCards(config),
            },
          });
        }
      } finally {
        setIsGeneratingCards(false);
        setGenerateProgress(null);
        abortControllerRef.current = null;
      }
      return;
    }

    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([nodeId], {
        count: config.count,
        types: config.types,
      });

      if (result.success) {
        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("learning.cards.taskSubmitted"),
          duration: 5000,
          action: {
            label: t("learning.cards.viewTasks"),
            onClick: () => navigate("/tasks"),
          },
        });
      } else {
        const errorMsg =
          result.message || result.error || t("learning.cards.unknownError");
        console.error("[LearningMode] 任务提交失败:", errorMsg);
        msgHelper.error(t("learning.cards.submitFailed", { error: errorMsg }));
      }
    } catch (error) {
      console.error("[LearningMode] 题目生成异常:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      let errorMessage = t("learning.cards.submitFailedShort");

      if (isNetworkError(error)) {
        errorMessage = t("learning.cards.networkError");
      } else if (isAuthError(error)) {
        errorMessage = t("learning.cards.authError");
      } else if (isValidationError(error)) {
        errorMessage = t("learning.cards.validationError");
      } else if (isAppError(error)) {
        errorMessage = t("learning.cards.submitFailed", {
          error: error.message,
        });
      } else if (error instanceof Error) {
        errorMessage = t("learning.cards.submitFailed", {
          error: error.message,
        });
      }

      msgHelper.error(errorMessage);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleCancelGenerate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      msgHelper.info(t("learning.cards.cancelling"));
    }
  };

  const handleBatchAction = async (
    action:
      | "expand_graph"
      | "delete"
      | "batch_generate_questions"
      | "create_region",
    data?: Record<string, unknown>,
  ) => {
    const nodeIds = Array.from(selectedNodeIds);
    if (nodeIds.length === 0) {
      msgHelper.warning(t("learning.batch.selectNodes"));
      return;
    }

    if (action === "delete") {
      try {
        await api.nodes.batchDelete(nodeIds);
        msgHelper.success(
          t("learning.batch.deleteSuccess", { count: nodeIds.length }),
        );
        setSelectedNodeIds(new Set());
        queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });
        queryClient.invalidateQueries({
          queryKey: ["graphLearningPath", graphId],
        });
      } catch (error) {
        console.error("Batch delete failed:", error);
        msgHelper.error(t("learning.batch.deleteFailed"));
      }
    } else if (action === "expand_graph") {
      if (!isOnline) {
        msgHelper.error(t("learning.batch.expandOffline"));
        return;
      }
      try {
        const result = await api.ai.batchExpandGraph(nodeIds);
        if (result.success) {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("learning.batch.expandSuccess", {
              count: nodeIds.length,
            }),
            duration: 5000,
            action: {
              label: t("learning.cards.viewTasks"),
              onClick: () => navigate("/tasks"),
            },
          });
          setSelectedNodeIds(new Set());
        } else {
          msgHelper.error(t("learning.batch.submitFailed"));
        }
      } catch (error) {
        console.error("Batch expand failed:", error);
        msgHelper.error(t("learning.batch.expandError"));
      }
    } else if (action === "batch_generate_questions" && data) {
      if (!isOnline) {
        msgHelper.error(t("learning.cards.offline"));
        return;
      }

      setIsGeneratingCards(true);
      try {
        const result = await api.ai.batchGenerateCards(nodeIds, data);

        if (result.success) {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("learning.batch.generateSuccess", {
              count: nodeIds.length,
            }),
            duration: 5000,
            action: {
              label: t("learning.cards.viewTasks"),
              onClick: () => navigate("/tasks"),
            },
          });
          setSelectedNodeIds(new Set());
        } else {
          const errorMsg =
            result.message || result.error || t("learning.cards.unknownError");
          console.error("[LearningMode] 批量生成失败:", errorMsg);
          msgHelper.error(
            t("learning.cards.submitFailed", { error: errorMsg }),
          );
        }
      } catch (error) {
        console.error("[LearningMode] 批量生成异常:", {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        let errorMessage = t("learning.batch.generateFailed");

        if (isNetworkError(error)) {
          errorMessage = t("learning.cards.networkError");
        } else if (isAuthError(error)) {
          errorMessage = t("learning.cards.authError");
        } else if (isValidationError(error)) {
          errorMessage = t("learning.cards.validationError");
        } else if (isAppError(error)) {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        msgHelper.error(errorMessage);
      } finally {
        setIsGeneratingCards(false);
      }
    } else if (action === "create_region") {
      msgHelper.info(
        t("graphEditor.region.createRegion") + " - " + t("common.comingSoon"),
      );
    }
  };

  return (
    <div
      className={`h-screen flex flex-col ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
    >
      {/* Header */}
      <header
        className={`${isMobile && nodeId ? "min-h-14 py-2" : isMobile ? "h-14" : "h-16"} border-b flex items-center justify-between px-3 lg:px-6 flex-shrink-0 ${
          isDark
            ? "bg-slate-900 border-slate-700"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <div className="flex items-center space-x-2 lg:space-x-4">
          <button
            onClick={() => {
              if (isMobile && nodeId) {
                navigate(`/learning?graph_id=${graphId}`);
              } else {
                window.history.back();
              }
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={t("learning.header.back")}
          >
            <ArrowLeft size={isMobile ? 18 : 20} />
          </button>

          <button
            onClick={() => navigate("/")}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={t("learning.header.home")}
          >
            <Home size={isMobile ? 18 : 20} />
          </button>

          <button
            onClick={() => setIsOutlineOpen(!isOutlineOpen)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg transition-colors hidden lg:block ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={
              isOutlineOpen
                ? t("learning.header.collapseOutline")
                : t("learning.header.expandOutline")
            }
          >
            {isOutlineOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeftOpen size={20} />
            )}
          </button>

          <div className="flex items-center space-x-2">
            <div
              className={`p-1 rounded-lg ${
                graphMeta?.template_type === "topic_research"
                  ? isDark
                    ? "bg-purple-900/30 text-purple-400"
                    : "bg-purple-100 text-purple-600"
                  : isDark
                    ? "bg-primary-900/50 text-primary-400"
                    : "bg-primary-50 text-primary-600"
              }`}
            >
              {graphMeta?.template_type === "topic_research" ? (
                <Microscope size={isMobile ? 16 : 20} />
              ) : (
                <BookOpen size={isMobile ? 16 : 20} />
              )}
            </div>
            <div className={isMobile && nodeId ? "hidden sm:block" : "block"}>
              <h1 className="font-bold text-sm lg:text-lg whitespace-nowrap">
                {graphMeta?.template_type === "topic_research"
                  ? "专题研究"
                  : t("learning.header.title")}
              </h1>
              {!isMobile && (
                <p
                  className={`text-[10px] lg:text-xs ${isDark ? "text-slate-500" : "text-gray-500"} truncate max-w-[150px]`}
                >
                  {nodeTitle ||
                    (graphData
                      ? t("learning.header.selectChapter")
                      : t("learning.header.loading"))}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors xl:hidden ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={
              isChatOpen
                ? t("learning.header.hideAI")
                : t("learning.header.showAI")
            }
          >
            <MessageSquare
              size={isMobile ? 18 : 20}
              className={isChatOpen ? "text-primary-500" : ""}
            />
          </button>
        </div>

        <div
          className={`flex items-center ${isMobile && nodeId ? "gap-1" : "space-x-2 lg:space-x-3"}`}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() =>
                setIsStudyModeDropdownOpen(!isStudyModeDropdownOpen)
              }
              className={`flex items-center ${isMobile ? "gap-1 px-2 py-1.5" : "gap-1.5 px-3 py-2"} rounded-full font-medium transition-all ${
                isStudyModeDropdownOpen
                  ? isDark
                    ? "bg-primary-900/40 text-primary-400 border border-primary-500/30"
                    : "bg-primary-50 text-primary-600 border border-primary-200"
                  : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
              }`}
              title={t("learning.header.studyModeSelect")}
            >
              {(() => {
                const Icon = getStudyModeIcon(studyMode);
                return <Icon size={isMobile ? 14 : 16} />;
              })()}
              <span
                className={`text-sm ${isMobile ? "hidden" : "hidden sm:inline"}`}
              >
                {t(`learning.studyMode.${studyMode}`)}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isStudyModeDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isStudyModeDropdownOpen && (
              <div
                className={`absolute top-full right-0 mt-2 p-2 rounded-xl shadow-2xl border w-64 z-50 flex flex-col gap-1 ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-gray-100"
                    : "bg-white border-gray-200 text-gray-800"
                } animate-in fade-in zoom-in-95 duration-150`}
              >
                {(Object.keys(STUDY_MODE_PRESETS) as StudyMode[]).map(
                  (mode) => {
                    const preset = STUDY_MODE_PRESETS[mode];
                    const Icon = getStudyModeIcon(mode);
                    const isActive = studyMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => handleStudyModeChange(mode)}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isActive
                            ? isDark
                              ? "bg-primary-900/30 text-primary-400"
                              : "bg-primary-50 text-primary-600"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-300"
                              : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <Icon size={18} className="mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {preset.label}
                            </span>
                            {isActive && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  isDark
                                    ? "bg-primary-900/50 text-primary-400"
                                    : "bg-primary-100 text-primary-600"
                                }`}
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}
                          >
                            {preset.description}
                          </p>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isMobile
                ? "min-w-[36px] min-h-[36px]"
                : "min-w-[44px] min-h-[44px]"
            } ${
              isDark
                ? "hover:bg-slate-800 text-amber-400"
                : "hover:bg-gray-100 text-primary-600"
            }`}
            title={
              isDark
                ? t("learning.header.lightMode")
                : t("learning.header.darkMode")
            }
          >
            {isDark ? (
              <Sun size={isMobile ? 18 : 20} />
            ) : (
              <Moon size={isMobile ? 18 : 20} />
            )}
          </button>
          {!isMobile && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
                isMobile
                  ? "min-w-[36px] min-h-[36px]"
                  : "min-w-[44px] min-h-[44px]"
              } ${
                isDark
                  ? "hover:bg-slate-800 text-slate-400"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
              title={t("learning.header.settings")}
            >
              <Settings size={isMobile ? 18 : 20} />
            </button>
          )}

          {!isMobile && (
            <>
              <button
                onClick={() => {
                  if (nodeId && articleContent) {
                    enterFocusMode(nodeId);
                    frontendEventBus.publish("focus_enter", {
                      nodeId,
                      taskId: focusTaskId ?? undefined,
                    });
                    setIsFocusModeOpen(true);
                  }
                }}
                disabled={!nodeId || !articleContent}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  !nodeId || !articleContent
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={
                  !nodeId || !articleContent
                    ? t("learning.focus.selectContent")
                    : t("learning.focus.enter")
                }
              >
                <Brain size={18} />
                <span className="hidden sm:inline">
                  {t("learning.focus.title")}
                </span>
              </button>
              <button
                onClick={() => {
                  setRightPanelMode("learning-path");
                  setIsChatOpen(true);
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  rightPanelMode === "learning-path" && isChatOpen
                    ? "bg-primary-600 text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={t("learning.path.title")}
              >
                <Route size={18} />
                <span className="hidden sm:inline">
                  {t("learning.path.title")}
                </span>
              </button>
              <button
                onClick={() => navigate(`/graph/${graphId}`)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={t("learning.header.mindMap")}
              >
                <Network size={18} />
                <span className="hidden sm:inline">
                  {t("learning.header.mindMap")}
                </span>
              </button>
            </>
          )}

          {nodeId && shouldShowQuiz() && (
            <div className="group relative">
              <button
                onClick={() => isOnline && setIsGenModalOpen(true)}
                disabled={!isOnline || generateProgress?.isGenerating}
                className={`flex items-center ${isMobile ? "px-2 py-1.5" : "space-x-2 px-3 lg:px-4 py-2"} rounded-full font-medium transition-all ${
                  !isOnline || generateProgress?.isGenerating
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={
                  isOnline
                    ? t("learning.cards.configure")
                    : t("learning.cards.offlineUnavailable")
                }
              >
                <BrainCircuit size={isMobile ? 16 : 18} />
                <span className="hidden md:inline">
                  {t("learning.cards.generate")}
                </span>
              </button>
              {!isOnline && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {t("learning.cards.offlineUnavailable")}
                </div>
              )}
            </div>
          )}

          {nodeId && shouldShowQuiz() && (
            <div className="flex flex-col items-end">
              {generateProgress?.isGenerating && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-primary-500 animate-pulse flex items-center gap-1">
                    <Sparkles size={10} />{" "}
                    {t("learning.cards.generatingProgress", {
                      current: generateProgress.current,
                      total: generateProgress.total,
                    })}
                  </span>
                  <button
                    onClick={handleCancelGenerate}
                    className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    {t("learning.cards.cancel")}
                  </button>
                </div>
              )}
              {isGeneratingCards &&
                !generateProgress?.isGenerating &&
                !isMobile && (
                  <span className="text-[10px] text-primary-500 animate-pulse flex items-center gap-1">
                    <Sparkles size={10} />{" "}
                    {t("learning.cards.generatingChallenge")}
                  </span>
                )}
              <button
                onClick={handleStartChallenge}
                disabled={isGeneratingCards}
                className={`flex items-center justify-center ${isMobile ? "p-2" : "space-x-2 px-3 lg:px-6 py-2"} bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all ${isMobile ? "" : "hover:scale-105 active:scale-95"} ${
                  isGeneratingCards ? "opacity-70 cursor-not-allowed" : ""
                }`}
                title={t("learning.challenge.start")}
              >
                <GraduationCap size={isMobile ? 18 : 18} />
                <span className="hidden sm:inline">
                  {t("learning.challenge.complete")}
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outline Sidebar */}
        <div
          className={`${
            isMobile
              ? !nodeId
                ? "w-full"
                : "w-0"
              : isOutlineOpen
                ? "w-80"
                : "w-0"
          } transition-all duration-300 ease-in-out border-r dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 relative`}
        >
          <div className={`absolute inset-0 ${isMobile ? "w-full" : "w-80"}`}>
            {outlineMode === "learning-path" && selectedLearningPathId ? (
              <LearningPathOutline
                learningPathId={selectedLearningPathId}
                currentNodeId={nodeId || undefined}
                onNodeClick={(nodeId) =>
                  navigate(`/learning?graph_id=${graphId}&node_id=${nodeId}`)
                }
                onBackToGraph={handleBackToGraphOutline}
                className="h-full border-none"
              />
            ) : graphData ? (
              <GraphOutline
                nodes={graphData.nodes}
                edges={graphData.edges}
                onNodeClick={(node) =>
                  navigate(`/learning?graph_id=${graphId}&node_id=${node.id}`)
                }
                selectedNodeId={nodeId}
                selectedNodeIds={selectedNodeIds}
                onSelectionChange={setSelectedNodeIds}
                onBatchAction={handleBatchAction}
                onAddNode={() => setIsCreateNodeModalOpen(true)}
                templateType={graphMeta?.template_type}
                graphId={graphId ?? undefined}
                className="h-full border-none"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <Loader2 className="animate-spin mr-2" />
                {t("learning.header.loading")}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        {nodeId ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Article Reader */}
              {shouldShowArticle() ? (
                <div
                  className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "p-4" : "p-8 lg:p-12"} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900`}
                >
                  {isGenerating ? (
                    <div
                      className={`flex flex-col items-center justify-center h-full space-y-6 text-center ${isMobile ? "pt-8" : ""}`}
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles
                            size={24}
                            className="text-primary-600 animate-pulse"
                          />
                        </div>
                      </div>
                      <div>
                        <h3
                          className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
                        >
                          {t("learning.material.generating")}
                        </h3>
                        <p
                          className={
                            isDark ? "text-slate-400" : "text-gray-500"
                          }
                        >
                          {t("learning.material.generatingTopic", {
                            title: nodeTitle,
                          })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              navigate(`/learning?graph_id=${graphId}`)
                            }
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition-colors ${
                              isDark
                                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            }`}
                            title={t("learning.overview.back")}
                          >
                            <ArrowLeft size={16} />
                            <span className="hidden sm:inline">
                              {t("learning.overview.title")}
                            </span>
                          </button>
                          <div>
                            <h2
                              className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                            >
                              {nodeTitle}
                            </h2>
                            {keywords.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {keywords.slice(0, 5).map((kw, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-0.5 text-xs rounded-full ${
                                      isDark
                                        ? "bg-primary-900/30 text-primary-300"
                                        : "bg-primary-50 text-primary-600"
                                    }`}
                                  >
                                    {kw.term}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setHighlightEnabled(!highlightEnabled)
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              highlightEnabled
                                ? isDark
                                  ? "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50 border border-yellow-500/30"
                                  : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200"
                                : isDark
                                  ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                                  : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                            }`}
                            title={t("learning.enableKeywordHighlight")}
                          >
                            <Sparkles
                              size={16}
                              className={
                                highlightEnabled ? "text-yellow-500" : ""
                              }
                            />
                            <span className="hidden sm:inline">
                              {t("learning.keywordHighlight")}
                            </span>
                          </button>
                          <button
                            onClick={handleRegenerateMaterial}
                            disabled={isGenerating || !isOnline}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              isGenerating || !isOnline
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                                : isDark
                                  ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                                  : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                            }`}
                            title={
                              isOnline
                                ? t("learning.material.regenerate")
                                : t("learning.cards.offlineUnavailable")
                            }
                          >
                            <RefreshCw
                              size={16}
                              className={isGenerating ? "animate-spin" : ""}
                            />
                            <span className="hidden sm:inline">
                              {t("learning.material.regenerate")}
                            </span>
                          </button>
                        </div>
                      </div>
                      {linkedTask && (
                        <div className="mb-4 px-3 py-2 rounded-lg flex items-center gap-2 text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          <Route size={16} />
                          <span>学习图谱: {linkedTask.graphName}</span>
                          <span className="text-xs opacity-75">
                            ({linkedTask.completedNodes}/{linkedTask.totalNodes}{" "}
                            节点)
                          </span>
                          <span className="ml-auto">
                            {linkedTask.progress}%
                          </span>
                        </div>
                      )}
                      {studyMode === "mixed" &&
                        (() => {
                          const currentNodeStatus = _nodeStatus?.[nodeId ?? ""];
                          const hint = getStrategyHint(
                            studyMode,
                            currentNodeStatus,
                          );
                          return hint ? (
                            <div
                              className={`mb-4 px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${
                                isDark
                                  ? "bg-amber-900/20 text-amber-300 border border-amber-500/20"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              <Info size={16} className="flex-shrink-0" />
                              <span>{hint}</span>
                            </div>
                          ) : null;
                        })()}
                      <div
                        className={`${
                          contentWidthMode === "full"
                            ? "max-w-none"
                            : contentWidthMode === "comfortable"
                              ? "max-w-4xl mx-auto"
                              : "max-w-3xl mx-auto"
                        } ${
                          readingMode === "default"
                            ? isDark
                              ? "bg-slate-900 text-slate-50"
                              : "bg-white text-gray-900"
                            : readingMode === "eye-care"
                              ? "bg-amber-50 text-gray-800"
                              : "bg-slate-900 text-slate-50"
                        }`}
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        <HighlightedReader
                          content={articleContent}
                          isDark={isDark || readingMode === "dark"}
                          isMobile={isMobile}
                          keywords={keywords}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "p-4" : "p-8 lg:p-12"} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900 flex items-center justify-center`}
                >
                  <div className="text-center space-y-6 max-w-md">
                    <div
                      className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center ${
                        isDark ? "bg-primary-900/30" : "bg-primary-50"
                      }`}
                    >
                      {(() => {
                        const Icon = getStudyModeIcon(studyMode);
                        return (
                          <Icon
                            size={36}
                            className={
                              isDark ? "text-primary-400" : "text-primary-600"
                            }
                          />
                        );
                      })()}
                    </div>
                    <div>
                      <h3
                        className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
                      >
                        {STUDY_MODE_PRESETS[studyMode]?.label ?? studyMode}
                      </h3>
                      <p
                        className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                      >
                        {STUDY_MODE_PRESETS[studyMode]?.description ?? ""}
                      </p>
                    </div>
                    {shouldShowQuiz() && (
                      <button
                        onClick={handleStartChallenge}
                        disabled={isGeneratingCards}
                        className={`flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 ${
                          isGeneratingCards
                            ? "opacity-70 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <GraduationCap size={20} />
                        <span>{t("learning.challenge.complete")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`${isMobile ? "hidden" : "flex-1"} flex flex-col overflow-hidden`}
          >
            <GraphOverviewPanel
              graph={graphMeta || null}
              templateType={graphMeta?.template_type}
              onEdit={() => setIsOverviewEditModalOpen(true)}
            />
          </div>
        )}

        {/* Right: AI Tutor */}
        <AnimatePresence>
          {isChatOpen && (
            <>
              {/* Mobile Backdrop */}
              {isMobile && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsChatOpen(false)}
                  className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
                />
              )}
              <motion.div
                initial={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                animate={isMobile ? { x: 0 } : { width: 384, opacity: 1 }}
                exit={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  damping: 25,
                  stiffness: 200,
                }}
                className={`
                  ${isMobile ? "fixed inset-y-0 right-0 z-50 w-[85%] max-w-sm shadow-2xl" : "relative h-full border-l"} 
                  flex flex-col dark:border-slate-800 ${isDark ? "bg-slate-900" : "bg-white"}
                `}
              >
                {/* Panel Header */}
                <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
                      {rightPanelMode === "concept-aggregation" ? (
                        <GitMerge size={18} />
                      ) : rightPanelMode === "chat" ? (
                        <Bot size={18} />
                      ) : rightPanelMode === "learning-path" ? (
                        <Route size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">
                        {rightPanelMode === "concept-aggregation"
                          ? "概念聚合"
                          : rightPanelMode === "chat"
                            ? t("learning.chat.aiTutor")
                            : rightPanelMode === "learning-path"
                              ? t("learning.path.title")
                              : t("literatureExtract.title")}
                      </h3>
                      <div className="flex items-center text-[10px] text-green-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                        {rightPanelMode === "concept-aggregation"
                          ? "智能合并相似概念"
                          : rightPanelMode === "chat"
                            ? t("learning.chat.online")
                            : rightPanelMode === "learning-path"
                              ? t("learning.path.aiDriven")
                              : t("literatureExtract.subtitle")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="flex gap-1 mr-2">
                      <button
                        onClick={() => setRightPanelMode("chat")}
                        className={`p-1.5 rounded-md transition-colors ${
                          rightPanelMode === "chat"
                            ? "bg-primary-500 text-white"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title={t("learning.chat.aiTutor")}
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={() => setRightPanelMode("learning-path")}
                        className={`p-1.5 rounded-md transition-colors ${
                          rightPanelMode === "learning-path"
                            ? "bg-primary-500 text-white"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title={t("learning.path.title")}
                      >
                        <Route size={14} />
                      </button>
                      <button
                        onClick={() => setRightPanelMode("literature-extract")}
                        className={`p-1.5 rounded-md transition-colors ${
                          rightPanelMode === "literature-extract"
                            ? "bg-primary-500 text-white"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title={t("literatureExtract.title")}
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={() => setRightPanelMode("concept-aggregation")}
                        className={`p-1.5 rounded-md transition-colors ${
                          rightPanelMode === "concept-aggregation"
                            ? "bg-primary-500 text-white"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title="概念聚合"
                      >
                        <GitMerge size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className={`p-1.5 rounded-md transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {rightPanelMode === "concept-aggregation" ? (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-full">
                          <Loader2
                            size={24}
                            className="animate-spin text-primary-500"
                          />
                        </div>
                      }
                    >
                      <div className="h-full">
                        <ConceptAggregationPanel
                          graphId={nodeId || ""}
                          isOpen={true}
                          onClose={() => {}}
                          embedded={true}
                        />
                      </div>
                    </Suspense>
                  ) : rightPanelMode === "literature-extract" ? (
                    <div className="h-full">
                      <LiteratureExtractPanel
                        graphId={graphId || ""}
                        onExtractComplete={(result) => {
                          if (result.concepts.length > 0) {
                            frontendEventBus.publish("message_show", {
                              type: "success",
                              content: t(
                                "literatureExtract.success.extracted",
                                {
                                  count: result.concepts.length,
                                },
                              ),
                            });
                          }
                        }}
                        onConceptsSaved={async () => {
                          await queryClient.invalidateQueries({
                            queryKey: ["graphData", graphId],
                          });
                          await queryClient.invalidateQueries({
                            queryKey: ["graphNodeStatus", graphId],
                          });
                        }}
                        className="h-full"
                      />
                    </div>
                  ) : rightPanelMode === "learning-path" ? (
                    <div className="p-4">
                      <LearningPathPanel
                        graphId={graphId || ""}
                        onNodeSelect={(nodeId) => {
                          navigate(
                            `/learning?graph_id=${graphId}&node_id=${nodeId}`,
                          );
                        }}
                        onPathSelect={handleSelectLearningPath}
                        selectedPathId={selectedLearningPathId}
                      />
                    </div>
                  ) : (
                    <RAGChatPanel
                      graphId={graphId || undefined}
                      currentNodeId={nodeId || undefined}
                      currentNodeTitle={nodeTitle || undefined}
                      isOpen={true}
                      selectedNodeIds={[]}
                      variant="embedded"
                      enableTermTooltip={true}
                      enableSTT={true}
                      onNavigateToNode={(targetNodeId) => {
                        navigate(`/learning?graph_id=${graphId}&node_id=${targetNodeId}`);
                      }}
                    />
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {/* Modal */}
      <GenerateCardsModal
        isOpen={isGenModalOpen}
        onClose={() => setIsGenModalOpen(false)}
        onGenerate={handleManualGenerateCards}
        nodeTitle={nodeTitle}
        generateProgress={generateProgress}
      />

      {/* Create Node Modal */}
      {isCreateNodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"} rounded-xl shadow-2xl w-full max-w-md mx-4 border`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {t("learning.node.createTitle")}
                </h3>
                <button
                  onClick={() => setIsCreateNodeModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.titleLabel")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newNodeTitle}
                    onChange={(e) => setNewNodeTitle(e.target.value)}
                    placeholder={t("learning.node.titlePlaceholder")}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.contentLabel")}
                  </label>
                  <textarea
                    value={newNodeContent}
                    onChange={(e) => setNewNodeContent(e.target.value)}
                    placeholder={t("learning.node.contentPlaceholder")}
                    rows={4}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all resize-none ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.levelLabel")}
                  </label>
                  <select
                    value={newNodeLevel}
                    onChange={(e) =>
                      setNewNodeLevel(e.target.value as NodeLevel)
                    }
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="root">{t("learning.node.levelRoot")}</option>
                    <option value="core">{t("learning.node.levelCore")}</option>
                    <option value="sub">{t("learning.node.levelSub")}</option>
                    <option value="normal">
                      {t("learning.node.levelNormal")}
                    </option>
                    <option value="leaf">{t("learning.node.levelLeaf")}</option>
                  </select>
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.parentLabel")}
                  </label>
                  <select
                    value={selectedParentNodeId}
                    onChange={(e) => setSelectedParentNodeId(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="">{t("learning.node.noParent")}</option>
                    {graphData?.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCreateNodeModalOpen(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t("learning.node.cancel")}
                </button>
                <button
                  onClick={handleCreateNode}
                  disabled={!newNodeTitle.trim()}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    !newNodeTitle.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  }`}
                >
                  <Plus size={18} />
                  {t("learning.node.createButton")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LearningFocusPanel
        isOpen={isFocusModeOpen}
        onClose={() => {
          setIsFocusModeOpen(false);
          exitFocusMode();
        }}
        articleContent={articleContent}
        nodeTitle={nodeTitle}
        isMobile={isMobile}
        keywords={keywords}
      />

      <LearningSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialScenarioId="learning_material"
        graphId={graphId || undefined}
      />
      <GraphOverviewEditModal
        isOpen={isOverviewEditModalOpen}
        onClose={() => setIsOverviewEditModalOpen(false)}
        graph={graphMeta || null}
        onSave={async (data) => {
          if (!graphMeta) return;
          try {
            await api.graphs.update(graphMeta.id, data);
            queryClient.invalidateQueries({ queryKey: ["graph", graphId] });
            setIsOverviewEditModalOpen(false);
          } catch (error) {
            console.error("Failed to save graph overview:", error);
          }
        }}
      />
    </div>
  );
};

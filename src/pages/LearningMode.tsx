import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLearningSettingsStore } from "../store/useLearningSettingsStore";
import { useNodeDisplayLanguageStore } from "../store/useNodeDisplayLanguageStore";
import { resolveLocalizedText } from "@shared/utils/localization";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { orchestratorApi } from "../services/api/modules/scheduler/orchestrator";
import { message as msgHelper } from "../utils/messageHelper";
import { asyncConfirm } from "../utils/asyncConfirm";
import {
  useTheme,
  useNetworkStatus,
  useQuoteShortcut,
} from "../hooks";
import {
  useGraph,
  useGraphData,
  queryKeys,
  defaultQueryConfig,
} from "../hooks/queries";
import { useStudyModeLogic } from "../hooks/study/useStudyModeLogic";
import { useLearningModeTimer } from "../hooks/study/useLearningModeTimer";
import { setExecutionContext } from "../utils/executionSessionContext";
import { useLinkedTask } from "../hooks/scheduler/useLinkedTask";
import { useTaskSettledInvalidator } from "../hooks/scheduler/useTaskSettledInvalidator";
import { useLevelTestNotificationStore } from "../store/useLevelTestNotificationStore";
import {
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
} from "../utils/errors";
const GenerateCardsModal = lazy(() =>
  import("../components/Learning/GenerateCardsModal").then((module) => ({
    default: module.GenerateCardsModal,
  })),
);

import { GraphOverviewPanel } from "../components/Learning/GraphOverviewPanel";
import { GraphOverviewEditModal } from "../components/Learning/GraphOverviewEditModal";
import { LearningFocusPanel } from "../components/Learning/LearningFocusPanel";
import { LearningSettingsPanel } from "../components/Learning/LearningSettingsPanel";
import { LearningModeHeader } from "../components/Learning/LearningModeHeader";
import { LearningModeOutline } from "../components/Learning/LearningModeOutline";
import { LearningModeRightPanel } from "../components/Learning/LearningModeRightPanel";
import { LearningArticleReader } from "../components/Learning/LearningArticleReader";
import { CreateNodeModal } from "../components/Learning/CreateNodeModal";
import { LearningChapterSchemaEditor } from "../components/Learning/LearningChapterSchemaEditor";
import { addQuote } from "../components/RAGChat";
import { NodeLevel, Keyword, StudyCard } from "../types";
import { useFocusStore } from "../store/useFocusStore";
import { useShallow } from "zustand/react/shallow";
import { TaskProgressBar } from "../components/common/TaskProgressBar";
import { mapToRuntimeProgress } from "../hooks/scheduler/useTaskEvents";
import type { TaskRuntimeProgress } from "@shared/types/common";

type OutlineMode = "graph" | "learning-path";
type RightPanelMode =
  | "chat"
  | "learning-path"
  | "literature-extract"
  | "concept-aggregation"
  | "knowledge-gaps";

export const LearningMode = () => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get("node_id");
  const graphId = searchParams.get("graph_id");

  // Hooks
  const {
    studyMode,
    isStudyModeDropdownOpen,
    setIsStudyModeDropdownOpen,
    getStudyModeIcon,
    shouldShowArticle,
    shouldShowQuiz,
    getStrategyHint,
    handleStudyModeChange,
  } = useStudyModeLogic();

  const { linkedTask } = useLinkedTask({ graphId, nodeId });

  const { completeFocusTimer } = useLearningModeTimer({
    nodeId,
    nodeTitle: "",
    linkedTaskMainTaskId: linkedTask?.mainTaskId,
  });

  // 学习模式即计时：选中知识点阅读即记录学习活动；离开/切换由会话桥统一收尾
  useEffect(() => {
    if (nodeId) {
      setExecutionContext({
        kind: "learning",
        stage: "learning",
        knowledgePointId: nodeId,
        taskId: linkedTask?.mainTaskId,
        subtaskId: linkedTask?.subtaskId,
      });
    } else {
      setExecutionContext(null);
    }
    return () => setExecutionContext(null);
  }, [nodeId, linkedTask?.mainTaskId, linkedTask?.subtaskId]);

  // Local state
  const [nodeTitle, setNodeTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 1280);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const { isOnline } = useNetworkStatus();
  const [isCreateNodeModalOpen, setIsCreateNodeModalOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("chat");
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeContent, setNewNodeContent] = useState("");
  const [newNodeLevel, setNewNodeLevel] = useState<NodeLevel>("leaf");
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string>("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  // 后台拓展（大纲多选「拓展」）已提交的任务，完成后刷新图谱节点数据
  const [expandTaskIds, setExpandTaskIds] = useState<string[]>([]);
  // 后台批量生成学习资料任务，完成后刷新图谱数据（大纲/阅读区）
  const [materialBatchTaskIds, setMaterialBatchTaskIds] = useState<string[]>([]);
  const [outlineMode, setOutlineMode] = useState<OutlineMode>("graph");
  const [selectedLearningPathId, setSelectedLearningPathId] = useState<string | null>(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOverviewEditModalOpen, setIsOverviewEditModalOpen] = useState(false);
  const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState(false);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | undefined>(undefined);
  const [generateProgress, setGenerateProgress] = useState<{
    current: number; total: number; isGenerating: boolean;
  } | null>(null);
  // 题目生成进度跟踪：批量出题任务 taskIds + 轮询定时器（模态框进度条数据源）
  const cardGenTaskIdsRef = useRef<string[]>([]);
  const cardGenPollRef = useRef<number | null>(null);
  // 挑战意图：节点无题打开发题对话框时置位，生成完成后以右下角通知提醒手动进入测验
  const isChallengePendingRef = useRef(false);
  // AI 预生成联动：当前知识点的学习资料若正由后台预生成任务产出，
  // 轮询等待其完成，避免与按需生成重复调用 AI
  const [isPreGenPending, setIsPreGenPending] = useState(false);
  const preGenPollRef = useRef<number | null>(null);
  const preGenSessionRef = useRef(0);
  const generationNodeRef = useRef<string | null>(null);
  // 学习资料异步生成进度（TaskProgressBar 数据源）
  const [materialProgress, setMaterialProgress] = useState<TaskRuntimeProgress | null>(null);
  const materialPollRef = useRef<number | null>(null);

  const stopPreGenPoll = () => {
    if (preGenPollRef.current !== null) {
      window.clearTimeout(preGenPollRef.current);
      preGenPollRef.current = null;
    }
    if (materialPollRef.current !== null) {
      window.clearTimeout(materialPollRef.current);
      materialPollRef.current = null;
    }
  };

  const stopCardGenPoll = () => {
    if (cardGenPollRef.current !== null) {
      window.clearTimeout(cardGenPollRef.current);
      cardGenPollRef.current = null;
    }
  };

  // 卸载时终止预生成/异步生成轮询，并作废所有在途生成回调
  useEffect(() => {
    return () => {
      preGenSessionRef.current += 1;
      if (preGenPollRef.current !== null) {
        window.clearTimeout(preGenPollRef.current);
        preGenPollRef.current = null;
      }
      if (materialPollRef.current !== null) {
        window.clearTimeout(materialPollRef.current);
        materialPollRef.current = null;
      }
      if (cardGenPollRef.current !== null) {
        window.clearTimeout(cardGenPollRef.current);
        cardGenPollRef.current = null;
      }
    };
  }, []);

  const { enterFocusMode, exitFocusMode, highlightEnabled, setHighlightEnabled } = useFocusStore(
    useShallow((s) => ({
      enterFocusMode: s.enterFocusMode,
      exitFocusMode: s.exitFocusMode,
      highlightEnabled: s.highlightEnabled,
      setHighlightEnabled: s.setHighlightEnabled,
    })),
  );
  const {
    fontSize,
    fontFamily,
    lineHeight,
    readingMode,
    contentWidthMode,
    paginationMode,
  } = useLearningSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineHeight: s.lineHeight,
      readingMode: s.readingMode,
      contentWidthMode: s.contentWidthMode,
      paginationMode: s.paginationMode,
    })),
  );
  // 节点内容语言：复用共享「节点显示语言」，与图编辑器双向联动（一处切换，两处即时同步）
  const nodeContentLang = useNodeDisplayLanguageStore((s) => s.displayLanguage);
  const isEn = nodeContentLang === "en-US";
  const materialLangCode = isEn ? "en-US" : "zh-CN";
  const queryClient = useQueryClient();

  // 学习资料异步生成：入队后台任务 → 轮询进度 → 完成后回读节点内容。
  // 端点层已做在途去重（reused=true 表示复用已有预生成/在途任务），
  // 因此「按需生成」与「预生成在途」走同一路径，避免重复调用 AI。
  const runAsyncMaterialGeneration = async (
    genSession: number,
    opts?: { force?: boolean; schema_id?: string; successKey?: string },
  ) => {
    if (preGenSessionRef.current !== genSession) return;
    if (!nodeId) return;
    const schemaId =
      opts?.schema_id !== undefined ? opts.schema_id : selectedSchemaId;
    try {
      setIsGenerating(true);
      const { taskId, reused } = await api.ai.generateLearningMaterialAsync({
        knowledge_point_id: nodeId,
        language: materialLangCode,
        graph_id: graphId || undefined,
        schema_id: schemaId,
        force: opts?.force,
      });
      if (preGenSessionRef.current !== genSession) return;
      setIsPreGenPending(reused);
      setMaterialProgress({
        stage: "queued",
        stageLabel: t("learning.material.queued"),
        percent: 0,
      });
      const poll = async (attempt: number) => {
        if (preGenSessionRef.current !== genSession) return;
        try {
          const s = await api.ai.getTaskStatus(taskId);
          if (preGenSessionRef.current !== genSession) return;
          if (s.status === "completed") {
            setMaterialProgress(null);
            setIsPreGenPending(false);
            const fresh = await api.nodes.get(nodeId);
            if (preGenSessionRef.current !== genSession) return;
            const freshMaterial = fresh.learning_material?.[materialLangCode];
            if (freshMaterial && freshMaterial.trim().length > 0) {
              setArticleContent(freshMaterial);
              setKeywords(fresh.keywords?.[materialLangCode] || []);
              msgHelper.success(
                t((opts?.successKey || "learning.material.generated") as never),
                {
                  duration: 8000,
                  ...(opts?.force
                    ? {}
                    : {
                        action: {
                          label: t("learning.material.generateCards"),
                          onClick: () => handleGenerateCards(nodeId),
                        },
                      }),
                },
              );
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.nodeDetail(nodeId) });
            if (graphId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
            }
            setIsGenerating(false);
            return;
          }
          if (s.status === "failed" || s.status === "cancelled") {
            setMaterialProgress(null);
            setIsPreGenPending(false);
            msgHelper.error(t("learning.material.generateFailed"));
            setIsGenerating(false);
            return;
          }
          const mapped = mapToRuntimeProgress(s.runtime_progress);
          if (mapped) setMaterialProgress(mapped);
          if (attempt >= 90) {
            // 看门狗（约 3 分钟）：停止轮询，提示可去任务中心查看
            setMaterialProgress(null);
            setIsPreGenPending(false);
            setIsGenerating(false);
            msgHelper.info(t("learning.material.taskInProgress"));
            return;
          }
          materialPollRef.current = window.setTimeout(() => poll(attempt + 1), 2000);
        } catch {
          if (preGenSessionRef.current !== genSession) return;
          setMaterialProgress(null);
          setIsPreGenPending(false);
          setIsGenerating(false);
          msgHelper.error(t("learning.material.generateFailed"));
        }
      };
      await poll(0);
    } catch (error) {
      if (preGenSessionRef.current !== genSession) return;
      console.error("Failed to enqueue learning material:", error);
      setIsGenerating(false);
      msgHelper.error(t("learning.material.generateFailed"));
    }
  };

  // 题目生成进度跟踪：轮询批量任务状态，更新模态框进度条（generateProgress）。
  const trackCardGeneration = (taskIds: string[]) => {
    stopCardGenPoll();
    cardGenTaskIdsRef.current = taskIds;
    if (!taskIds.length) return;
    setGenerateProgress({ current: 0, total: taskIds.length, isGenerating: true });
    const poll = async (attempt: number) => {
      if (cardGenTaskIdsRef.current !== taskIds) return;
      try {
        const statuses = await Promise.all(
          taskIds.map((id) =>
            api.ai.getTaskStatus(id).catch(() => null as { status: string } | null),
          ),
        );
        if (cardGenTaskIdsRef.current !== taskIds) return;
        const done = statuses.filter(
          (s) => s && ["completed", "failed", "cancelled"].includes(s.status),
        ).length;
        if (done >= taskIds.length) {
          cardGenTaskIdsRef.current = [];
          setGenerateProgress({
            current: taskIds.length,
            total: taskIds.length,
            isGenerating: false,
          });
          msgHelper.success(
            t("learning.cards.generatedComplete", { count: taskIds.length }),
            { duration: 6000 },
          );
          if (graphId) queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
          if (nodeId) queryClient.invalidateQueries({ queryKey: queryKeys.nodeDetail(nodeId) });
          return;
        }
        setGenerateProgress({ current: done, total: taskIds.length, isGenerating: true });
        if (attempt >= 150) {
          // 看门狗（约 5 分钟）：停止轮询，提示可去任务中心查看
          cardGenTaskIdsRef.current = [];
          setGenerateProgress({ current: done, total: taskIds.length, isGenerating: false });
          msgHelper.info(t("learning.cards.taskInProgress"));
          return;
        }
        cardGenPollRef.current = window.setTimeout(() => poll(attempt + 1), 2000);
      } catch {
        if (cardGenTaskIdsRef.current !== taskIds) return;
        if (attempt >= 150) {
          cardGenTaskIdsRef.current = [];
          setGenerateProgress({ current: taskIds.length, total: taskIds.length, isGenerating: false });
          return;
        }
        cardGenPollRef.current = window.setTimeout(() => poll(attempt + 1), 3000);
      }
    };
    poll(0);
  };

  // 取消当前跟踪的题目生成任务（Header「取消」按钮）
  const cancelCardGeneration = async () => {
    const ids = cardGenTaskIdsRef.current;
    stopCardGenPoll();
    cardGenTaskIdsRef.current = [];
    setGenerateProgress(null);
    if (!ids.length) return;
    try {
      await Promise.allSettled(ids.map((id) => api.tasks.cancel(id)));
      msgHelper.info(t("learning.cards.cancelled"));
    } catch {
      msgHelper.error(t("learning.cards.cancelFailed"));
    }
  };

  // 后台拓展任务全部完成后刷新图谱节点与学习路径缓存，使大纲视图即时显示新拓展节点
  useTaskSettledInvalidator({
    taskIds: expandTaskIds,
    onAllSettled: () => {
      if (!graphId) return;
      setExpandTaskIds([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphLearningPath(graphId),
      });
    },
  });

  // 批量学习资料任务全部完成后刷新图谱/当前节点详情，使阅读区即时显示新生成的资料
  useTaskSettledInvalidator({
    taskIds: materialBatchTaskIds,
    onAllSettled: () => {
      setMaterialBatchTaskIds([]);
      if (graphId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
      }
      if (nodeId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.nodeDetail(nodeId) });
      }
    },
  });

  useQuoteShortcut({
    onAddQuote: addQuote,
    isChatOpen: isChatOpen && rightPanelMode === "chat",
    onOpenChat: () => {
      if (!isChatOpen) setIsChatOpen(true);
      if (rightPanelMode !== "chat") setRightPanelMode("chat");
    },
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && !nodeId) setIsOutlineOpen(true);
  }, [isMobile, nodeId]);

  const { data: graphData } = useGraphData(graphId || "");
  const { data: graphMeta } = useGraph(graphId || "");
  const _nodeStatus = graphData?.nodeStatus;

  // 大纲视图的节点标题也按「节点显示语言」本地化（与右侧详情、图编辑器联动）
  const outlineGraphData = useMemo(() => {
    if (!graphData) return graphData;
    return {
      ...graphData,
      nodes: (graphData.nodes || []).map((n) => ({
        ...n,
        title:
          resolveLocalizedText(n.titleTranslations, nodeContentLang) || n.title,
        content:
          resolveLocalizedText(n.contentTranslations, nodeContentLang) ??
          n.content,
        summary:
          resolveLocalizedText(n.summaryTranslations, nodeContentLang) ??
          n.summary,
      })),
    };
  }, [graphData, nodeContentLang]);

  // Task 11: 节点详情通过 useQuery 获取,RQ 自动处理 stale 请求与缓存
  const { data: node, isLoading: isNodeLoading } = useQuery({
    queryKey: queryKeys.nodeDetail(nodeId ?? ""),
    queryFn: () => {
      if (!nodeId) {
        throw new Error("nodeId is required");
      }
      return api.nodes.get(nodeId);
    },
    enabled: !!nodeId,
    ...defaultQueryConfig,
  });

  const handleNodeClick = (id: string) => {
    navigate(`/learning?graph_id=${graphId}&node_id=${id}`);
  };

  const handleGenerateCards = async (targetNodeId: string) => {
    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([targetNodeId], {
        count: 10,
        types: ["qa", "choice", "true_false", "multi_choice", "fill_in_the_blank"],
      });
      if (result.success) {
        msgHelper.success(t("learning.cards.taskSubmitted"), {
          duration: 5000,
          action: { label: t("learning.cards.viewTasks"), onClick: () => navigate("/tasks") },
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
    if (!node) return;
    setNodeTitle(
      resolveLocalizedText(node.titleTranslations, nodeContentLang) ||
        node.title ||
        "",
    );
    const material = node.learning_material?.[materialLangCode];
    const nodeKeywords = node.keywords?.[materialLangCode] || [];
    setKeywords(nodeKeywords);
    if (material && material.trim().length > 0) {
      setArticleContent(material);
      setIsGenerating(false);
      return;
    }
    // 当前语言学习材料缺失 → 入队后台异步任务生成（带进度），避免同步阻塞等待。
    // 已在为该知识点生成（进行中）时跳过，避免重复触发。
    if (isGenerating && generationNodeRef.current === nodeId) return;
    if (isGenerating) {
      // 上一个生成流程针对其它节点 → 作废旧流程，重新评估当前节点
      stopPreGenPoll();
      preGenSessionRef.current += 1;
      setIsGenerating(false);
      setIsPreGenPending(false);
      setMaterialProgress(null);
    }
    const session = ++preGenSessionRef.current;
    generationNodeRef.current = nodeId;
    runAsyncMaterialGeneration(session);
    // 依赖 node (来自 useQuery) + nodeContentLang 触发;其余依赖通过闭包在触发时获取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, node, nodeContentLang]);

  const handleCreateNode = async () => {
    if (!graphId || !newNodeTitle.trim()) { msgHelper.warning(t("learning.node.enterTitle")); return; }
    try {
      const newNode = await api.nodes.create({
        graph_id: graphId, title: newNodeTitle, content: newNodeContent,
        x_position: Math.round((Math.random() - 0.5) * 20),
        y_position: Math.round((Math.random() - 0.5) * 20),
        level: newNodeLevel, properties: {},
      });
      if (selectedParentNodeId) {
        await api.edges.create({
          source_knowledge_point_id: selectedParentNodeId,
          target_knowledge_point_id: newNode.id, graph_id: graphId,
          relationship_type: "contains",
        });
      }
      msgHelper.success(t("learning.node.createSuccess"));
      setNewNodeTitle(""); setNewNodeContent(""); setNewNodeLevel("leaf");
      setSelectedParentNodeId(""); setIsCreateNodeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
      queryClient.invalidateQueries({ queryKey: ["graphLearningPath", graphId] });
      if (graphData) navigate(`/learning?graph_id=${graphId}&node_id=${newNode.id}`);
    } catch (error) {
      console.error("Failed to create node:", error);
      msgHelper.error(t("learning.node.createFailed"));
    }
  };

  const startChallengeSession = async () => {
    if (!nodeId || !graphId) { msgHelper.warning(t("learning.challenge.missingParams")); return; }
    try {
      // 复用图谱大任务作为任务锚点（useLinkedTask 已确保其与子任务存在），
      // 避免每次挑战都新建独立 learning 任务导致会话/复习卡挂靠错位。
      await completeFocusTimer();
      // 学习完成统一推进：重算掌握度 → 推进子任务状态机 → 创建首次复习卡片
      await orchestratorApi.completeLearning({
        knowledge_point_id: nodeId,
        task_id: linkedTask?.mainTaskId,
        graph_id: graphId,
      });
      msgHelper.success(t("learning.challenge.completed"));
    } catch (error) {
      console.error("Failed to create review task:", error);
    }
    navigate(`/study?node_id=${nodeId}&graph_id=${graphId}&mode=quiz&from=learning`);
  };

  const handleStartChallenge = async () => {
    if (!nodeId || !graphId) { msgHelper.warning(t("learning.challenge.missingParams")); return; }
    if (isGeneratingCards) { msgHelper.info(t("learning.challenge.generating")); return; }
    try {
      const result = await api.study.getCards({ knowledge_point_id: nodeId });
      const cards = Array.isArray(result)
        ? result
        : ((result as unknown as { cards?: StudyCard[] }).cards ?? []);
      if (cards.length === 0) {
        isChallengePendingRef.current = true;
        setIsGenModalOpen(true);
        msgHelper.info(t("learning.challenge.noCards"));
        return;
      }
    } catch (error) {
      console.error("Failed to check node cards:", error);
    }
    await startChallengeSession();
  };

  const handleRegenerateMaterial = async () => {
    if (!nodeId || !graphId) { msgHelper.warning(t("learning.challenge.missingParams")); return; }
    if (!isOnline) { msgHelper.error(t("learning.material.regenerateOffline")); return; }
    setArticleContent("");
    await runAsyncMaterialGeneration(preGenSessionRef.current, {
      force: true,
      schema_id: selectedSchemaId,
      successKey: "learning.material.regenerated",
    });
  };

  const handleManualGenerateCards = async (config: {
    count: number;
    types: string[];
    cardsPerType: Partial<Record<string, number>>;
    countPerDifficulty: Partial<Record<"easy" | "medium" | "hard", number>>;
    countMatrix?: Record<string, { easy: number; medium: number; hard: number }>;
    difficulty: "easy" | "medium" | "hard" | "mixed";
    coverage: "current_only" | "with_children" | "with_siblings" | "graph";
    customPrompt: string;
    targetNodeIds: string[];
  }) => {
    if (!isOnline) { msgHelper.error(t("learning.cards.offline")); return; }
    if (!config.types || config.types.length === 0) return;
    if (config.count <= 0) return;

    const cardsPerTypeNum =
      config.cardsPerType && Object.keys(config.cardsPerType).length > 0
        ? Object.fromEntries(
            Object.entries(config.cardsPerType).map(([k, v]) => [k, Number(v ?? 0)]),
          )
        : undefined;
    const countPerDiffNum =
      config.countPerDifficulty && Object.keys(config.countPerDifficulty).length > 0
        ? Object.fromEntries(
            Object.entries(config.countPerDifficulty).map(([k, v]) => [k, Number(v ?? 0)]),
          )
        : undefined;
    const countMatrixNum =
      config.countMatrix && Object.keys(config.countMatrix).length > 0
        ? Object.fromEntries(
            Object.entries(config.countMatrix).map(([k, v]) => [
              k,
              {
                easy: Number(v.easy ?? 0),
                medium: Number(v.medium ?? 0),
                hard: Number(v.hard ?? 0),
              },
            ]),
          )
        : undefined;

    // Desktop path
    const desktopTargetIds = config.targetNodeIds?.length ? config.targetNodeIds : (nodeId ? [nodeId] : []);
    if (desktopTargetIds.length === 0) { msgHelper.warning(t("learning.cards.selectNode")); return; }
    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards(desktopTargetIds, {
        count: config.count,
        types: config.types,
        difficulty: config.difficulty,
        coverage: config.coverage,
        custom_prompt: config.customPrompt || undefined,
        cards_per_type: cardsPerTypeNum,
        count_per_difficulty: countPerDiffNum as { easy?: number; medium?: number; hard?: number } | undefined,
        count_matrix: countMatrixNum,
      });
      if (result.success) {
        if (isChallengePendingRef.current && result.taskIds?.length) {
          const challengeNodeId = nodeId ?? "";
          const challengeGraphId = graphId ?? "";
          isChallengePendingRef.current = false;
          setIsGenModalOpen(false);
          useLevelTestNotificationStore
            .getState()
            .startGenerationTracking(result.taskIds, challengeNodeId, challengeGraphId, "learning");
          return;
        }
        // 普通出题：跟踪进度并保持模态框打开，实时展示生成进度
        trackCardGeneration(result.taskIds ?? []);
        msgHelper.success(t("learning.cards.taskSubmitted"), {
          duration: 5000,
          action: { label: t("learning.cards.viewTasks"), onClick: () => navigate("/tasks") },
        });
      } else {
        const errorMsg = result.message || result.error || t("learning.cards.unknownError");
        console.error("[LearningMode] 任务提交失败:", errorMsg);
        msgHelper.error(t("learning.cards.submitFailed", { error: errorMsg }));
      }
    } catch (error) {
      console.error("[LearningMode] 题目生成异常:", error);
      let errorMessage = t("learning.cards.submitFailedShort");
      if (isNetworkError(error)) errorMessage = t("learning.cards.networkError");
      else if (isAuthError(error)) errorMessage = t("learning.cards.authError");
      else if (isValidationError(error)) errorMessage = t("learning.cards.validationError");
      else if (isAppError(error)) errorMessage = t("learning.cards.submitFailed", { error: error.message });
      else if (error instanceof Error) errorMessage = t("learning.cards.submitFailed", { error: error.message });
      msgHelper.error(errorMessage);
    } finally { setIsGeneratingCards(false); }
  };

  const handleCancelGenerate = () => {
    cancelCardGeneration();
  };

  const handleBatchAction = async (
    action: string,
    data?: Record<string, unknown>,
  ) => {
    const ids = Array.from(selectedNodeIds);
    if (ids.length === 0) { msgHelper.warning(t("learning.batch.selectNodes")); return; }

    if (action === "delete") {
      const confirmed = await asyncConfirm({
        title: t("learning.batch.deleteTitle"),
        message: t("learning.batch.deleteConfirm", { count: ids.length }),
        isDangerous: true,
      });
      if (!confirmed) return;
      try {
        await api.nodes.batchDelete(ids);
        msgHelper.success(t("learning.batch.deleteSuccess", { count: ids.length }));
        setSelectedNodeIds(new Set());
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId ?? "") });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphLearningPath(graphId ?? "") });
      } catch (error) { console.error("Batch delete failed:", error); msgHelper.error(t("learning.batch.deleteFailed")); }
    } else if (action === "expand_graph") {
      if (!isOnline) { msgHelper.error(t("learning.batch.expandOffline")); return; }
      try {
        const result = await api.ai.batchExpandGraph(ids);
        if (result.success) {
          // 记录本次提交的后台任务，全部完成后刷新图谱节点数据
          if (Array.isArray(result.taskIds) && result.taskIds.length > 0) {
            setExpandTaskIds((prev) => [...prev, ...result.taskIds]);
          }
          msgHelper.success(t("learning.batch.expandSuccess", { count: ids.length }), { duration: 5000, action: { label: t("learning.cards.viewTasks"), onClick: () => navigate("/tasks") } });
          setSelectedNodeIds(new Set());
        } else { msgHelper.error(t("learning.batch.submitFailed")); }
      } catch (error) { console.error("Batch expand failed:", error); msgHelper.error(t("learning.batch.expandError")); }
    } else if (action === "batch_generate_questions" && data) {
      if (!isOnline) { msgHelper.error(t("learning.cards.offline")); return; }
      const targetNodeIdsFromData = Array.isArray((data as { targetNodeIds?: unknown }).targetNodeIds)
        ? ((data as { targetNodeIds?: string[] }).targetNodeIds ?? []).filter((x): x is string => typeof x === "string")
        : [];
      const idsToUse = targetNodeIdsFromData.length > 0 ? targetNodeIdsFromData : ids;
      if (idsToUse.length === 0) return;
      setIsGeneratingCards(true);
      try {
        const result = await api.ai.batchGenerateCards(idsToUse, {
          ...data,
        });
        if (result.success) {
          msgHelper.success(t("learning.batch.generateSuccess", { count: ids.length }), { duration: 5000, action: { label: t("learning.cards.viewTasks"), onClick: () => navigate("/tasks") } });
          setSelectedNodeIds(new Set());
        } else {
          const errorMsg = result.message || result.error || t("learning.cards.unknownError");
          console.error("[LearningMode] 批量生成失败:", errorMsg);
          msgHelper.error(t("learning.cards.submitFailed", { error: errorMsg }));
        }
      } catch (error) {
        console.error("[LearningMode] 批量生成异常:", error);
        let errorMessage = t("learning.batch.generateFailed");
        if (isNetworkError(error)) errorMessage = t("learning.cards.networkError");
        else if (isAuthError(error)) errorMessage = t("learning.cards.authError");
        else if (isValidationError(error)) errorMessage = t("learning.cards.validationError");
        else if (isAppError(error)) errorMessage = error.message;
        else if (error instanceof Error) errorMessage = error.message;
        msgHelper.error(errorMessage);
      } finally { setIsGeneratingCards(false); }
    } else if (action === "batch_generate_material") {
      if (!isOnline) { msgHelper.error(t("learning.batch.materialOffline")); return; }
      const confirmed = await asyncConfirm({
        title: t("graphEditor.outline.batchGenerateMaterial"),
        message: t("learning.batch.materialConfirm", { count: ids.length }),
      });
      if (!confirmed) return;
      try {
        const result = await api.ai.batchGenerateLearningMaterial(ids, {
          language: materialLangCode,
          graph_id: graphId || undefined,
        });
        if (result.success) {
          if (Array.isArray(result.taskIds) && result.taskIds.length > 0) {
            setMaterialBatchTaskIds((prev) => [...prev, ...result.taskIds]);
          }
          msgHelper.success(t("learning.batch.materialSuccess", { count: ids.length }), { duration: 5000, action: { label: t("learning.cards.viewTasks"), onClick: () => navigate("/tasks") } });
          setSelectedNodeIds(new Set());
        } else {
          msgHelper.error(t("learning.batch.materialFailed"));
        }
      } catch (error) {
        console.error("[LearningMode] 批量生成学习资料失败:", error);
        msgHelper.error(t("learning.batch.materialFailed"));
      }
    } else if (action === "create_region") {
      msgHelper.info(`${t("graphEditor.region.createRegion")  } - ${  t("common.comingSoon")}`);
    }
  };

  const handleSelectLearningPath = (pathId: string | null) => {
    if (pathId) { setSelectedLearningPathId(pathId); setOutlineMode("learning-path"); setSelectedNodeIds(new Set()); }
  };

  const handleBackToGraphOutline = () => {
    setOutlineMode("graph"); setSelectedLearningPathId(null);
  };

  const handleCreateQuizSet = (knowledgePointIds: string[]) => {
    // 跳转到学习中心创建测验流程，预选当前多选的知识点（第一步联动）
    // 携带 from=learning + node_id，便于学习中心返回时回到当前知识图谱与节点
    if (knowledgePointIds.length === 0) return;
    const kpParam = encodeURIComponent(knowledgePointIds.join(","));
    navigate(
      `/study?graph_id=${graphId ?? ""}&node_id=${nodeId ?? ""}&from=learning&view=quizzes&create=1&kp_ids=${kpParam}`,
    );
  };

  return (
    <div className={`h-screen flex flex-col ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}>
      <h1 className="sr-only">{t('learning.modeTitle')}</h1>
      <LearningModeHeader
        isDark={isDark} isMobile={isMobile} nodeId={nodeId} graphId={graphId}
        nodeTitle={nodeTitle} graphData={graphData} graphMeta={graphMeta}
        isOutlineOpen={isOutlineOpen} isChatOpen={isChatOpen} articleContent={articleContent}
        isOnline={isOnline} isGeneratingCards={isGeneratingCards} generateProgress={generateProgress}
        studyMode={studyMode} isStudyModeDropdownOpen={isStudyModeDropdownOpen}
        shouldShowQuiz={shouldShowQuiz} rightPanelMode={rightPanelMode}
        getStudyModeIcon={getStudyModeIcon}
        toggleTheme={toggleTheme}
        onToggleOutline={() => setIsOutlineOpen(!isOutlineOpen)}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onStudyModeChange={handleStudyModeChange}
        onToggleStudyModeDropdown={() => setIsStudyModeDropdownOpen(!isStudyModeDropdownOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSchemaEditor={() => setIsSchemaEditorOpen(true)}
        onEnterFocusMode={() => {
          if (nodeId && articleContent) {
            enterFocusMode(nodeId);
            setIsFocusModeOpen(true);
          }
        }}
        onOpenLearningPath={() => { setRightPanelMode("learning-path"); setIsChatOpen(true); }}
        onNavigateToGraph={() => navigate(`/graph/${graphId}`)}
        onOpenGenModal={() => setIsGenModalOpen(true)}
        onStartChallenge={handleStartChallenge}
        onCancelGenerate={handleCancelGenerate}
      />

      <div className="flex-1 flex overflow-hidden">
        <LearningModeOutline
          isMobile={isMobile} nodeId={nodeId} graphId={graphId}
          isOutlineOpen={isOutlineOpen} outlineMode={outlineMode}
          selectedLearningPathId={selectedLearningPathId} selectedNodeIds={selectedNodeIds}
          graphData={outlineGraphData} graphMeta={graphMeta}
          onNodeClick={handleNodeClick} onSelectionChange={setSelectedNodeIds}
          onBatchAction={handleBatchAction} onAddNode={() => setIsCreateNodeModalOpen(true)}
          onCreateQuizSet={handleCreateQuizSet}
          onBackToGraphOutline={handleBackToGraphOutline}
        />

        {nodeId ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {(isPreGenPending || materialProgress) && (
              <div className="flex items-center gap-3 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
                {isPreGenPending && !materialProgress && (
                  <div className="flex items-center gap-2 text-xs text-primary-700 dark:text-primary-300 animate-pulse">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary-500 animate-ping" />
                    {t("learning.material.preGenerating")}
                  </div>
                )}
                {materialProgress && (
                  <TaskProgressBar progress={materialProgress} className="flex-1" />
                )}
              </div>
            )}
            <div className="flex-1 flex overflow-hidden">
              <LearningArticleReader
                isDark={isDark} isMobile={isMobile} nodeId={nodeId} graphId={graphId}
                nodeTitle={nodeTitle} articleContent={articleContent} keywords={keywords}
                isGenerating={isGenerating || isNodeLoading} isOnline={isOnline} isGeneratingCards={isGeneratingCards}
                studyMode={studyMode} highlightEnabled={highlightEnabled}
                linkedTask={linkedTask} nodeStatus={_nodeStatus}
                fontSize={fontSize} fontFamily={fontFamily} lineHeight={lineHeight}
                readingMode={readingMode} contentWidthMode={contentWidthMode}
                paginationMode={paginationMode}
                getStudyModeIcon={getStudyModeIcon} getStrategyHint={getStrategyHint}
                shouldShowArticle={shouldShowArticle} shouldShowQuiz={shouldShowQuiz}
                onToggleHighlight={() => setHighlightEnabled(!highlightEnabled)}
                onRegenerateMaterial={handleRegenerateMaterial}
                onStartChallenge={handleStartChallenge}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div className={`${isMobile ? "hidden" : "flex-1"} flex flex-col overflow-hidden`}>
            <GraphOverviewPanel
              graph={graphMeta || null} templateType={graphMeta?.template_type}
              onEdit={() => setIsOverviewEditModalOpen(true)}
            />
          </div>
        )}

        <LearningModeRightPanel
          isDark={isDark} isMobile={isMobile} isChatOpen={isChatOpen}
          graphId={graphId} nodeId={nodeId} nodeTitle={nodeTitle}
          rightPanelMode={rightPanelMode} selectedLearningPathId={selectedLearningPathId}
          onClose={() => setIsChatOpen(false)}
          onSetRightPanelMode={(mode) => setRightPanelMode(mode)}
          onSelectLearningPath={handleSelectLearningPath}
          onNavigateToNode={handleNodeClick}
        />
      </div>

      <Suspense fallback={null}>
      <GenerateCardsModal
        isOpen={isGenModalOpen}
        onClose={() => {
          setIsGenModalOpen(false);
          isChallengePendingRef.current = false;
          stopCardGenPoll();
          cardGenTaskIdsRef.current = [];
          setGenerateProgress(null);
        }}
        onGenerate={handleManualGenerateCards}
        nodeTitle={nodeTitle}
        graphId={graphId ?? undefined}
        selectedNodes={nodeId
          ? [{
              id: nodeId,
              title: nodeTitle || graphData?.nodes?.find((n) => (n as { id: string; title?: string }).id === nodeId)?.title as string || '',
            }]
          : []}
        graphNodes={(graphData?.nodes ?? []).map((n) => {
          const node = n as { id: string; title?: string };
          return { id: node.id, title: node.title ?? '' };
        })}
        graphEdges={(graphData?.edges ?? []).map((e) => {
          const edge = e as { source_knowledge_point_id: string; target_knowledge_point_id: string };
          return {
            source_knowledge_point_id: edge.source_knowledge_point_id,
            target_knowledge_point_id: edge.target_knowledge_point_id,
          };
        }).concat(
          (graphData?.nodes ?? [])
            .map((n) => {
              const node = n as { id: string; parentId?: string | null };
              if (node.parentId) {
                return {
                  source_knowledge_point_id: node.parentId,
                  target_knowledge_point_id: node.id,
                };
              }
              return null;
            })
            .filter((x): x is { source_knowledge_point_id: string; target_knowledge_point_id: string } => x !== null),
        )}
        generateProgress={generateProgress}
      />
      </Suspense>

      <CreateNodeModal
        isDark={isDark} isOpen={isCreateNodeModalOpen}
        newNodeTitle={newNodeTitle} newNodeContent={newNodeContent}
        newNodeLevel={newNodeLevel} selectedParentNodeId={selectedParentNodeId}
        graphNodes={graphData?.nodes}
        onNewNodeTitleChange={setNewNodeTitle}
        onNewNodeContentChange={setNewNodeContent}
        onNewNodeLevelChange={setNewNodeLevel}
        onSelectedParentNodeIdChange={setSelectedParentNodeId}
        onClose={() => setIsCreateNodeModalOpen(false)}
        onCreate={handleCreateNode}
      />

      <LearningFocusPanel
        isOpen={isFocusModeOpen}
        onClose={() => { setIsFocusModeOpen(false); exitFocusMode(); }}
        articleContent={articleContent} nodeTitle={nodeTitle}
        isMobile={isMobile} keywords={keywords}
      />

      <LearningChapterSchemaEditor
        open={isSchemaEditorOpen}
        onClose={() => setIsSchemaEditorOpen(false)}
        graphId={graphId ?? undefined}
        selectedSchemaId={selectedSchemaId}
        onSelect={(sid) => setSelectedSchemaId(sid)}
      />

      <LearningSettingsPanel
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
      />

      <GraphOverviewEditModal
        isOpen={isOverviewEditModalOpen} onClose={() => setIsOverviewEditModalOpen(false)}
        graph={graphMeta || null}
        onSave={async (data) => {
          if (!graphMeta) return;
          try {
            await api.graphs.update(graphMeta.id, data);
            queryClient.invalidateQueries({ queryKey: queryKeys.graph(graphId ?? "") });
            setIsOverviewEditModalOpen(false);
          } catch (error) { console.error("Failed to save graph overview:", error); }
        }}
      />
    </div>
  );
};

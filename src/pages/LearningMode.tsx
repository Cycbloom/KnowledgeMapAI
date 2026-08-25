import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLearningSettingsStore } from "../store/useLearningSettingsStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, schedulerApi } from "../services/api";
import { message as msgHelper } from "../utils/messageHelper";
import { asyncConfirm } from "../utils/asyncConfirm";
import {
  useTheme,
  useNetworkStatus,
  useAILanguage,
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
import { useLinkedTask } from "../hooks/scheduler/useLinkedTask";
import {
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
} from "../utils/errors";
import { isCapacitorMobile } from "../config/mobileApiConfig";
import { mobileAIService, AICardGenError } from "../services/mobile/aiService";
import { getMobileSupabaseClient } from "../utils/supabase";
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

type OutlineMode = "graph" | "learning-path";
type RightPanelMode =
  | "chat"
  | "learning-path"
  | "literature-extract"
  | "concept-aggregation";
type MaterialLanguage = "zh" | "en";
const TASK_TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

export const LearningMode = () => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { language: aiLanguage } = useAILanguage();
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
  const abortControllerRef = useRef<AbortController | null>(null);
  // 挑战意图：节点无题打开发题对话框时置位，生成完成后自动进入挑战，关闭对话框即取消
  const isChallengePendingRef = useRef(false);

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
    materialLanguage,
    setMaterialLanguage,
  } = useLearningSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineHeight: s.lineHeight,
      readingMode: s.readingMode,
      contentWidthMode: s.contentWidthMode,
      materialLanguage: s.materialLanguage,
      setMaterialLanguage: s.setMaterialLanguage,
    })),
  );
  // 有效显示语言：auto 时跟随 AI/界面语言设置（保留原有"根据系统语言自动切换"行为）
  const effectiveMaterialLang: MaterialLanguage =
    materialLanguage === "auto"
      ? aiLanguage === "en-US"
        ? "en"
        : "zh"
      : materialLanguage;
  const queryClient = useQueryClient();

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
    setNodeTitle(node.title || "");
    const isEn = effectiveMaterialLang === "en";
    const materialLangCode = isEn ? "en-US" : "zh-CN";
    const material = node.learning_material?.[materialLangCode];
    const nodeKeywords = node.keywords?.[materialLangCode] || [];
    setKeywords(nodeKeywords);
    if (material && material.trim().length > 0) {
      setArticleContent(material);
      setIsGenerating(false);
      return;
    }
    // 当前语言的学习材料缺失,调用 AI 按该语言生成（生成后回写对应字段）
    if (isGenerating) return;
    const generateMaterial = async () => {
      try {
        setIsGenerating(true);
        const response = await api.ai.generateLearningMaterial({
          topic: node.title || "", context: node.content, level: node.level,
          graph_id: graphId || undefined, language: isEn ? "en-US" : "zh-CN",
        });
        if (response.content) {
          setArticleContent(response.content);
          const responseKeywords = response.keywords || [];
          setKeywords(responseKeywords);
          try {
            await api.nodes.update(nodeId, {
              learning_material: { ...(node.learning_material || {}), [materialLangCode]: response.content },
              keywords: { ...(node.keywords || {}), [materialLangCode]: responseKeywords },
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.nodeDetail(nodeId) });
            msgHelper.success(isEn ? t("learning.material.englishGenerated") : t("learning.material.generated"), {
              duration: 8000,
              action: { label: t("learning.material.generateCards"), onClick: () => handleGenerateCards(nodeId) },
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
    generateMaterial();
    // 依赖 node (来自 useQuery) + effectiveMaterialLang 触发;其余依赖通过闭包在触发时获取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, node, effectiveMaterialLang]);

  const handleChangeMaterialLang = (lang: MaterialLanguage) => {
    if (lang === effectiveMaterialLang || !node) return;
    const isEn = lang === "en";
    const materialLangCode = isEn ? "en-US" : "zh-CN";
    const material = node.learning_material?.[materialLangCode];
    const nodeKeywords = node.keywords?.[materialLangCode] || [];
    if (material && material.trim().length > 0) {
      setArticleContent(material);
      setKeywords(nodeKeywords);
      setIsGenerating(false);
    } else {
      // 目标语言尚未生成,清空正文进入加载态,由 effect 触发 AI 生成
      setArticleContent("");
      setKeywords([]);
    }
    setMaterialLanguage(lang);
  };

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
      let taskId: string;
      const existingTask = await schedulerApi.get(nodeId).catch(() => null);
      if (existingTask?.id) { taskId = existingTask.id; }
      else {
        const newTask = await schedulerApi.create({
          title: nodeTitle || `学习: ${nodeId}`, knowledge_point_id: nodeId,
          task_type: "learning", queue_level: 1, estimated_duration: 30,
        });
        taskId = newTask.id;
      }
      await completeFocusTimer();
      await schedulerApi.createFirstReviewTask({ knowledge_point_id: nodeId, task_id: taskId });
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
    setIsGenerating(true); setArticleContent("");
    try {
      const node = await api.nodes.get(nodeId);
      const isEn = effectiveMaterialLang === "en";
      const response = await api.ai.generateLearningMaterial({
        topic: node.title || "", context: node.content, level: node.level,
        graph_id: graphId, language: isEn ? "en-US" : "zh-CN",
        schema_id: selectedSchemaId,
      });
      if (response.content) {
        setArticleContent(response.content);
        setKeywords(response.keywords || []);
        const materialLangCode = isEn ? "en-US" : "zh-CN";
        await api.nodes.update(nodeId, {
          learning_material: { ...(node.learning_material || {}), [materialLangCode]: response.content },
          keywords: { ...(node.keywords || {}), [materialLangCode]: response.keywords || [] },
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.nodeDetail(nodeId) });
        msgHelper.success(t("learning.material.regenerated"));
      }
    } catch (error) {
      console.error("Failed to regenerate learning material:", error);
      msgHelper.error(t("learning.material.regenerateFailed"));
    } finally { setIsGenerating(false); }
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

    const isCapacitor = isCapacitorMobile();
    if (isCapacitor) {
      if (!mobileAIService.isConfigured()) {
        msgHelper.error(t("learning.cards.configureApiKey"), {
          action: { label: t("learning.cards.goToSettings"), onClick: () => navigate("/settings#prompts") },
        });
        return;
      }
      const targetIds = config.targetNodeIds?.length ? config.targetNodeIds : (nodeId ? [nodeId] : []);
      if (targetIds.length === 0) {
        msgHelper.warning(t("learning.cards.selectNode"));
        return;
      }
      setIsGeneratingCards(true);
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;
      try {
        const client = getMobileSupabaseClient();
        if (!client) throw new Error("Supabase client not initialized");
        const totalCards = Math.max(1, config.count);
        // 题库批量：每个节点各产一份完整题量，卡片总数 = 节点数 × totalCards
        const totalExpected = totalCards * targetIds.length;
        setGenerateProgress({ current: 0, total: totalExpected, isGenerating: true });

        let generatedCount = 0;
        let savedCount = 0;
        const batchSize = 3;
        for (let nIndex = 0; nIndex < targetIds.length; nIndex++) {
          const id = targetIds[nIndex];
          const nodeQuota = totalCards;
          if (nodeQuota <= 0) continue;

          const { data: graphNodes, error: gnError } = await client
            .from("graph_nodes")
            .select(`knowledge_point_id, graph_id, knowledge_points ( id, title, content )`)
            .eq("knowledge_point_id", id).is("deleted_at", null);
          if (gnError) { console.error("查询 graph_nodes 失败:", gnError); msgHelper.error(t("learning.cards.queryFailed")); continue; }
          if (!graphNodes || graphNodes.length === 0) { continue; }
          const graphNode = graphNodes[0] as unknown as {
            knowledge_point_id: string; graph_id: string;
            knowledge_points?: { id: string; title?: string | null; content?: string | null } | null;
          };
          const node = {
            knowledge_point_id: graphNode.knowledge_point_id, graph_id: graphNode.graph_id,
            title: graphNode.knowledge_points?.title || "", content: graphNode.knowledge_points?.content || "",
          };

          const nodeBatches = Math.ceil(nodeQuota / batchSize);
          for (let i = 0; i < nodeBatches; i++) {
            if (signal.aborted) { break; }
            const currentBatchSize = Math.min(batchSize, nodeQuota - (i * batchSize));
            if (currentBatchSize <= 0) { continue; }
            setGenerateProgress({ current: generatedCount, total: totalExpected, isGenerating: true });
            msgHelper.info(t("learning.cards.generating", {
              start: generatedCount + 1, end: generatedCount + currentBatchSize, total: totalExpected,
            }), { duration: 2500 });
            try {
              const result = await mobileAIService.generateAndSaveCards(
                node.title || "", node.content || "", node.knowledge_point_id, node.graph_id,
                {
                  types: config.types,
                  count: currentBatchSize,
                  difficulty: config.difficulty,
                  coverage: config.coverage,
                  customPrompt: config.customPrompt || undefined,
                  // 把二维矩阵信息传入移动端服务，本地按权重/难度分派：
                  cardsPerType: cardsPerTypeNum,
                  countPerDifficulty: countPerDiffNum,
                  countMatrix: countMatrixNum,
                },
              );
              if (result.success) {
                generatedCount += currentBatchSize;
                savedCount += result.savedCount;
                setGenerateProgress({ current: generatedCount, total: totalExpected, isGenerating: true });
              }
            } catch (batchError) {
              console.error(`Batch ${nIndex + 1}-${i + 1} failed:`, batchError);
              msgHelper.warning(t("learning.cards.batchFailed", { batch: nIndex * nodeBatches + i + 1 }), { duration: 3000 });
            }
          }
        }
        if (!signal.aborted && savedCount > 0) {
          if (isChallengePendingRef.current) {
            isChallengePendingRef.current = false;
            setIsGenModalOpen(false);
            await startChallengeSession();
          } else {
            msgHelper.success(t("learning.cards.generateSuccess", { count: savedCount }), {
              duration: 5000,
              action: { label: t("learning.cards.startChallenge"), onClick: handleStartChallenge },
            });
          }
        }
      } catch (error) {
        console.error("[LearningMode] 移动端题目生成异常:", error);
        const isAICardGenError = (err: unknown): err is AICardGenError => typeof err === "object" && err !== null && "type" in err && "suggestion" in err;
        if (isAICardGenError(error)) { handleAICardGenError(error, config); }
        else {
          const errorMessage = error instanceof Error ? error.message : t("learning.cards.generateFailed");
          msgHelper.error(errorMessage, {
            duration: 5000,
            action: { label: t("learning.cards.retry"), onClick: () => handleManualGenerateCards(config) },
          });
        }
      } finally { setIsGeneratingCards(false); setGenerateProgress(null); abortControllerRef.current = null; }
      return;
    }

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
          await pollGenerationTasksThenChallenge(result.taskIds);
          return;
        }
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

  const pollGenerationTasksThenChallenge = async (taskIds: string[]) => {
    msgHelper.info(t("learning.challenge.challengeGenerating"), { duration: 6000 });
    setGenerateProgress({ current: 0, total: taskIds.length, isGenerating: true });
    const intervalMs = 3000;
    const maxAttempts = 200;
    const maxConsecutivePollFailures = 5;
    let consecutivePollFailures = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      if (!isChallengePendingRef.current) return;
      const statuses = await Promise.all(
        taskIds.map((id) => api.ai.getTaskStatus(id).catch(() => null)),
      );
      // 全部查询失败视为网络/服务异常：连续超过阈值即终止，
      // 避免瞬时故障让 allSettled 永不成立而空转到 maxAttempts
      if (statuses.every((s) => s === null)) {
        consecutivePollFailures++;
        if (consecutivePollFailures >= maxConsecutivePollFailures) {
          setGenerateProgress(null);
          isChallengePendingRef.current = false;
          msgHelper.error(t("learning.challenge.challengeGenerateFailed"));
          return;
        }
        continue;
      }
      consecutivePollFailures = 0;
      const fetched = statuses.filter((s): s is { status: string } => !!s);
      const completedCount = fetched.filter((s) => s.status === "completed").length;
      setGenerateProgress({ current: completedCount, total: taskIds.length, isGenerating: true });
      const allSettled =
        fetched.length === taskIds.length &&
        fetched.every((s) => TASK_TERMINAL_STATUSES.includes(s.status));
      if (allSettled) {
        setGenerateProgress(null);
        isChallengePendingRef.current = false;
        if (completedCount === taskIds.length) {
          setIsGenModalOpen(false);
          await startChallengeSession();
        } else {
          msgHelper.error(t("learning.challenge.challengeGenerateFailed"));
        }
        return;
      }
    }
    setGenerateProgress(null);
    isChallengePendingRef.current = false;
    msgHelper.info(t("learning.challenge.challengeGenerateTimeout"));
  };

  const handleAICardGenError = (
    error: AICardGenError,
    config: {
      count: number;
      types: string[];
      cardsPerType: Partial<Record<string, number>>;
      countPerDifficulty: Partial<Record<"easy" | "medium" | "hard", number>>;
      countMatrix?: Record<string, { easy: number; medium: number; hard: number }>;
      difficulty: "easy" | "medium" | "hard" | "mixed";
      coverage: "current_only" | "with_children" | "with_siblings" | "graph";
      customPrompt: string;
      targetNodeIds: string[];
    },
  ) => {
    switch (error.type) {
      case "api_key_missing": case "api_key_invalid":
        msgHelper.error(error.message, { duration: 8000, action: { label: t("learning.cards.goToSettings"), onClick: () => navigate("/settings#prompts") } });
        break;
      case "quota_exceeded":
        msgHelper.error(error.message, { duration: 8000 }); msgHelper.info(error.suggestion, { duration: 8000 });
        break;
      case "rate_limited":
        msgHelper.warning(error.message, { duration: 5000, action: { label: t("learning.cards.retryLater"), onClick: () => setIsGenModalOpen(true) } });
        break;
      case "network_error": case "timeout":
        msgHelper.error(error.message, { duration: 5000, action: { label: t("learning.cards.retry"), onClick: () => handleManualGenerateCards(config) } });
        break;
      case "database_error":
        msgHelper.error(error.message, { duration: 8000 });
        msgHelper.info(error.suggestion, { duration: 8000, action: error.retryable ? { label: t("learning.cards.retry"), onClick: () => handleManualGenerateCards(config) } : undefined });
        break;
      case "invalid_response":
        msgHelper.warning(error.message, { duration: 5000, action: { label: t("learning.cards.retry"), onClick: () => handleManualGenerateCards(config) } });
        break;
      default: msgHelper.error(error.message, { duration: 5000 });
    }
  };

  const handleCancelGenerate = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); msgHelper.info(t("learning.cards.cancelling")); }
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
          graphData={graphData} graphMeta={graphMeta}
          onNodeClick={handleNodeClick} onSelectionChange={setSelectedNodeIds}
          onBatchAction={handleBatchAction} onAddNode={() => setIsCreateNodeModalOpen(true)}
          onCreateQuizSet={handleCreateQuizSet}
          onBackToGraphOutline={handleBackToGraphOutline}
        />

        {nodeId ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              <LearningArticleReader
                isDark={isDark} isMobile={isMobile} nodeId={nodeId} graphId={graphId}
                nodeTitle={nodeTitle} articleContent={articleContent} keywords={keywords}
                materialLang={effectiveMaterialLang} onChangeMaterialLang={handleChangeMaterialLang}
                isGenerating={isGenerating || isNodeLoading} isOnline={isOnline} isGeneratingCards={isGeneratingCards}
                studyMode={studyMode} highlightEnabled={highlightEnabled}
                linkedTask={linkedTask} nodeStatus={_nodeStatus}
                fontSize={fontSize} fontFamily={fontFamily} lineHeight={lineHeight}
                readingMode={readingMode} contentWidthMode={contentWidthMode}
                getStudyModeIcon={getStudyModeIcon} getStrategyHint={getStrategyHint}
                shouldShowArticle={shouldShowArticle} shouldShowQuiz={shouldShowQuiz}
                onToggleHighlight={() => setHighlightEnabled(!highlightEnabled)}
                onRegenerateMaterial={handleRegenerateMaterial}
                onStartChallenge={handleStartChallenge}
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
        onClose={() => { setIsGenModalOpen(false); isChallengePendingRef.current = false; }}
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

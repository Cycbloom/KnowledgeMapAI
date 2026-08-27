import React, {
  useMemo,
  lazy,
  Suspense,
  useCallback,
  useState,
  useLayoutEffect,
  useEffect,
  useRef,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useStore } from "../store/useStore";
import { useGraphStyleSettingsStore } from "../store/useGraphStyleSettingsStore";
import { useNodeDisplayLanguageStore } from "../store/useNodeDisplayLanguageStore";
import { setNodeDisplayLanguage } from "@shared/utils/localization";
import { message } from "../utils/messageHelper";
import { ArrowLeft, Lock, LogIn, AlertTriangle } from "lucide-react";

import { GraphToolbar } from "../components/GraphEditor/toolbar/GraphToolbar";
import { MindMapCanvas } from "../components/GraphEditor/canvas/MindMapCanvas";
import { invalidateGraphLayoutCache } from "../utils/graph/layoutCache";
import { QuadrantCanvas } from "../components/GraphEditor/canvas/QuadrantCanvas";
import { NodeBreadcrumb, type NodeBreadcrumbItem } from "../components/GraphEditor/shared/NodeBreadcrumb";
import {
  useGraphEffects,
  useGraphEditorState,
  useGraphHistoryHandlers,
  useGraphNodeOperations,
  useGraphExportOperations,
  useGraphInteraction,
  useExplorationPath,
  useNodeStatusSets,
  useGraphEditorPanelState,
  useFocusNode,
  useBranchSelection,
} from "../hooks/graphEditor";
import { useGraphAIOperations } from "../hooks/graphAI";
import { queryKeys } from "../hooks/queries/config";
import {
  useTheme,
  useIsMobile,
  useGlobalShortcuts,
  useTutorOperations,
  useQuoteShortcut,
} from "../hooks";
import { useRecentGraphs } from "../hooks/queries/useRecentGraphs";
import { addRecentNode } from "../hooks/queries/useRecentNodes";
import { isAppError } from "../utils/errors";
import { api } from "../services/api";
import { computeRegions } from "../utils/graph";
import { useDocumentTitle } from "../hooks/common/useDocumentTitle";
import { useNavigateBack } from "../hooks/common/useNavigateBack";
import {
  useGraph,
  useGraphData,
  useGraphDataWithEmbedding,
  useAIStatus,
} from "../hooks/queries";
import { useGraphMutations } from "../hooks/mutations";
import type {
  Node as GraphNode,
  ColorScheme,
  GraphColorMode,
  LinkStyle,
  LinkAnimation,
  NodeSizeMode,
  EdgeWidthMode,
  TutorExtractedConcept,
} from "../types";
import type {
  TemplateLayout,
} from "@shared/types/graph";
import { PresentationControls } from "../components/GraphEditor/toolbar/PresentationControls";
import { NarrativeControls } from "../components/GraphEditor/canvas/NarrativeControls";
import { ActionResultModal } from "../components/GraphEditor/modals/ActionResultModal";
import { NodeContextMenu } from "../components/GraphEditor/context-menu/NodeContextMenu";
import { CanvasContextMenu } from "../components/GraphEditor/context-menu/CanvasContextMenu";
import {
  CommandPalette,
  CommandItem,
} from "../components/GraphEditor/shared/CommandPalette";
import { ErrorBoundary, Skeleton } from "../components/common";
import { useQueryClient, QueryErrorResetBoundary } from "@tanstack/react-query";
import { useCommandPalette } from "./GraphEditor/useCommandPalette";
import { useLearningPathHandlers } from "./GraphEditor/hooks/useLearningPathHandlers";
import { useRegionHandlers } from "./GraphEditor/hooks/useRegionHandlers";
import { useConceptExtractionHandlers } from "./GraphEditor/hooks/useConceptExtractionHandlers";

const TimelineView = lazy(() =>
  import("../components/GraphEditor/views/TimelineView").then((module) => ({
    default: module.TimelineView,
  })),
);
const TreeView = lazy(() =>
  import("../components/GraphEditor/views/TreeView").then((module) => ({
    default: module.TreeView,
  })),
);
const PlanetView = lazy(() =>
  import("../three/PlanetView").then((module) => ({
    default: module.PlanetView,
  })),
);

const GraphSidebarManager = lazy(() =>
  import("../components/GraphEditor/sidebar/GraphSidebarManager").then(
    (module) => ({
      default: module.GraphSidebarManager,
    }),
  ),
);

const GraphAnalysisPanel = lazy(() =>
  import("../components/GraphEditor/panels/GraphAnalysisPanel").then(
    (module) => ({
      default: module.GraphAnalysisPanel,
    }),
  ),
);

const RAGChatButton = lazy(() =>
  import("../components/GraphEditor/panels/RAGChatPanel").then((module) => ({
    default: module.RAGChatButton,
  })),
);

import { addQuote } from "../components/RAGChat";
import {
  OnboardingGuide,
  isOnboardingComplete,
  startOnboardingTour,
} from "../components/GraphEditor/OnboardingGuide";

const VersionHistoryPanel = lazy(() =>
  import("../components/GraphEditor/panels/VersionHistoryPanel").then(
    (module) => ({
      default: module.VersionHistoryPanel,
    }),
  ),
);

const DiffDetailPanel = lazy(() =>
  import("../components/GraphEditor/panels/DiffDetailPanel").then(
    (module) => ({
      default: module.DiffDetailPanel,
    }),
  ),
);

const ConceptPreviewList = lazy(() =>
  import("../components/LiteratureExtract/ConceptPreviewList").then(
    (module) => ({
      default: module.ConceptPreviewList,
    }),
  ),
);

const ConceptAggregationPanel = lazy(() =>
  import("../components/ConceptAggregation").then((module) => ({
    default: module.ConceptAggregationPanel,
  })),
);

const Console = lazy(() =>
  import("../components/Console/Console").then((module) => ({
    default: module.Console,
  })),
);

const GraphModalManager = lazy(() =>
  import("../components/GraphEditor/modals/GraphModalManager").then((module) => ({
    default: module.GraphModalManager,
  })),
);

const GraphStyleSettings = lazy(() =>
  import("../components/GraphEditor/shared/GraphStyleSettings").then((module) => ({
    default: module.GraphStyleSettings,
  })),
);

const RelationshipTypeSettings = lazy(() =>
  import("../components/GraphEditor/shared/RelationshipTypeSettings").then((module) => ({
    default: module.RelationshipTypeSettings,
  })),
);

const ExplorationTimeline = lazy(() =>
  import("../components/GraphEditor/shared/ExplorationTimeline").then((module) => ({
    default: module.ExplorationTimeline,
  })),
);

const MobileNodeActionMenu = lazy(() =>
  import("../components/GraphEditor/mobile/MobileNodeActionMenu").then((module) => ({
    default: module.MobileNodeActionMenu,
  })),
);

const GenerateCardsModal = lazy(() =>
  import("../components/Learning/GenerateCardsModal").then((module) => ({
    default: module.GenerateCardsModal,
  })),
);

const TextToGraphModal = lazy(() =>
  import("../components/GraphEditor/modals/TextToGraphModal").then((module) => ({
    default: module.TextToGraphModal,
  })),
);

const SimilarNodesPanel = lazy(() =>
  import("../components/GraphEditor/panels/SimilarNodesPanel").then((module) => ({
    default: module.SimilarNodesPanel,
  })),
);

const SmartStylePanel = lazy(() =>
  import("../components/GraphEditor/panels/SmartStylePanel").then((module) => ({
    default: module.SmartStylePanel,
  })),
);

const NodeTranslatePanel = lazy(() =>
  import("../components/GraphEditor/panels/NodeTranslatePanel").then((module) => ({
    default: module.NodeTranslatePanel,
  })),
);

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { goBack } = useNavigateBack();
  const [searchParams] = useSearchParams();
  const nodeIdFromUrl = searchParams.get("node_id");
  const { token, user } = useStore();
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile } = useIsMobile();
  const queryClient = useQueryClient();

  // 节点内容显示语言：同步 shared 全局显示语言，变化时重新解析节点字段并刷新
  const displayLanguage = useNodeDisplayLanguageStore(
    (s) => s.displayLanguage,
  );
  useEffect(() => {
    setNodeDisplayLanguage(displayLanguage);
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.nodeDetail(id) });
    }
  }, [displayLanguage, id, queryClient]);

  const ViewLoader = () => (
    <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm ${isDark ? 'bg-slate-900/50' : 'bg-white/50'}`}>
      <div className="w-full max-w-md space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );

  const isAuthenticated = !!token;
  const isReadOnly = !isAuthenticated;

  const [mobileActionMenuOpen, setMobileActionMenuOpen] = useState(false);
  const [mobileActionNodeId, setMobileActionNodeId] = useState<string | null>(
    null,
  );
  const [isMobilePreviewMode, setIsMobilePreviewMode] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(!isOnboardingComplete());
  const [isTextToGraphOpen, setIsTextToGraphOpen] = useState(false);
  const [isSimilarNodesOpen, setIsSimilarNodesOpen] = useState(false);
  const [isSmartStyleOpen, setIsSmartStyleOpen] = useState(false);
  const [isNodeTranslateOpen, setIsNodeTranslateOpen] = useState(false);

  const panelState = useGraphEditorPanelState({ userId: user?.id || "" });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const [clipboard] = useState<string[]>([]);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("default");
  const [linkStyle, setLinkStyle] = useState<LinkStyle>("curved");
  const [linkAnimation, setLinkAnimation] = useState<LinkAnimation>("none");
  const [nodeGlow, setNodeGlow] = useState(false);
  const [nodeSizeMode, setNodeSizeMode] = useState<NodeSizeMode>("fixed");
  const [edgeWidthMode, setEdgeWidthMode] = useState<EdgeWidthMode>("fixed");
  const [coloringMode, setColoringMode] = useState<GraphColorMode>("level"); // Default to level (structure) as requested
  const [edgeDisplayMode, setEdgeDisplayMode] = useState<'full' | 'simplified' | 'hidden'>('full');
  const [zoomLevel, setZoomLevel] = useState(1);

  // 新增的持久化样式设置（节点形状 / 连线端点箭头 / 背景网格）
  const {
    nodeShape,
    centerDotShape,
    linkCap,
    arrowStyle,
    linkWidth,
    gridStyle,
  } = useGraphStyleSettingsStore();

  useQuoteShortcut({
    onAddQuote: addQuote,
    isChatOpen: panelState.isRAGChatOpen,
    onOpenChat: () => panelState.setIsRAGChatOpen(true),
  });
  const [isSelectingParentNode, setIsSelectingParentNode] = useState(false);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);

  const {
    customRegions,
    originPosition,
    collapsedRegions,
    handleCreateRegion,
    handleRegionToggle,
    handleOriginMove,
  } = useRegionHandlers();

  const { handleConfirmConcepts } =
    useConceptExtractionHandlers({
      id,
      panelState,
      queryClient,
    });

  const handleStartSelectingParent = useCallback(() => {
    setIsSelectingParentNode(true);
  }, []);

  const handleCancelSelectingParent = useCallback(() => {
    setIsSelectingParentNode(false);
  }, []);

  const { addRecentGraph, removeRecentGraph } = useRecentGraphs();
  const { data: graphMeta, isError: isGraphError, error: graphError } = useGraph(id || "");
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || "");

  useDocumentTitle(graphMeta?.title, t("documentTitle.suffix"));

  // Record graph access for recent graphs quick access
  useEffect(() => {
    if (graphMeta && id) {
      addRecentGraph({
        id,
        topic: graphMeta.title,
        updated_at: graphMeta.updated_at,
        is_favorite: graphMeta.is_favorite,
      });
    }
  }, [graphMeta, id, addRecentGraph]);

  // 图谱不存在时（404），从最近编辑列表中清理该条目，避免死链
  useEffect(() => {
    if (id && isGraphError && isAppError(graphError) && graphError.statusCode === 404) {
      removeRecentGraph(id);
    }
  }, [id, isGraphError, graphError, removeRecentGraph]);
  const nodeStatus = graphData?.nodeStatus ?? {};
  const { data: aiStatus } = useAIStatus(!!token);
  const aiEnabled = aiStatus?.enabled ?? true;

  const templateLayout = graphMeta?.settings?.layout as TemplateLayout | undefined;

  const nodes = useMemo(() => graphData?.nodes || [], [graphData?.nodes]);
  const edges = useMemo(() => graphData?.edges || [], [graphData?.edges]);

  // 预构建 node.id -> node 映射，供渲染与事件路径复用，避免多次线性 find（原各处 O(nodes) 扫描）
  const nodeById = useMemo(() => {
    const m = new Map<string, (typeof nodes)[number]>();
    nodes.forEach((n) => {
      m.set(n.id, n);
    });
    return m;
  }, [nodes]);

  // State Hook
  const state = useGraphEditorState();
  const {
    graphRef,
    selectedNode,
    setSelectedNode,
    selectedNodeIds,
    setSelectedNodeIds,
    sidebarMode,
    setSidebarMode,
    prevSidebarMode,
    setPrevSidebarMode,
    isDeleteMode,
    setIsDeleteMode,
    isPathfindingMode,
    setIsPathfindingMode,
    showGrid,
    setShowGrid,
    isFocusMode,
    setIsFocusMode,
    viewMode,
    setViewMode,
    focusedNodeId,
    setFocusedNodeId,
    focusedNodeIds,
    setFocusedNodeIds,
    focusedLinkIds,
    setFocusedLinkIds,
    forceShowTextIds,
    setForceShowTextIds,
    isExplorationMode,
    setIsExplorationMode,
    branchSuggestions,
    setBranchSuggestions,
    isTimelineVisible,
    setIsTimelineVisible,
    historicalAlternativeBranches,
    setHistoricalAlternativeBranches,
    isAnalysisPanelOpen,
    setIsAnalysisPanelOpen,
    // Presentation state
    isPresentationMode,
    setIsPresentationMode,
    presentationStep,
    setPresentationStep,
    // Layout
    sidebarWidth,
    // Node form
    nodeForm,
    setNodeForm,
    // Pathfinding
    pathStartNode,
    setPathStartNode,
    pathEndNode,
    setPathEndNode,
    highlightedPath,
    setHighlightedPath,
    // Export
    isExportMenuOpen,
    setIsExportMenuOpen,
    setIsExportImageModalOpen,
    // Tutor
    isTutorMode,
    tutorMode,
    setTutorMode,
    suggestedNextTopics,
    // Modal setters
    setIsSettingsOpen,
    setIsHelpOpen,
    setIsShareModalOpen,
    setIsPodcastModalOpen,
    // Narrative state
    isNarrativeMode: isNarrativeModeState,
    isPlaying: isNarrativePlaying,
    playSpeed: narrativePlaySpeed,
    currentStep: narrativeCurrentStep,
    totalSteps: narrativeTotalSteps,
    revealedNodeIds: narrativeRevealedNodeIds,
    narrativePath,
    isNarrativeComplete,
    startNarrative,
    exitNarrative,
    playNext: narrativePlayNext,
    playPrev: narrativePlayPrev,
    reset: narrativeReset,
    togglePlay: narrativeTogglePlay,
    setPlaySpeed: setNarrativePlaySpeed,
  } = state;

  const { data: embeddingData } = useGraphDataWithEmbedding(
    viewMode === "semantic" && id ? id : ""
  );

  const embeddingNodes = embeddingData?.nodes;
  const embeddingsMap = useMemo(() => {
    if (!embeddingNodes) return undefined;
    const map = new Map<string, number[]>();
    for (const node of embeddingNodes) {
      let emb = node.embedding;
      // 容错：后端可能返回 pgvector 字符串格式
      if (typeof emb === 'string') {
        try { emb = JSON.parse(emb); } catch { emb = undefined; }
      }
      if (emb && Array.isArray(emb) && emb.length > 0) {
        map.set(node.id, emb);
      }
    }
    return map.size > 0 ? map : undefined;
  }, [embeddingNodes]);

  const handleSelectParentFromGraph = useCallback(
    (nodeId: string) => {
      if (selectedNode?.id === nodeId) return;
      setNodeForm((prev) => {
        const currentIds = prev.parentNodeIds;
        if (currentIds.includes(nodeId)) {
          return {
            ...prev,
            parentNodeIds: currentIds.filter((id) => id !== nodeId),
          };
        } else {
          return { ...prev, parentNodeIds: [...currentIds, nodeId] };
        }
      });
    },
    [selectedNode, setNodeForm],
  );

  useLayoutEffect(() => {
    if (
      sidebarMode === "none" ||
      (sidebarMode !== "create" && sidebarMode !== "edit")
    ) {
      setIsSelectingParentNode(false);
    }
  }, [sidebarMode]);

  // Focus Node Hook
  const { focusNode, focusNodeWithNode, clearFocus } = useFocusNode({
    nodes,
    edges,
    setSelectedNode,
    setSelectedNodeIds,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    setForceShowTextIds,
  });

  // 节点层级面包屑：基于 edges 回溯 selectedNode 的父链（source 为父，target 为子）
  const parentChain = useMemo<NodeBreadcrumbItem[]>(() => {
    const selectedNodeId = selectedNode?.id;
    if (!selectedNodeId) return [];

    const parentMap = new Map<string, string>();
    for (const edge of edges) {
      const childId = edge.target_knowledge_point_id;
      const parentId = edge.source_knowledge_point_id;
      if (!parentMap.has(childId)) {
        parentMap.set(childId, parentId);
      }
    }

    const titleMap = new Map<string, string>();
    for (const node of nodes) {
      titleMap.set(node.id, node.title ?? t("graphEditor.unnamed.node"));
    }

    const chain: NodeBreadcrumbItem[] = [];
    const visited = new Set<string>();
    let currentParentId = parentMap.get(selectedNodeId);
    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      chain.push({
        id: currentParentId,
        title: titleMap.get(currentParentId) ?? t("graphEditor.unnamed.node"),
      });
      currentParentId = parentMap.get(currentParentId);
    }

    chain.reverse();
    return chain;
  }, [selectedNode?.id, edges, nodes, t]);

  // 记录最近访问节点：仅 nodeId 变化时写入，避免频繁写入 localStorage
  const lastRecordedNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedNode || !id || !graphMeta) return;
    if (lastRecordedNodeIdRef.current === selectedNode.id) return;
    lastRecordedNodeIdRef.current = selectedNode.id;
    addRecentNode({
      id: selectedNode.id,
      title: selectedNode.title ?? t("graphEditor.unnamed.node"),
      graphId: id,
      graphTopic: graphMeta.title ?? t("graphEditor.unnamed.graph"),
    });
  }, [selectedNode?.id, id, graphMeta, t]);

  // Narrative mode + learning path handlers (extracted hook)
  const {
    selectedLearningPathId,
    learningPathNodeIds,
    learningPathOrderMap,
    handleSelectLearningPath,
    handleStartNarrative,
    handleExitNarrative,
    handleLearningPathNodeClick,
  } = useLearningPathHandlers({
    nodes,
    viewMode,
    setViewMode,
    graphRef,
    isPresentationMode,
    setIsPresentationMode,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    savedTransform: state.savedTransform,
    startNarrative,
    exitNarrative,
    focusNodeWithNode,
  });

  // Presentation Mode Logic
  const presentationPath = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];

    // Simple DFS. 预计算映射，避免每个节点线性扫描 nodes/edges（原为 O(n^2 + n*e)）
    const nodeById = new Map<string, (typeof nodes)[number]>();
    nodes.forEach((n) => {
      nodeById.set(n.id, n);
    });
    const childrenBySource = new Map<string, string[]>();
    edges.forEach((e) => {
      const list = childrenBySource.get(e.source_knowledge_point_id);
      if (list) {
        list.push(e.target_knowledge_point_id);
      } else {
        childrenBySource.set(e.source_knowledge_point_id, [
          e.target_knowledge_point_id,
        ]);
      }
    });

    const root = nodes.find((n) => n.level === "root") || nodes[0];
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;

      const node = nodeById.get(nodeId);
      // Visibility check based on mode
      if (!node) return;
      if (!isExplorationMode && node.is_accepted === false) return;

      visited.add(nodeId);
      path.push(nodeId);

      const children = childrenBySource.get(nodeId) ?? [];

      children.forEach((childId) => dfs(childId));
    };

    if (root) dfs(root.id);
    return path;
  }, [nodes, edges, isExplorationMode]);

  // Sync focused node when step changes
  React.useEffect(() => {
    if (isPresentationMode && presentationPath.length > 0) {
      const nodeId = presentationPath[presentationStep];
      if (nodeId) {
        focusNode(nodeId);
        // Sync sidebar selection
        setSelectedNodeIds(new Set([nodeId]));
      }
    }
  }, [
    isPresentationMode,
    presentationStep,
    presentationPath,
    focusNode,
    setSelectedNodeIds,
  ]);

  // Narrative mode: camera follow effect
  React.useEffect(() => {
    if (!isNarrativeModeState || narrativeCurrentStep <= 0 || narrativePath.length === 0) return;

    const currentNodeId = narrativePath[narrativeCurrentStep - 1];
    if (!currentNodeId) return;

    // Center camera on the current narrative node
    const ref = graphRef.current;
    if (ref?.centerNode) {
      ref.centerNode(currentNodeId);
    }
  }, [isNarrativeModeState, narrativeCurrentStep, narrativePath, graphRef]);

  // Mutations Hook
  const mutations = useGraphMutations();

  // History Hook
  const { undo, redo, record, canUndo, canRedo } = useGraphHistoryHandlers({
    mutations,
  });

  // Operations Hooks
  const nodeOps = useGraphNodeOperations({
    id: id || "",
    nodes,
    edges,
    state,
    mutations: {
      ...mutations,
      updateNodeMutation: mutations.updateNodeOptimisticMutation,
    },
    record,
  });

  const aiOps = useGraphAIOperations({
    id: id || "",
    nodes,
    edges,
    state,
    mutations: {
      aiExpandMutation: mutations.aiExpandMutation,
      createTaskMutation: mutations.createTaskMutation,
      createNodeMutation: mutations.createNodeMutation,
      createEdgeMutation: mutations.createEdgeMutation,
      updateNodeMutation: mutations.updateNodeOptimisticMutation,
      recommendConnectionsMutation: mutations.recommendConnectionsMutation,
    },
    record,
    navigate,
    token,
    onActionResult: panelState.setActionResult,
  });

  const tutorOps = useTutorOperations({
    id: id || "",
    nodes,
    edges,
    state,
    mutations,
    record,
  });

  const exportOps = useGraphExportOperations({
    id: id || "",
    graphMeta,
    nodes,
    edges,
    state,
    mutations,
    navigate,
  });

  const interactionOps = useGraphInteraction({
    nodes,
    edges,
    nodeStatus,
    state,
    handleDeleteNode: nodeOps.handleDeleteNode,
  });

  // Effects Hook
  useGraphEffects({
    state,
    aiEnabled,
  });

  // Auto-show timeline when entering exploration mode
  useEffect(() => {
    if (isExplorationMode) {
      setIsTimelineVisible(true);
    }
  }, [isExplorationMode, setIsTimelineVisible]);

  // Exploration Path Hook
  const explorationPathOps = useExplorationPath({ graphId: id });

  // Branch Selection Hook
  const { selectBranch, switchBranch } = useBranchSelection({
    id,
    selectedNode,
    branchSuggestions,
    setBranchSuggestions,
    setHistoricalAlternativeBranches,
    handleCreateBranch: aiOps.handleCreateBranch,
    addToPath: explorationPathOps.addToPath,
    focusNodeWithNode,
  });

  // Computed Values
  const { graphStats } = useNodeStatusSets(nodeStatus, nodes, edges);

  const regions = useMemo(() => computeRegions({
    nodes,
    edges,
    templateType: graphMeta?.template_type,
    backboneModules: graphMeta?.backbone_modules,
    customRegions,
    collapsedRegions,
  }), [nodes, edges, graphMeta?.template_type, graphMeta?.backbone_modules, customRegions, collapsedRegions]);

  // Global Shortcuts (single dispatcher for all keyboard shortcuts)
  useGlobalShortcuts({
    handlers: {
      undo: () => {
        if (canUndo) undo();
      },
      redo: () => {
        if (canRedo) redo();
      },
      save: () => {
        if (sidebarMode === "edit" || sidebarMode === "create") {
          nodeOps.handleSaveNode();
        }
      },
      delete: () => {
        if (selectedNode) {
          nodeOps.handleDeleteNode(selectedNode);
        }
      },
      toggleSidebar: () => {
        if (sidebarMode === "none") setSidebarMode("outline");
        else setSidebarMode("none");
      },
      toggleGrid: () => setShowGrid((prev) => !prev),
      toggleFocusMode: () => setIsFocusMode((prev) => !prev),
      toggleDeleteMode: () => setIsDeleteMode((prev) => !prev),
      togglePathfindingMode: () => setIsPathfindingMode((prev) => !prev),
      toggleExplorationMode: () => setIsExplorationMode((prev) => !prev),
      showHelp: () => panelState.setIsShortcutHelpOpen(true),
      openCommandPalette: () => panelState.setIsCommandPaletteOpen((prev) => !prev),
      toggleTheme,
      openConsole: () => {
        if (panelState.isConsoleOpen) {
          panelState.closeConsole();
        } else {
          panelState.openConsole();
        }
      },
      "setViewMode:mindmap": () => setViewMode("mindmap"),
      "setViewMode:timeline": () => setViewMode("timeline"),
      "setViewMode:tree": () => setViewMode("tree"),
      "setViewMode:planet": () => setViewMode("planet"),
      "setViewMode:quadrant": () => setViewMode("quadrant"),
      goHome: () => navigate("/"),
      fitView: () => graphRef.current?.fitView?.(),
      fitSelection: () => {
        if (graphRef.current?.fitSelection) {
          graphRef.current.fitSelection(Array.from(selectedNodeIds));
        }
      },
      zoomIn: () => graphRef.current?.zoomIn?.(),
      zoomOut: () => graphRef.current?.zoomOut?.(),
      zoomReset: () => graphRef.current?.resetZoom?.(),
      presentationNext: () => {
        if (isPresentationMode) {
          setPresentationStep((p) =>
            Math.min(p + 1, presentationPath.length - 1),
          );
        }
      },
      presentationPrev: () => {
        if (isPresentationMode) {
          setPresentationStep((p) => Math.max(p - 1, 0));
        }
      },
    },
    context: {
      presentationMode: isPresentationMode,
    },
  });

  const handleCloseSidebar = useCallback(() => {
    if (prevSidebarMode === "outline") {
      setSidebarMode("outline");
      setPrevSidebarMode("none");
    } else {
      setSidebarMode("none");
    }
    clearFocus();
  }, [
    prevSidebarMode,
    setSidebarMode,
    setPrevSidebarMode,
    clearFocus,
  ]);

  const handleConnectNodes = useCallback(
    async (sourceId: string, targetId: string) => {
      try {
        await mutations.createEdgeMutation.mutateAsync({
          source_knowledge_point_id: sourceId,
          target_knowledge_point_id: targetId,
          graphId: id || "",
          relationship_type: "contains",
        });
        message.success(t("graphEditor.connectionCreated"));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : t("graphEditor.errors.unknownError");
        message.error(
          t("graphEditor.connectionCreateFailed", { message: errorMessage }),
        );
      }
    },
    [mutations.createEdgeMutation, id, t],
  );

  /**
   * 合并两个相似节点：将 remove 节点的内容并入 keeper，迁移 remove 的边到 keeper，然后删除 remove。
   */
  const handleMergeNodes = useCallback(
    async (keeperId: string, removeId: string): Promise<boolean> => {
      if (!id) return false;
      try {
        const keeper = nodes.find((n) => n.id === keeperId);
        const remove = nodes.find((n) => n.id === removeId);
        if (!keeper || !remove) return false;

        // 1. 合并内容：remove 的 content 追加到 keeper（若 keeper 无内容或内容不同）
        if (remove.content && remove.content.trim()) {
          const keeperContent = keeper.content || "";
          const removeContent = remove.content.trim();
          if (!keeperContent.includes(removeContent)) {
            const mergedContent = keeperContent
              ? `${keeperContent}\n\n${removeContent}`
              : removeContent;
            await mutations.updateNodeMutation.mutateAsync({
              id: keeperId,
              graphId: id,
              data: { content: mergedContent },
            });
          }
        }

        // 2. 迁移 remove 的边到 keeper
        const edgesToMigrate = edges.filter(
          (e) =>
            e.source_knowledge_point_id === removeId ||
            e.target_knowledge_point_id === removeId,
        );
        for (const edge of edgesToMigrate) {
          const source = edge.source_knowledge_point_id === removeId ? keeperId : edge.source_knowledge_point_id;
          const target = edge.target_knowledge_point_id === removeId ? keeperId : edge.target_knowledge_point_id;
          // 跳过自环
          if (source === target) continue;
          // 跳过已存在的边
          const exists = edges.some(
            (e) =>
              e.source_knowledge_point_id === source &&
              e.target_knowledge_point_id === target,
          );
          if (exists) continue;
          try {
            await mutations.createEdgeMutation.mutateAsync({
              source_knowledge_point_id: source,
              target_knowledge_point_id: target,
              graphId: id,
              relationship_type: edge.relationship_type || "contains",
            });
          } catch {
            // 忽略单条边迁移失败
          }
        }

        // 3. 删除 remove 节点（级联删除其边）
        await mutations.batchDeleteNodesMutation.mutateAsync({
          nodeIds: [removeId],
          graphId: id,
        });

        await queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
        message.success(t("graphEditor.similarNodes.mergeSuccess"));
        return true;
      } catch (error: unknown) {
        console.error("Merge nodes failed:", error);
        message.error(t("graphEditor.similarNodes.mergeFailed"));
        return false;
      }
    },
    [id, nodes, edges, mutations, queryClient, t],
  );

  /** 应用 AI 智能配色/图标建议：把 color/icon 写入 knowledge_points.properties */
  const handleApplySmartStyle = useCallback(
    async (suggestions: Array<{ node_id: string; color: string; icon: string; reason: string }>) => {
      if (!id) return;
      let appliedCount = 0;
      for (const s of suggestions) {
        const node = nodes.find((n) => n.id === s.node_id);
        if (!node) continue;
        const currentProps = node.properties || {};
        const nextProps = {
          ...currentProps,
          color: s.color,
          icon: s.icon,
        };
        try {
          await mutations.updateNodeMutation.mutateAsync({
            id: s.node_id,
            graphId: id,
            data: { properties: nextProps },
          });
          appliedCount++;
        } catch (err) {
          console.error(`Apply style to node ${s.node_id} failed:`, err);
        }
      }
      if (appliedCount > 0) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
      }
      if (appliedCount < suggestions.length) {
        message.warning(
          t("graphEditor.smartStyle.partialApplied", {
            count: appliedCount,
            total: suggestions.length,
          }),
        );
      }
    },
    [id, nodes, mutations, queryClient, t],
  );

  /** 应用节点翻译：把翻译后的 title/content/summary 写入目标语言 key */
  const handleApplyNodeTranslation = useCallback(
    async (
      translations: Array<{
        node_id: string;
        title: string;
        content?: string;
        summary?: string;
      }>,
      targetLanguage: string,
    ) => {
      if (!id) return;
      let appliedCount = 0;
      for (const tr of translations) {
        const node = nodes.find((n) => n.id === tr.node_id);
        if (!node) continue;
        const data: {
          title?: string;
          content?: string;
          summary?: string;
          language?: string;
        } = { language: targetLanguage };
        if (tr.title && tr.title !== node.title) data.title = tr.title;
        if (tr.content && tr.content !== node.content) data.content = tr.content;
        if (tr.summary && tr.summary !== node.summary) data.summary = tr.summary;
        if (!data.title && !data.content && !data.summary) {
          appliedCount++;
          continue;
        }
        try {
          await mutations.updateNodeMutation.mutateAsync({
            id: tr.node_id,
            graphId: id,
            data,
          });
          appliedCount++;
        } catch (err) {
          console.warn(`Apply translation to node ${tr.node_id} failed:`, err);
        }
      }
      if (appliedCount > 0) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
      }
      if (appliedCount < translations.length) {
        message.warning(
          t("graphEditor.nodeTranslate.partialApplied", {
            count: appliedCount,
            total: translations.length,
          }),
        );
      }
    },
    [id, nodes, mutations, queryClient, t],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      focusNodeWithNode(node);

      if (isMobile && isMobilePreviewMode) {
        // 预览模式：不打开侧边栏，只选中节点
      } else {
        // 侧边栏模式：打开详情侧边栏
        setSidebarMode("detail");
      }
    },
    [
      focusNodeWithNode,
      setSidebarMode,
      isMobile,
      isMobilePreviewMode,
    ],
  );

  const handleGetBranchSuggestions = useCallback(async () => {
    if (!selectedNode || !id) return;
    const suggestions = await aiOps.handleGetBranchSuggestions();
    setBranchSuggestions(suggestions);
  }, [selectedNode, id, aiOps, setBranchSuggestions]);

  const handleCanvasClick = useCallback(() => {
    clearFocus();
    setContextMenu(null);
    setCanvasContextMenu(null);
    if (sidebarMode !== "none" && sidebarMode !== "outline") {
      setSidebarMode("none");
    }
  }, [
    clearFocus,
    sidebarMode,
    setSidebarMode,
  ]);

  // Marquee (box) multi-select handler. Shift+drag on empty canvas triggers it;
  // when additive (Shift held at mouseup) the new selection is unioned with the
  // existing selection, otherwise it replaces it.
  const handleMarqueeSelect = useCallback(
    (ids: string[], additive: boolean) => {
      if (additive) {
        setSelectedNodeIds((prev) => new Set([...prev, ...ids]));
      } else {
        setSelectedNodeIds(new Set(ids));
        if (ids.length === 1) {
          const node = nodes.find((n) => n.id === ids[0]);
          if (node) {
            setSelectedNode(node);
          }
        } else if (ids.length === 0) {
          setSelectedNode(null);
        }
      }
    },
    [setSelectedNodeIds, setSelectedNode, nodes],
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: GraphNode) => {
      event.preventDefault();
      setCanvasContextMenu(null);
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  const handleCanvasContextMenu = useCallback(
    (event: React.MouseEvent, canvasPosition: { x: number; y: number }) => {
      event.preventDefault();
      setContextMenu(null);
      setCanvasContextMenu({
        x: event.clientX,
        y: event.clientY,
        canvasX: canvasPosition.x,
        canvasY: canvasPosition.y,
      });
    },
    [],
  );

  const handleCreateNodeAtPosition = useCallback(async () => {
    if (!id || !canvasContextMenu) return;
    try {
      const newNode = await mutations.createNodeMutation.mutateAsync({
        graph_id: id,
        title: t('graphEditor.nodeCreation.newNode'),
        x_position: Math.round(canvasContextMenu.canvasX),
        y_position: Math.round(canvasContextMenu.canvasY),
        level: 'leaf',
        properties: {},
      });
      record({ type: 'CREATE_NODE', payload: newNode });
      setSelectedNode(newNode);
      setSidebarMode('edit');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('graphEditor.nodeCreation.unknownError');
      message.error(t('graphEditor.nodeCreation.createNodeFailed', { message: errorMessage }));
    }
  }, [id, canvasContextMenu, mutations.createNodeMutation, record, setSelectedNode, setSidebarMode, t]);

  const handlePasteNodes = useCallback(() => {
    // Paste is a placeholder - No-op for now until full copy/paste is implemented
  }, []);

  const handleSelectAllNodes = useCallback(() => {
    const allNodeIds = new Set(nodes.map((n) => n.id));
    setSelectedNodeIds(allNodeIds);
  }, [nodes, setSelectedNodeIds]);

  const handleCanvasFitView = useCallback(() => {
    if (graphRef.current?.fitView) {
      graphRef.current.fitView();
    }
  }, [graphRef]);

  const handleCanvasZoomIn = useCallback(() => {
    if (graphRef.current?.zoomIn) {
      graphRef.current.zoomIn();
    }
  }, [graphRef]);

  const handleCanvasZoomOut = useCallback(() => {
    if (graphRef.current?.zoomOut) {
      graphRef.current.zoomOut();
    }
  }, [graphRef]);

  const handleCanvasZoomReset = useCallback(() => {
    if (graphRef.current?.resetZoom) {
      graphRef.current.resetZoom();
    }
  }, [graphRef]);

  const handleNodeLongPress = useCallback((node: GraphNode) => {
    setMobileActionNodeId(node.id);
    setMobileActionMenuOpen(true);
  }, []);

  // --- Extracted callbacks for child components ---

  const handleLayoutUpdate = useCallback(() => {
    // 整理布局意味着要刷新布局：清空该图谱的坐标缓存，强制下次重新计算而不是复用旧布局
    invalidateGraphLayoutCache(id || undefined);
    queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id || "") });
  }, [queryClient, id]);

  const handleMarkNodeMastered = useCallback(async (_nodeId: string) => {
    try {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.graphNodeStatus(id || ""),
      });
      message.success(t("graphEditor.nodeStatusUpdated"));
    } catch (err) {
      console.error("Failed to update node status:", err);
    }
  }, [queryClient, id, t]);

  // 批量生成语义向量：循环分批调用后端，直到无待处理数据；完成后刷新含 embedding 的图谱数据
  // embeddings 变化会触发 MindMapCanvas 的布局 effect，自动重算语义聚类布局
  const handleGenerateEmbeddings = useCallback(async () => {
    if (!id || isGeneratingEmbeddings) return;
    setIsGeneratingEmbeddings(true);
    const msgId = message.loading(
      t("graphEditor.semanticEmbedding.generating", { count: 0 }),
    );
    let totalProcessed = 0;
    let totalFailed = 0;
    try {
      for (;;) {
        const res = await api.autoGraph.generateEmbeddings(100);
        totalProcessed += res.processed;
        totalFailed += res.failed;
        if (!res.success || res.processed === 0) break;
        message.loading(
          t("graphEditor.semanticEmbedding.generating", {
            count: totalProcessed,
          }),
          { id: msgId },
        );
      }
      message.dismiss(msgId);
      if (totalProcessed === 0 && totalFailed === 0) {
        message.info(t("graphEditor.semanticEmbedding.noPending"));
      } else if (totalFailed > 0) {
        message.warning(
          t("graphEditor.semanticEmbedding.doneWithFailures", {
            processed: totalProcessed,
            failed: totalFailed,
          }),
        );
      } else {
        message.success(
          t("graphEditor.semanticEmbedding.done", {
            processed: totalProcessed,
          }),
        );
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.graphDataWithEmbedding(id),
      });
    } catch (err) {
      console.error("Failed to generate embeddings:", err);
      message.dismiss(msgId);
      message.error(t("graphEditor.semanticEmbedding.failed"));
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  }, [id, isGeneratingEmbeddings, queryClient, t]);

  const handleOpenDetail = useCallback(() => {
    setSidebarMode("detail");
  }, [setSidebarMode]);

  const handleNavigateToGraphMap = useCallback(() => {
    navigate(`/graph-map?from=${id}`);
  }, [navigate, id]);

  const handleBack = useCallback(() => {
    goBack();
  }, [goBack]);

  const handleTogglePresentation = useCallback(() => {
    if (isPresentationMode) {
      setIsPresentationMode(false);
      setFocusedNodeId(null);
      setFocusedNodeIds(new Set());
      setFocusedLinkIds(new Set());
    } else {
      setIsPresentationMode(true);
      setPresentationStep(0);
    }
  }, [isPresentationMode, setIsPresentationMode, setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds, setPresentationStep]);

  const handlePresentationNext = useCallback(() => {
    setPresentationStep((p) => Math.min(p + 1, presentationPath.length - 1));
  }, [setPresentationStep, presentationPath]);

  const handlePresentationPrev = useCallback(() => {
    setPresentationStep((p) => Math.max(p - 1, 0));
  }, [setPresentationStep]);

  const handlePresentationExit = useCallback(() => {
    setIsPresentationMode(false);
    setFocusedNodeId(null);
    setFocusedNodeIds(new Set());
    setFocusedLinkIds(new Set());
  }, [setIsPresentationMode, setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds]);

  const handleTimelineGoToIndex = useCallback((index: number) => {
    explorationPathOps.goToPathIndex(index);
    const pathItem = explorationPathOps.explorationPath[index];
    if (pathItem) {
      focusNode(pathItem.nodeId);
    }
  }, [explorationPathOps, focusNode]);

  const handleTimelineGoBack = useCallback(() => {
    explorationPathOps.goBack();
    const pathItem = explorationPathOps.getCurrentPathItem();
    if (pathItem) {
      focusNode(pathItem.nodeId);
    }
  }, [explorationPathOps, focusNode]);

  const handleTimelineGoForward = useCallback(() => {
    explorationPathOps.goForward();
    const pathItem = explorationPathOps.getCurrentPathItem();
    if (pathItem) {
      focusNode(pathItem.nodeId);
    }
  }, [explorationPathOps, focusNode]);

  const handleTimelineSwitchBranch = useCallback(async (pathItem: Parameters<typeof switchBranch>[0], selectedSuggestion: Parameters<typeof switchBranch>[1]) => {
    const parentNode = nodes.find((n) => n.id === pathItem.parentNodeId);
    if (parentNode) switchBranch(pathItem, selectedSuggestion, parentNode);
  }, [nodes, switchBranch]);

  const handleTimelineToggleCollapse = useCallback(() => {
    setIsTimelineVisible(!isTimelineVisible);
  }, [isTimelineVisible, setIsTimelineVisible]);

  const handleOpenOutlineSidebar = useCallback(() => {
    setSidebarMode("outline");
  }, [setSidebarMode]);

  const handleOpenRelationshipTypeSettings = useCallback(() => {
    panelState.setIsStyleSettingsOpen(false);
    panelState.setIsRelationshipTypeSettingsOpen(true);
  }, [panelState]);

  const handleAnalysisNodeClick = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) handleNodeClick(node);
  }, [nodes, handleNodeClick]);

  const [searchHighlightNodeId, setSearchHighlightNodeId] = useState<string | null>(null);

  const handleCommandPaletteNodeSelect = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      handleNodeClick(node);
      if (viewMode !== "mindmap") {
        setViewMode("mindmap");
      }
      // Trigger search highlight animation
      setSearchHighlightNodeId(nodeId);
      setTimeout(() => setSearchHighlightNodeId(null), 3000);
    }
  }, [nodes, handleNodeClick, viewMode, setViewMode]);

  // Auto-select and highlight node from URL ?node_id=xxx (e.g. from search results)
  useEffect(() => {
    if (nodeIdFromUrl && nodes.length > 0) {
      const node = nodes.find((n) => n.id === nodeIdFromUrl);
      if (node) {
        handleNodeClick(node);
        if (viewMode !== "mindmap") {
          setViewMode("mindmap");
        }
        setSearchHighlightNodeId(nodeIdFromUrl);
        setTimeout(() => setSearchHighlightNodeId(null), 3000);
      }
    }
    // Only run when nodeIdFromUrl or nodes change; useRef to avoid re-triggering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdFromUrl, nodes]);

  const handleRAGChatNodeClick = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) handleNodeClick(node);
  }, [nodes, handleNodeClick]);

  const handleMobileActionClose = useCallback(() => {
    setMobileActionMenuOpen(false);
    setMobileActionNodeId(null);
  }, [setMobileActionMenuOpen, setMobileActionNodeId]);

  const handleMobileEdit = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node) {
      setSelectedNode(node);
      setSidebarMode("edit");
    }
  }, [nodes, mobileActionNodeId, setSelectedNode, setSidebarMode]);

  const handleMobileAIExpand = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node) {
      setSelectedNode(node);
      aiOps.handleAIExpand();
    }
  }, [nodes, mobileActionNodeId, setSelectedNode, aiOps]);

  const handleMobileManageCards = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node && id) {
      navigate(`/study?node_id=${node.id}&graph_id=${id}&view=bank`);
    }
  }, [nodes, mobileActionNodeId, id, navigate]);

  const handleMobileStartLearning = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node) {
      setSelectedNode(node);
      tutorOps.handleToggleTutorMode();
    }
  }, [nodes, mobileActionNodeId, setSelectedNode, tutorOps]);

  const handleMobileDelete = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node) {
      nodeOps.handleDeleteNode(node);
    }
  }, [nodes, mobileActionNodeId, nodeOps]);

  const handleDiffSelect = useCallback((sourceSnapshotId: string, targetSnapshotId?: string) => {
    panelState.setSelectedDiff({ sourceSnapshotId, targetSnapshotId: targetSnapshotId ?? "" });
  }, [panelState]);

  const handleConceptPreviewClose = useCallback(() => {
    panelState.setIsConceptPreviewOpen(false);
    panelState.setExtractedConcepts([]);
  }, [panelState]);

  // --- Extracted inline objects as useMemo ---

  const pathfindingState = useMemo(() => ({
    startNode: pathStartNode,
    endNode: pathEndNode,
    pathLength: highlightedPath?.nodes.size || 0,
    reset: () => {
      setPathStartNode(null);
      setPathEndNode(null);
      setHighlightedPath(null);
    },
  }), [pathStartNode, pathEndNode, highlightedPath, setPathStartNode, setPathEndNode, setHighlightedPath]);

  const exportActions = useMemo(() => ({
    onMarkdown: exportOps.handleExportMarkdown,
    onPPT: exportOps.handleExportPPT,
    onPDF: exportOps.handleExportPDF,
    onJSON: exportOps.handleExportJSON,
    onImage: () => setIsExportImageModalOpen(true),
    onAnki: exportOps.handleExportAnki,
    onDeleteGraph: exportOps.handleDeleteGraph,
  }), [exportOps, setIsExportImageModalOpen]);

  const commands: CommandItem[] = useCommandPalette({
    sidebarMode,
    isDark,
    isFocusMode,
    selectedNode,
    toggleTheme,
    setSidebarMode,
    setViewMode,
    setIsFocusMode,
    handleDeleteNode: nodeOps.handleDeleteNode,
    addMessage: (msg: {
      type: "success" | "error" | "warning" | "info" | "loading";
      content: string;
    }) => {
      if (msg.type === "success") {
        message.success(msg.content);
      } else if (msg.type === "error") {
        message.error(msg.content);
      } else if (msg.type === "info") {
        message.info(msg.content);
      } else if (msg.type === "warning") {
        message.warning(msg.content);
      }
    },
  });

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden ${isDark ? "dark" : ""}`}
    >
      <h1 className="sr-only">{graphMeta?.title ?? t("layout.breadcrumb.graphEditor")}</h1>
      {/* 只读模式提示条 */}
      {isReadOnly && !isGraphLoading && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Lock size={16} />
            <span className="text-sm font-medium">
              {t("graphEditor.errors.readOnlyModeHint")}
            </span>
          </div>
          <button
            onClick={() => navigate(`/login?redirect=/graph/${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
          >
            <LogIn size={14} />
            {t("graphEditor.errors.loginToEdit")}
          </button>
        </div>
      )}
      {/* Main Canvas Area */}
      <div
        className={`flex-1 h-full relative ${isDeleteMode ? "cursor-not-allowed" : ""} ${isMobile ? "pb-14" : ""}`}
      >
        {isGraphLoading && (
          <div
            data-testid="graph-loading"
            className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm"
          >
            <div className="space-y-4 p-6 w-full max-w-md">
              <Skeleton variant="rectangular" className="h-8 w-64" />
              <Skeleton variant="rectangular" className="h-32 w-full" />
            </div>
          </div>
        )}

        {contextMenu && id && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            graphId={id}
            nodeContent={
              nodeById.get(contextMenu.nodeId)?.content || ""
            }
            onClose={() => setContextMenu(null)}
            onExecuteAction={aiOps.handleExecuteAction}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.graph(id || "") });
              queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id || "") });
            }}
          />
        )}

        {canvasContextMenu && (
          <CanvasContextMenu
            position={{ x: canvasContextMenu.x, y: canvasContextMenu.y }}
            onClose={() => setCanvasContextMenu(null)}
            onCreateNode={handleCreateNodeAtPosition}
            onPaste={handlePasteNodes}
            onSelectAll={handleSelectAllNodes}
            onFitView={handleCanvasFitView}
            canPaste={clipboard.length > 0}
          />
        )}

        <div className="h-full w-full bg-white dark:bg-slate-900 relative" data-tour="canvas">
          {/* 节点层级面包屑：顶部居中浮层，点击父节点复用 focusNode 居中并选中 */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-max max-w-[60vw]">
            <NodeBreadcrumb
              graphTitle={graphMeta?.title ?? t("graphEditor.unnamed.graph")}
              selectedNode={
                selectedNode
                  ? {
                      id: selectedNode.id,
                      title: selectedNode.title ?? t("graphEditor.unnamed.node"),
                    }
                  : null
              }
              parentChain={parentChain}
              onSelectNode={focusNode}
            />
          </div>
          {(viewMode === "mindmap" || viewMode === "semantic") && (
            <ErrorBoundary>
              <MindMapCanvas
                ref={graphRef}
                nodes={nodes}
                edges={edges}
                nodeStatus={nodeStatus}
                selectedNodeId={selectedNode?.id ?? null}
                onNodeClick={handleNodeClick}
                sidebarMode={sidebarMode}
                focusedNodeIds={focusedNodeIds}
                focusedLinkIds={focusedLinkIds}
                onCanvasClick={handleCanvasClick}
              forceShowTextIds={forceShowTextIds}
              focusedNodeId={focusedNodeId}
              branchSuggestions={branchSuggestions}
              selectedNodeForBranch={selectedNode}
              historicalAlternativeBranches={historicalAlternativeBranches}
              onSelectBranch={selectBranch}
              isExplorationMode={isExplorationMode}
              colorScheme={colorScheme}
              linkStyle={linkStyle}
              linkAnimation={linkAnimation}
              templateLayout={templateLayout}
              nodeSizeMode={nodeSizeMode}
              edgeWidthMode={edgeWidthMode}
              coloringMode={coloringMode}
              onNodeContextMenu={handleNodeContextMenu}
              isRightPanelOpen={sidebarMode !== "none"}
              rightPanelWidth={sidebarMode !== "none" ? sidebarWidth : 0}
              graphId={id}
              onLayoutUpdate={handleLayoutUpdate}
              isSelectingParent={isSelectingParentNode}
              onSelectParent={handleSelectParentFromGraph}
              currentNodeId={selectedNode?.id}
              selectedParentIds={nodeForm.parentNodeIds}
              leftPanelWidth={panelState.isRAGChatOpen ? panelState.ragChatWidth : 0}
              onNavigateToGraphMap={handleNavigateToGraphMap}
              onMarkNodeMastered={handleMarkNodeMastered}
              onNodeLongPress={isMobile ? handleNodeLongPress : undefined}
              isMobilePreviewMode={isMobile && isMobilePreviewMode}
              onOpenDetail={handleOpenDetail}
              learningPathNodeIds={learningPathNodeIds}
              learningPathOrderMap={learningPathOrderMap}
              highlightedPathNodeId={
                selectedLearningPathId ? focusedNodeId : null
              }
              isNarrativeMode={isNarrativeModeState}
              narrativeRevealedNodeIds={narrativeRevealedNodeIds}
              narrativeCurrentNodeId={
                isNarrativeModeState && narrativeCurrentStep > 0
                  ? narrativePath[narrativeCurrentStep - 1] ?? null
                  : null
              }
              layoutMode={viewMode === "semantic" ? "semantic" : "force"}
              embeddings={viewMode === "semantic" ? embeddingsMap : undefined}
              onCanvasContextMenu={handleCanvasContextMenu}
                searchHighlightNodeId={searchHighlightNodeId}
                onZoomChange={setZoomLevel}
                edgeDisplayMode={edgeDisplayMode}
                multiSelectedNodeIds={selectedNodeIds}
                onMarqueeSelect={handleMarqueeSelect}
                nodeGlow={nodeGlow}
                nodeShape={nodeShape}
                centerDotShape={centerDotShape}
                linkCap={linkCap}
                arrowStyle={arrowStyle}
                linkWidth={linkWidth}
                gridStyle={gridStyle}
              />
              </ErrorBoundary>
          )}
          {viewMode === "timeline" && (
            <Suspense fallback={<ViewLoader />}>
              <QueryErrorResetBoundary>
                {({ reset }) => (
                  <ErrorBoundary onReset={reset}>
                    <TimelineView
                      nodes={nodes}
                      edges={edges}
                      nodeStatus={nodeStatus}
                      selectedNodeId={selectedNode?.id || null}
                      onNodeClick={handleNodeClick}
                      onCanvasClick={handleCanvasClick}
                      colorScheme={colorScheme}
                      linkStyle={linkStyle}
                      linkAnimation={linkAnimation}
                      nodeSizeMode={nodeSizeMode}
                      edgeWidthMode={edgeWidthMode}
                      coloringMode={coloringMode}
                      isRightPanelOpen={sidebarMode !== "none"}
                      rightPanelWidth={
                        sidebarMode !== "none" ? sidebarWidth : 0
                      }
                    />
                  </ErrorBoundary>
                )}
              </QueryErrorResetBoundary>
            </Suspense>
          )}
          {viewMode === "tree" && (
            <Suspense fallback={<ViewLoader />}>
              <QueryErrorResetBoundary>
                {({ reset }) => (
                  <ErrorBoundary onReset={reset}>
                    <TreeView
                      nodes={nodes}
                      edges={edges}
                      nodeStatus={nodeStatus}
                      selectedNodeId={selectedNode?.id || null}
                      onNodeClick={handleNodeClick}
                      onCanvasClick={handleCanvasClick}
                      colorScheme={colorScheme}
                      linkStyle={linkStyle}
                      linkAnimation={linkAnimation}
                      nodeSizeMode={nodeSizeMode}
                      edgeWidthMode={edgeWidthMode}
                      coloringMode={coloringMode}
                      focusedNodeIds={focusedNodeIds}
                      focusedLinkIds={focusedLinkIds}
                      isExplorationMode={isExplorationMode}
                      branchSuggestions={branchSuggestions}
                      selectedNodeForBranch={selectedNode}
                      onSelectBranch={selectBranch}
                      onSwitchBranch={handleTimelineSwitchBranch}
                      historicalAlternativeBranches={historicalAlternativeBranches}
                    />
                  </ErrorBoundary>
                )}
              </QueryErrorResetBoundary>
            </Suspense>
          )}
          {viewMode === "planet" && (
            <Suspense fallback={<ViewLoader />}>
              <QueryErrorResetBoundary>
                {({ reset }) => (
                  <ErrorBoundary onReset={reset}>
                    <PlanetView
                      nodes={nodes}
                      edges={edges}
                      selectedNodeId={selectedNode?.id || null}
                      onNodeClick={handleNodeClick}
                      colorScheme={colorScheme}
                      coloringMode={coloringMode}
                      nodeStatus={nodeStatus}
                      focusedNodeId={focusedNodeId}
                    />
                  </ErrorBoundary>
                )}
              </QueryErrorResetBoundary>
            </Suspense>
          )}
          {viewMode === "quadrant" && (
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset}>
                  <QuadrantCanvas
                    ref={graphRef}
                    nodes={nodes}
                    edges={edges}
                    regions={regions}
                    originPosition={originPosition}
                    collapsedRegions={collapsedRegions}
                    onOriginMove={handleOriginMove}
                    onRegionToggle={handleRegionToggle}
                    onNodeClick={handleNodeClick}
                    selectedNodeId={selectedNode?.id ?? null}
                    nodeStatus={nodeStatus}
                    colorScheme={colorScheme}
                    coloringMode={coloringMode}
                    focusedNodeIds={focusedNodeIds}
                    focusedNodeId={focusedNodeId}
                    focusedLinkIds={focusedLinkIds}
                    onCanvasClick={handleCanvasClick}
                  />
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          )}
        </div>
      </div>

      <GraphToolbar
        dataTour="toolbar"
        onBack={handleBack}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        title={graphMeta?.title || t("graphEditor.unnamed.graph")}
        sidebarMode={sidebarMode}
        setSidebarMode={setSidebarMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        aiEnabled={aiEnabled}
        onAIExpand={aiOps.handleAIExpand}
        onBranchExplore={handleGetBranchSuggestions}
        onBackgroundTask={aiOps.handleBackgroundTask}
        onGenerateQuestions={aiOps.handleOpenChallengeGen}
        onImportOutline={() => setIsTextToGraphOpen(true)}
        onFindSimilarNodes={() => setIsSimilarNodesOpen(true)}
        onSmartStyle={() => setIsSmartStyleOpen(true)}
        onTranslateNodes={() => setIsNodeTranslateOpen(true)}
        onGenerateEmbeddings={handleGenerateEmbeddings}
        isGeneratingEmbeddings={isGeneratingEmbeddings}
        isChatOpen={panelState.isRAGChatOpen}
        setIsChatOpen={panelState.setIsRAGChatOpen}
        isTutorMode={isTutorMode}
        onToggleTutorMode={tutorOps.handleToggleTutorMode}
        isPathfindingMode={isPathfindingMode}
        setIsPathfindingMode={setIsPathfindingMode}
        pathfindingState={pathfindingState}
        onAddNode={nodeOps.handleStartCreate}
        isDeleteMode={isDeleteMode}
        setIsDeleteMode={setIsDeleteMode}
        selectedNodeIds={selectedNodeIds}
        onDeleteSelected={nodeOps.handleDeleteNode}
        onBatchDelete={nodeOps.handleBatchDelete}
        batchDeleteProgress={nodeOps.batchDeleteProgress}
        onBatchLevelUpdate={nodeOps.handleBatchLevelUpdate}
        isStyleSettingsOpen={panelState.isStyleSettingsOpen}
        setIsStyleSettingsOpen={panelState.setIsStyleSettingsOpen}
        colorScheme={colorScheme}
        setColorScheme={setColorScheme}
        linkStyle={linkStyle}
        setLinkStyle={setLinkStyle}
        linkAnimation={linkAnimation}
        setLinkAnimation={setLinkAnimation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isExportMenuOpen={isExportMenuOpen}
        setIsExportMenuOpen={setIsExportMenuOpen}
        exportActions={exportActions}
        onRefresh={() => window.location.reload()}
        onOpenHelp={() => setIsHelpOpen(true)}
        onReplayTutorial={() => startOnboardingTour({
          onOpenSidebar: () => setSidebarMode("outline"),
          onOpenRAGChat: () => panelState.setIsRAGChatOpen(true),
        })}
        onOpenShortcutSettings={() => panelState.setIsShortcutHelpOpen(true)}
        onShare={() => setIsShareModalOpen(true)}
        onOpenAnalysis={() => setIsAnalysisPanelOpen(true)}
        onOpenConceptAggregation={() => panelState.setIsConceptAggregationOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isExplorationMode={isExplorationMode}
        setIsExplorationMode={setIsExplorationMode}
        coloringMode={coloringMode}
        setColoringMode={setColoringMode}
        isTimelineVisible={isTimelineVisible}
        setIsTimelineVisible={setIsTimelineVisible}
        onTogglePresentation={handleTogglePresentation}
        onTogglePodcast={() => setIsPodcastModalOpen(true)}
        isMobilePreviewMode={isMobilePreviewMode}
        setIsMobilePreviewMode={setIsMobilePreviewMode}
        isRAGChatOpen={panelState.isRAGChatOpen}
        ragChatWidth={panelState.ragChatWidth}
        isVersionHistoryOpen={panelState.isVersionHistoryOpen}
        setIsVersionHistoryOpen={panelState.setIsVersionHistoryOpen}
        regions={regions}
        collapsedRegions={collapsedRegions}
        onRegionToggle={handleRegionToggle}
        currentGraphId={id}
        currentGraphTitle={graphMeta?.title}
        zoomLevel={zoomLevel}
        onZoomIn={handleCanvasZoomIn}
        onZoomOut={handleCanvasZoomOut}
        onZoomReset={handleCanvasZoomReset}
        edgeDisplayMode={edgeDisplayMode}
        setEdgeDisplayMode={setEdgeDisplayMode}
      />

      {isPresentationMode && (
        <PresentationControls
          currentStep={presentationStep}
          totalSteps={presentationPath.length}
          onNext={handlePresentationNext}
          onPrev={handlePresentationPrev}
          onExit={handlePresentationExit}
        />
      )}

      {isNarrativeModeState && (
        <NarrativeControls
          isPlaying={isNarrativePlaying}
          onTogglePlay={narrativeTogglePlay}
          onPlayNext={narrativePlayNext}
          onPlayPrev={narrativePlayPrev}
          onReset={narrativeReset}
          onExit={handleExitNarrative}
          playSpeed={narrativePlaySpeed}
          onSpeedChange={setNarrativePlaySpeed}
          currentStep={narrativeCurrentStep}
          totalSteps={narrativeTotalSteps}
          isNarrativeComplete={isNarrativeComplete}
          isDark={isDark}
        />
      )}

      {isTimelineVisible && isExplorationMode && (
        <Suspense fallback={<ViewLoader />}>
          <ExplorationTimeline
            explorationPath={explorationPathOps.explorationPath}
            currentPathIndex={explorationPathOps.currentPathIndex}
            sidebarMode={sidebarMode}
            onGoToIndex={handleTimelineGoToIndex}
            onGoBack={handleTimelineGoBack}
            onGoForward={handleTimelineGoForward}
            onSwitchBranch={handleTimelineSwitchBranch}
            canGoBack={explorationPathOps.canGoBack()}
            canGoForward={explorationPathOps.canGoForward()}
            isDark={isDark}
            isCollapsed={!isTimelineVisible}
            onToggleCollapse={handleTimelineToggleCollapse}
          />
        </Suspense>
      )}

      {sidebarMode === "none" && !isMobile && (
        <button
          onClick={handleOpenOutlineSidebar}
          data-tour="sidebar"
          className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white dark:bg-slate-800 p-2 rounded-l-xl shadow-lg border-y border-l border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600 transition-all hover:pr-4"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <ActionResultModal
        isOpen={!!panelState.actionResult}
        onClose={() => panelState.setActionResult(null)}
        title={panelState.actionResult?.title || ""}
        content={panelState.actionResult?.content || ""}
      />

      <Suspense fallback={<ViewLoader />}>
        <GraphModalManager
          id={id || ""}
          state={state}
          graphMeta={graphMeta}
          aiEnabled={aiEnabled}
          tutorOps={tutorOps}
          nodes={nodes}
        />
      </Suspense>

      <Suspense fallback={<ViewLoader />}>
        <GraphStyleSettings
          isOpen={panelState.isStyleSettingsOpen}
          onClose={() => panelState.setIsStyleSettingsOpen(false)}
          currentColorScheme={colorScheme}
          currentLinkStyle={linkStyle}
          currentLinkAnimation={linkAnimation}
          onColorSchemeChange={setColorScheme}
          onLinkStyleChange={setLinkStyle}
          onLinkAnimationChange={setLinkAnimation}
          nodeSizeMode={nodeSizeMode}
          onNodeSizeModeChange={setNodeSizeMode}
          edgeWidthMode={edgeWidthMode}
          onEdgeWidthModeChange={setEdgeWidthMode}
          coloringMode={coloringMode}
          nodeGlow={nodeGlow}
          onNodeGlowChange={setNodeGlow}
          onOpenRelationshipTypeSettings={handleOpenRelationshipTypeSettings}
        />
      </Suspense>

      <Suspense fallback={<ViewLoader />}>
        <RelationshipTypeSettings
          isOpen={panelState.isRelationshipTypeSettingsOpen}
          onClose={() => panelState.setIsRelationshipTypeSettingsOpen(false)}
        />
      </Suspense>

      <Suspense fallback={<ViewLoader />}>
        <ErrorBoundary>
          <GraphSidebarManager
            state={state}
            nodes={nodes}
            edges={edges}
            nodeStatus={nodeStatus}
            graphStats={graphStats}
            nodeOps={nodeOps}
            aiOps={aiOps}
            interactionOps={interactionOps}
            handleCloseSidebar={handleCloseSidebar}
            isExplorationMode={isExplorationMode}
            isSelectingParent={isSelectingParentNode}
            onStartSelectingParent={handleStartSelectingParent}
            onCancelSelectingParent={handleCancelSelectingParent}
            onSelectParentFromGraph={handleSelectParentFromGraph}
            onConnectNodes={handleConnectNodes}
            isReadOnly={isReadOnly}
            customRegions={customRegions}
            onCreateRegion={handleCreateRegion}
            coloringMode={coloringMode}
          />
        </ErrorBoundary>
      </Suspense>

      <Suspense fallback={null}>
        <GenerateCardsModal
          isOpen={aiOps.isChallengeGenOpen}
          onClose={aiOps.handleCloseChallengeGen}
          onGenerate={aiOps.handleChallengeGenerate}
          graphId={id}
          nodeTitle={state.selectedNode?.title}
          selectedNodes={
            state.selectedNode
              ? [{ id: state.selectedNode.id, title: state.selectedNode.title }]
              : []
          }
          graphNodes={nodes.map((n) => ({ id: n.id, title: n.title }))}
          graphEdges={edges.map((e) => ({
            source_knowledge_point_id: e.source_knowledge_point_id,
            target_knowledge_point_id: e.target_knowledge_point_id,
          }))}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TextToGraphModal
          isOpen={isTextToGraphOpen}
          onClose={() => setIsTextToGraphOpen(false)}
          graphId={id || ""}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id || "") });
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SimilarNodesPanel
          isOpen={isSimilarNodesOpen}
          onClose={() => setIsSimilarNodesOpen(false)}
          nodes={nodes.map((n) => ({ id: n.id, title: n.title, content: n.content }))}
          onMerge={handleMergeNodes}
          onNodeClick={(nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) handleNodeClick(node);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SmartStylePanel
          isOpen={isSmartStyleOpen}
          onClose={() => setIsSmartStyleOpen(false)}
          graphId={id || ""}
          nodes={nodes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            level: n.level,
          }))}
          onApply={handleApplySmartStyle}
        />
      </Suspense>

      <Suspense fallback={null}>
        <NodeTranslatePanel
          isOpen={isNodeTranslateOpen}
          onClose={() => setIsNodeTranslateOpen(false)}
          nodes={nodes.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            summary: n.summary,
          }))}
          onApply={handleApplyNodeTranslation}
        />
      </Suspense>

      <Suspense fallback={<ViewLoader />}>
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary onReset={reset} variant="panel">
              <GraphAnalysisPanel
                graphId={id || ""}
                isOpen={isAnalysisPanelOpen}
                onClose={() => setIsAnalysisPanelOpen(false)}
                nodes={nodes}
                onNodeClick={handleAnalysisNodeClick}
                onCreateConnection={handleConnectNodes}
              />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </Suspense>

      <Suspense fallback={<ViewLoader />}>
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary onReset={reset} variant="panel">
              <ConceptAggregationPanel
                graphId={id || ""}
                isOpen={panelState.isConceptAggregationOpen}
                onClose={() => panelState.setIsConceptAggregationOpen(false)}
              />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </Suspense>

      <CommandPalette
        isOpen={panelState.isCommandPaletteOpen}
        onClose={() => panelState.setIsCommandPaletteOpen(false)}
        commands={commands}
        nodes={nodes}
        onNodeSelect={handleCommandPaletteNodeSelect}
      />

      <Suspense fallback={<ViewLoader />}>
        <ErrorBoundary
          fallbackRender={(error, resetErrorBoundary) => (
            <div className="p-4 border border-red-300 rounded-xl bg-red-50 dark:bg-red-900/20 dark:border-red-700 max-w-md mx-auto mt-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium">
                <AlertTriangle size={18} />
                <span>{t("graphEditor.errors.aiPanelError")}</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300 mt-2 break-words">
                {error.message}
              </p>
              <button
                onClick={resetErrorBoundary}
                className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
              >
                {t("common.retry")}
              </button>
            </div>
          )}
        >
          <RAGChatButton
            graphId={id}
            currentNodeId={selectedNode?.id}
            currentNodeTitle={selectedNode?.title}
            onNodeClick={handleRAGChatNodeClick}
            isOpen={panelState.isRAGChatOpen}
            onOpenChange={panelState.setIsRAGChatOpen}
            selectedNodeIds={Array.from(selectedNodeIds)}
            aiEnabled={aiEnabled}
            isTutorMode={isTutorMode}
            tutorMode={tutorMode}
            extractedConcepts={panelState.extractedConcepts as unknown as TutorExtractedConcept[]}
            onToggleTutorMode={tutorOps.handleToggleTutorMode}
            onSwitchTutorMode={setTutorMode}
            onExtractConcepts={tutorOps.handleExtractConcepts}
            onAddConceptToGraph={tutorOps.handleAddConceptToGraph}
            onAddAllConcepts={tutorOps.handleAddAllConcepts}
            onSuggestNextTopics={tutorOps.handleSuggestNextTopics}
            suggestedNextTopics={suggestedNextTopics}
            onTutorChat={tutorOps.handleTutorChat}
            width={panelState.ragChatWidth}
            onWidthChange={panelState.setRagChatWidth}
            isMobilePreviewMode={
              isMobile && isMobilePreviewMode && !!selectedNode
            }
            selectedLearningPathId={selectedLearningPathId}
            onPathSelect={handleSelectLearningPath}
            onLearningPathNodeClick={handleLearningPathNodeClick}
            onStartNarrative={handleStartNarrative}
            enableSTT={true}
          />
        </ErrorBoundary>
      </Suspense>

      {isMobile && (
        <Suspense fallback={<ViewLoader />}>
          <MobileNodeActionMenu
            isOpen={mobileActionMenuOpen}
            onClose={handleMobileActionClose}
            nodeId={mobileActionNodeId}
            nodeTitle={mobileActionNodeId ? nodeById.get(mobileActionNodeId)?.title : undefined}
            onEdit={handleMobileEdit}
            onAIExpand={handleMobileAIExpand}
            onManageCards={handleMobileManageCards}
            onStartLearning={handleMobileStartLearning}
            onDelete={handleMobileDelete}
          />
        </Suspense>
      )}
      {user?.id && (
        <Suspense fallback={<ViewLoader />}>
          <ErrorBoundary
            resetKeys={[panelState.isConsoleOpen]}
            fallbackRender={(error, resetErrorBoundary) => {
              if (!panelState.isConsoleOpen) return null;
              return (
                <div className="fixed bottom-4 right-4 w-[600px] max-h-[70vh] rounded-xl shadow-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 z-50 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{t("graphEditor.errors.consoleCrash")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
                        {error.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={panelState.closeConsole}
                      className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t("common.close")}
                    </button>
                    <button
                      onClick={resetErrorBoundary}
                      className="px-3 py-1.5 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      {t("common.retry")}
                    </button>
                  </div>
                </div>
              );
            }}
          >
            <Console
              isOpen={panelState.isConsoleOpen}
              onClose={panelState.closeConsole}
              context={panelState.consoleContext}
              onToggleMinimize={panelState.toggleConsoleMinimize}
              isMinimized={panelState.isConsoleMinimized}
            />
          </ErrorBoundary>
        </Suspense>
      )}

      {panelState.isVersionHistoryOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <div className="fixed right-0 top-0 bottom-0 z-40 w-80 shadow-xl border-l border-slate-200 dark:border-slate-500">
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} variant="panel">
                  <VersionHistoryPanel
                    graphId={id}
                    onClose={() => panelState.setIsVersionHistoryOpen(false)}
                    onDiffSelect={handleDiffSelect}
                  />
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </div>
        </Suspense>
      )}

      {panelState.selectedDiff && id && (
        <Suspense fallback={<ViewLoader />}>
          <div className="fixed right-80 top-0 bottom-0 z-40 w-80 shadow-xl border-l border-slate-200 dark:border-slate-500">
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} variant="panel">
                  {panelState.selectedDiff && (
                    <DiffDetailPanel
                      graphId={id}
                      sourceSnapshotId={panelState.selectedDiff.sourceSnapshotId}
                      targetSnapshotId={panelState.selectedDiff.targetSnapshotId}
                      onClose={() => panelState.setSelectedDiff(null)}
                    />
                  )}
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </div>
        </Suspense>
      )}

      {panelState.isConceptPreviewOpen && panelState.extractedConcepts.length > 0 && (
        <Suspense fallback={<ViewLoader />}>
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary onReset={reset} variant="panel">
                <ConceptPreviewList
                  concepts={panelState.extractedConcepts}
                  isOpen={panelState.isConceptPreviewOpen}
                  onClose={handleConceptPreviewClose}
                  onConfirm={handleConfirmConcepts}
                />
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </Suspense>
      )}

      {showOnboarding && (
        <OnboardingGuide
          onComplete={() => setShowOnboarding(false)}
          onOpenSidebar={() => setSidebarMode("outline")}
          onOpenRAGChat={() => panelState.setIsRAGChatOpen(true)}
        />
      )}
    </div>
  );
};

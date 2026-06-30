import React, {
  useMemo,
  lazy,
  Suspense,
  useCallback,
  useState,
  useLayoutEffect,
  useEffect,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { message } from "../utils/messageHelper";
import { ArrowLeft, Loader2, Lock, LogIn } from "lucide-react";

import { GraphToolbar } from "../components/GraphEditor/toolbar/GraphToolbar";
import { MindMapCanvas } from "../components/GraphEditor/canvas/MindMapCanvas";
import { QuadrantCanvas } from "../components/GraphEditor/canvas/QuadrantCanvas";
import { ExplorationTimeline } from "../components/GraphEditor/shared/ExplorationTimeline";
import { GraphStyleSettings } from "../components/GraphEditor/shared/GraphStyleSettings";
import { RelationshipTypeSettings } from "../components/GraphEditor/shared/RelationshipTypeSettings";

import { GraphModalManager } from "../components/GraphEditor/modals/GraphModalManager";
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
import {
  useTheme,
  useIsMobile,
  useKeyboardShortcuts,
  useGlobalShortcuts,
  useTutorOperations,
  useQuoteShortcut,
} from "../hooks";
import { computeRegions } from "../lib/graph";
import {
  useGraph,
  useGraphData,
  useGraphDataWithEmbedding,
  useAIStatus,
} from "../hooks/queries";
import { useGraphMutations } from "../hooks/mutations";
import { MobileNodeActionMenu } from "../components/GraphEditor/mobile/MobileNodeActionMenu";
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
import {
  CommandPalette,
  CommandItem,
} from "../components/GraphEditor/shared/CommandPalette";
import { ErrorBoundary, ShortcutHelpPanel } from "../components/common";
import { useQueryClient } from "@tanstack/react-query";
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

const LiteratureExtractPanel = lazy(() =>
  import("../components/LiteratureExtract/LiteratureExtractPanel").then(
    (module) => ({
      default: module.LiteratureExtractPanel,
    }),
  ),
);

const ResearchProgressPanel = lazy(() =>
  import("../components/GraphEditor/ResearchProgressPanel").then(
    (module) => ({
      default: module.ResearchProgressPanel,
    }),
  ),
);

const LiteratureLibraryPanel = lazy(() =>
  import("../components/GraphEditor/LiteratureLibraryPanel").then(
    (module) => ({
      default: module.LiteratureLibraryPanel,
    }),
  ),
);

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

const StoryEditor = lazy(() =>
  import("../components/StoryEditor/StoryEditor").then((module) => ({
    default: module.StoryEditor,
  })),
);

const Console = lazy(() =>
  import("../components/Console/Console").then((module) => ({
    default: module.Console,
  })),
);

const ViewLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
  </div>
);

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useStore();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile } = useIsMobile();
  const queryClient = useQueryClient();

  const isAuthenticated = !!token;
  const isReadOnly = !isAuthenticated;

  const [mobileActionMenuOpen, setMobileActionMenuOpen] = useState(false);
  const [mobileActionNodeId, setMobileActionNodeId] = useState<string | null>(
    null,
  );
  const [isMobilePreviewMode, setIsMobilePreviewMode] = useState(true);

  const panelState = useGraphEditorPanelState({ userId: user?.id || "" });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("default");
  const [linkStyle, setLinkStyle] = useState<LinkStyle>("curved");
  const [linkAnimation, setLinkAnimation] = useState<LinkAnimation>("none");
  const [nodeSizeMode, setNodeSizeMode] = useState<NodeSizeMode>("fixed");
  const [edgeWidthMode, setEdgeWidthMode] = useState<EdgeWidthMode>("fixed");
  const [coloringMode, setColoringMode] = useState<GraphColorMode>("level"); // Default to level (structure) as requested

  useQuoteShortcut({
    onAddQuote: addQuote,
    isChatOpen: panelState.isRAGChatOpen,
    onOpenChat: () => panelState.setIsRAGChatOpen(true),
  });
  const [isSelectingParentNode, setIsSelectingParentNode] = useState(false);

  const {
    customRegions,
    originPosition,
    collapsedRegions,
    handleCreateRegion,
    handleRegionToggle,
    handleOriginMove,
  } = useRegionHandlers();

  const { handleLiteratureExtractComplete, handleConfirmConcepts } =
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

  // Command Palette Logic
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        panelState.setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: graphMeta } = useGraph(id || "");
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || "");
  const nodeStatus = graphData?.nodeStatus ?? {};
  const { data: aiStatus } = useAIStatus(!!token);
  const aiEnabled = aiStatus?.enabled ?? true;

  const templateLayout = graphMeta?.settings?.layout as TemplateLayout | undefined;

  const nodes = useMemo(() => graphData?.nodes || [], [graphData?.nodes]);
  const edges = useMemo(() => graphData?.edges || [], [graphData?.edges]);

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
    setIsTextToGraphOpen,
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

    // Simple DFS
    const root = nodes.find((n) => n.level === "root") || nodes[0];
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;

      const node = nodes.find((n) => n.id === nodeId);
      // Visibility check based on mode
      if (!node) return;
      if (!isExplorationMode && node.is_accepted === false) return;

      visited.add(nodeId);
      path.push(nodeId);

      const children = edges
        .filter((e) => e.source_knowledge_point_id === nodeId)
        .map((e) => e.target_knowledge_point_id);

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
    mutations,
    record,
  });

  const aiOps = useGraphAIOperations({
    id: id || "",
    nodes,
    edges,
    state,
    mutations: {
      aiExpandMutation: mutations.aiExpandMutation,
      aiGenerateCardsMutation: mutations.aiGenerateCardsMutation,
      createCardsBatchMutation: mutations.createCardsBatchMutation,
      createTaskMutation: mutations.createTaskMutation,
      createNodeMutation: mutations.createNodeMutation,
      createEdgeMutation: mutations.createEdgeMutation,
      updateNodeMutation: mutations.updateNodeMutation,
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
    undo,
    redo,
    canUndo,
    canRedo,
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

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    undo,
    redo,
    canUndo,
    canRedo,
    deleteNode: nodeOps.handleDeleteNode,
    toggleDeleteMode: () => setIsDeleteMode((prev) => !prev),
    togglePathfindingMode: () => setIsPathfindingMode((prev) => !prev),
    toggleExplorationMode: () => setIsExplorationMode((prev) => !prev),
    toggleGrid: () => setShowGrid((prev) => !prev),
    toggleFocusMode: () => setIsFocusMode((prev) => !prev),
    toggleSidebar: () => {
      if (sidebarMode === "none") setSidebarMode("outline");
      else setSidebarMode("none");
    },
    saveNode: nodeOps.handleSaveNode,
    sidebarMode,
    selectedNode,
    viewMode,
    setViewMode,
  });

  // Global Shortcuts (new system)
  useGlobalShortcuts({
    handlers: {
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
        message.success("连接已创建");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        message.error(`创建连接失败: ${errorMessage}`);
      }
    },
    [mutations.createEdgeMutation, id],
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
    if (sidebarMode !== "none" && sidebarMode !== "outline") {
      setSidebarMode("none");
    }
  }, [
    clearFocus,
    sidebarMode,
    setSidebarMode,
  ]);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: GraphNode) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  const handleNodeLongPress = useCallback((node: GraphNode) => {
    setMobileActionNodeId(node.id);
    setMobileActionMenuOpen(true);
  }, []);

  // --- Extracted callbacks for child components ---

  const handleLayoutUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["graphData", id] });
  }, [queryClient, id]);

  const handleMarkNodeMastered = useCallback(async (_nodeId: string) => {
    try {
      await queryClient.invalidateQueries({
        queryKey: ["graphNodeStatus", id],
      });
      message.success("节点状态已更新");
    } catch (err) {
      console.error("Failed to update node status:", err);
    }
  }, [queryClient, id]);

  const handleOpenDetail = useCallback(() => {
    setSidebarMode("detail");
  }, [setSidebarMode]);

  const handleNavigateToGraphMap = useCallback(() => {
    navigate(`/graph-map?from=${id}`);
  }, [navigate, id]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

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

  const handleCommandPaletteNodeSelect = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      handleNodeClick(node);
      if (viewMode !== "mindmap") {
        setViewMode("mindmap");
      }
    }
  }, [nodes, handleNodeClick, viewMode, setViewMode]);

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

  const handleMobileGenerateContent = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node) {
      setSelectedNode(node);
      setIsTextToGraphOpen(true);
    }
  }, [nodes, mobileActionNodeId, setSelectedNode, setIsTextToGraphOpen]);

  const handleMobileGenerateCards = useCallback(() => {
    const node = nodes.find((n) => n.id === mobileActionNodeId);
    if (node) {
      setSelectedNode(node);
    }
  }, [nodes, mobileActionNodeId, setSelectedNode]);

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

  const handleConceptsSaved = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["graphData", id],
    });
    await queryClient.invalidateQueries({
      queryKey: ["graphNodeStatus", id],
    });
  }, [queryClient, id]);

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

  if (graphMeta?.template_type === "story_creation") {
    return (
      <Suspense fallback={<ViewLoader />}>
        <StoryEditor graphId={id!} graphMeta={graphMeta} />
      </Suspense>
    );
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${isDark ? "dark" : ""}`}
    >
      {/* 只读模式提示条 */}
      {isReadOnly && !isGraphLoading && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Lock size={16} />
            <span className="text-sm font-medium">
              只读模式 - 您正在查看公开图谱
            </span>
          </div>
          <button
            onClick={() => navigate(`/login?redirect=/graph/${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
          >
            <LogIn size={14} />
            登录以编辑
          </button>
        </div>
      )}
      {/* Main Canvas Area */}
      <div
        className={`flex-1 h-full relative ${isDeleteMode ? "cursor-not-allowed" : ""} ${isMobile ? "pb-14" : ""}`}
      >
        {isGraphLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">正在加载数据...</p>
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
              nodes.find((n) => n.id === contextMenu.nodeId)?.content || ""
            }
            onClose={() => setContextMenu(null)}
            onExecuteAction={aiOps.handleExecuteAction}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["graph", id] });
              queryClient.invalidateQueries({ queryKey: ["graphNodes", id] });
            }}
          />
        )}

        <div className="h-full w-full bg-white dark:bg-slate-900 relative">
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
            />
              </ErrorBoundary>
          )}
          {viewMode === "timeline" && (
            <Suspense fallback={<ViewLoader />}>
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
            </Suspense>
          )}
          {viewMode === "tree" && (
            <Suspense fallback={<ViewLoader />}>
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
            </Suspense>
          )}
          {viewMode === "planet" && (
            <Suspense fallback={<ViewLoader />}>
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
            </Suspense>
          )}
          {viewMode === "quadrant" && (
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
          )}
        </div>
      </div>

      <GraphToolbar
        onBack={handleBack}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        title={graphMeta?.title || "未命名图谱"}
        sidebarMode={sidebarMode}
        setSidebarMode={setSidebarMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        aiEnabled={aiEnabled}
        onTextToGraph={() => setIsTextToGraphOpen(true)}
        onAIExpand={aiOps.handleAIExpand}
        onBranchExplore={handleGetBranchSuggestions}
        onBackgroundTask={aiOps.handleBackgroundTask}
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
        isReadOnly={isReadOnly}
        isLiteratureExtractOpen={panelState.isLiteratureExtractOpen}
        setIsLiteratureExtractOpen={panelState.setIsLiteratureExtractOpen}
        isResearchProgressOpen={panelState.isResearchProgressOpen}
        setIsResearchProgressOpen={panelState.setIsResearchProgressOpen}
        isLiteratureLibraryOpen={panelState.isLiteratureLibraryOpen}
        setIsLiteratureLibraryOpen={panelState.setIsLiteratureLibraryOpen}
        isVersionHistoryOpen={panelState.isVersionHistoryOpen}
        setIsVersionHistoryOpen={panelState.setIsVersionHistoryOpen}
        regions={regions}
        collapsedRegions={collapsedRegions}
        onRegionToggle={handleRegionToggle}
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
      )}

      {sidebarMode === "none" && !isMobile && (
        <button
          onClick={handleOpenOutlineSidebar}
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

      <GraphModalManager
        id={id || ""}
        state={state}
        graphMeta={graphMeta}
        aiEnabled={aiEnabled}
        tutorOps={tutorOps}
        nodes={nodes}
      />

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
        onOpenRelationshipTypeSettings={handleOpenRelationshipTypeSettings}
      />

      <RelationshipTypeSettings
        isOpen={panelState.isRelationshipTypeSettingsOpen}
        onClose={() => panelState.setIsRelationshipTypeSettingsOpen(false)}
      />

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

      <Suspense fallback={<ViewLoader />}>
        <GraphAnalysisPanel
          graphId={id || ""}
          isOpen={isAnalysisPanelOpen}
          onClose={() => setIsAnalysisPanelOpen(false)}
          nodes={nodes}
          onNodeClick={handleAnalysisNodeClick}
          onCreateConnection={handleConnectNodes}
        />
      </Suspense>

      <Suspense fallback={<ViewLoader />}>
        <ConceptAggregationPanel
          graphId={id || ""}
          isOpen={panelState.isConceptAggregationOpen}
          onClose={() => panelState.setIsConceptAggregationOpen(false)}
        />
      </Suspense>

      <CommandPalette
        isOpen={panelState.isCommandPaletteOpen}
        onClose={() => panelState.setIsCommandPaletteOpen(false)}
        commands={commands}
        nodes={nodes}
        onNodeSelect={handleCommandPaletteNodeSelect}
      />

      <ShortcutHelpPanel
        isOpen={panelState.isShortcutHelpOpen}
        onClose={() => panelState.setIsShortcutHelpOpen(false)}
      />

      <Suspense fallback={<ViewLoader />}>
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
      </Suspense>

      {isMobile && (
        <MobileNodeActionMenu
          isOpen={mobileActionMenuOpen}
          onClose={handleMobileActionClose}
          nodeId={mobileActionNodeId}
          nodeTitle={nodes.find((n) => n.id === mobileActionNodeId)?.title}
          onEdit={handleMobileEdit}
          onAIExpand={handleMobileAIExpand}
          onGenerateContent={handleMobileGenerateContent}
          onGenerateCards={handleMobileGenerateCards}
          onStartLearning={handleMobileStartLearning}
          onDelete={handleMobileDelete}
        />
      )}
      {user?.id && (
        <Suspense fallback={<ViewLoader />}>
          <Console
            isOpen={panelState.isConsoleOpen}
            onClose={panelState.closeConsole}
            context={panelState.consoleContext}
            onToggleMinimize={panelState.toggleConsoleMinimize}
            isMinimized={panelState.isConsoleMinimized}
          />
        </Suspense>
      )}

      {panelState.isLiteratureExtractOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <LiteratureExtractPanel
              graphId={id}
              onExtractComplete={handleLiteratureExtractComplete}
              onConceptsSaved={handleConceptsSaved}
              onClose={() => panelState.setIsLiteratureExtractOpen(false)}
            />
          </div>
        </Suspense>
      )}

      {panelState.isResearchProgressOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <ResearchProgressPanel
            graphId={id}
            onClose={() => panelState.setIsResearchProgressOpen(false)}
          />
        </Suspense>
      )}

      {panelState.isLiteratureLibraryOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <LiteratureLibraryPanel
            graphId={id}
            onClose={() => panelState.setIsLiteratureLibraryOpen(false)}
          />
        </Suspense>
      )}

      {panelState.isVersionHistoryOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <div className="fixed right-0 top-0 bottom-0 z-40 w-80 shadow-xl border-l border-slate-200 dark:border-slate-700">
            <VersionHistoryPanel
              graphId={id}
              onClose={() => panelState.setIsVersionHistoryOpen(false)}
              onDiffSelect={handleDiffSelect}
            />
          </div>
        </Suspense>
      )}

      {panelState.selectedDiff && id && (
        <Suspense fallback={<ViewLoader />}>
          <div className="fixed right-80 top-0 bottom-0 z-40 w-80 shadow-xl border-l border-slate-200 dark:border-slate-700">
            <DiffDetailPanel
              graphId={id}
              sourceSnapshotId={panelState.selectedDiff.sourceSnapshotId}
              targetSnapshotId={panelState.selectedDiff.targetSnapshotId}
              onClose={() => panelState.setSelectedDiff(null)}
            />
          </div>
        </Suspense>
      )}

      {panelState.isConceptPreviewOpen && panelState.extractedConcepts.length > 0 && (
        <Suspense fallback={<ViewLoader />}>
          <ConceptPreviewList
            concepts={panelState.extractedConcepts}
            isOpen={panelState.isConceptPreviewOpen}
            onClose={handleConceptPreviewClose}
            onConfirm={handleConfirmConcepts}
          />
        </Suspense>
      )}
    </div>
  );
};

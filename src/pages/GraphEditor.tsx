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
  ExtractedConcept,
  TutorExtractedConcept,
} from "../types";
import type {
  CustomRegion,
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
import { learningPathsApi } from "../services/api/learningPaths";
import { useQueryClient } from "@tanstack/react-query";
import { useCommandPalette } from "./GraphEditor/useCommandPalette";

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

interface LearningPathNode {
  knowledge_point_id?: string;
  id?: string;
  order_index?: number;
}

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
  const [selectedLearningPathId, setSelectedLearningPathId] = useState<
    string | null
  >(null);
  const [learningPathNodeIds, setLearningPathNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [learningPathOrderMap, setLearningPathOrderMap] = useState<
    Map<string, number>
  >(new Map());
  const [customRegions, setCustomRegions] = useState<CustomRegion[]>([]);
  const [originPosition, setOriginPosition] = useState({ x: 400, y: 300 });
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);

  const handleStartSelectingParent = useCallback(() => {
    setIsSelectingParentNode(true);
  }, []);

  const handleCancelSelectingParent = useCallback(() => {
    setIsSelectingParentNode(false);
  }, []);

  const handleSelectLearningPath = useCallback(
    async (pathId: string | null) => {
      if (!pathId) {
        setSelectedLearningPathId(null);
        setLearningPathNodeIds(new Set());
        setLearningPathOrderMap(new Map());
        return;
      }

      try {
        const result = await learningPathsApi.get(pathId);
        if (result && result.nodes) {
          const nodeIds = new Set<string>();
          const orderMap = new Map<string, number>();

          result.nodes.forEach((node: LearningPathNode) => {
          const knowledgePointId = node.knowledge_point_id || node.id;
          if (knowledgePointId) {
            nodeIds.add(knowledgePointId);
            orderMap.set(knowledgePointId, node.order_index ?? 0);
          }
        });

          setSelectedLearningPathId(pathId);
          setLearningPathNodeIds(nodeIds);
          setLearningPathOrderMap(orderMap);
        }
      } catch (error) {
        console.error("Failed to fetch learning path:", error);
        message.error("获取学习路径失败");
      }
    },
    [],
  );

  const handleCreateRegion = useCallback(
    (region: Omit<CustomRegion, "id" | "createdAt" | "updatedAt">) => {
      const newRegion: CustomRegion = {
        ...region,
        id: `region-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCustomRegions((prev) => [...prev, newRegion]);
      message.success(`区域「${region.name}」创建成功`);
    },
    [],
  );

  const handleOriginMove = useCallback((position: { x: number; y: number }) => {
    setOriginPosition(position);
  }, []);

  const handleRegionToggle = useCallback((regionId: string) => {
    setCollapsedRegions((prev) => {
      if (prev.includes(regionId)) {
        return prev.filter((id) => id !== regionId);
      } else {
        return [...prev, regionId];
      }
    });
  }, []);

  const handleLiteratureExtractComplete = useCallback((result: { concepts?: ExtractedConcept[] }) => {
    if (result.concepts && result.concepts.length > 0) {
      panelState.setExtractedConcepts(result.concepts);
      panelState.setIsConceptPreviewOpen(true);
      panelState.setIsLiteratureExtractOpen(false);
    } else {
      message.info("未从文献中提取到概念");
    }
  }, []);

  const handleConfirmConcepts = useCallback(
    async (selectedConcepts: ExtractedConcept[]) => {
      if (!id || selectedConcepts.length === 0) return;

      try {
        const { literatureApi } = await import("../services/api/literature");
        const result = await literatureApi.applyConcepts({
          graph_id: id,
          concepts: selectedConcepts,
          relations: [],
          literature: selectedConcepts[0]?.source || {
            title: "文献来源",
            type: "document",
            processedAt: new Date().toISOString(),
          },
        });

        if (result.success) {
          message.success(`已添加 ${result.addedCount} 个概念，合并 ${result.mergedCount} 个相似概念`);
          await queryClient.invalidateQueries({ queryKey: ["graphData", id] });
        }
      } catch (error) {
        console.error("Failed to apply concepts:", error);
        message.error("添加概念失败");
      } finally {
        panelState.setIsConceptPreviewOpen(false);
        panelState.setExtractedConcepts([]);
      }
    },
    [id, queryClient],
  );

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

  const embeddingsMap = useMemo(() => {
    if (!embeddingData?.nodes) return undefined;
    const map = new Map<string, number[]>();
    for (const node of embeddingData.nodes) {
      let emb = node.embedding;
      // 容错：后端可能返回 pgvector 字符串格式
      if (typeof emb === 'string') {
        try { emb = JSON.parse(emb); } catch { emb = null; }
      }
      if (emb && Array.isArray(emb) && emb.length > 0) {
        map.set(node.id, emb);
      }
    }
    return map.size > 0 ? map : undefined;
  }, [embeddingData?.nodes]);

  const handleSelectParentFromGraph = useCallback(
    (nodeId: string) => {
      if (selectedNode?.id === nodeId) return;
      state.setNodeForm((prev) => {
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
    [selectedNode, state],
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

  // Narrative mode handlers
  const handleStartNarrative = useCallback(() => {
    if (!selectedLearningPathId || learningPathNodeIds.size === 0) {
      message.warning("请先选择学习路径");
      return;
    }

    // Build ordered path from learning path
    const orderedEntries = Array.from(learningPathOrderMap.entries())
      .sort(([, a], [, b]) => a - b);
    const path = orderedEntries.map(([nodeId]) => nodeId);

    if (path.length === 0) {
      message.warning("学习路径中没有节点");
      return;
    }

    // Get current camera transform from canvas
    const currentTransform = graphRef.current?.getTransform?.() ?? { x: 0, y: 0, k: 1 };

    // Switch to mindmap view if not already
    if (viewMode !== "mindmap") {
      setViewMode("mindmap");
    }

    // Exit presentation mode if active
    if (state.isPresentationMode) {
      state.setIsPresentationMode(false);
      state.setFocusedNodeId(null);
      state.setFocusedNodeIds(new Set());
      state.setFocusedLinkIds(new Set());
    }

    startNarrative(path, 'learningPath', currentTransform);
  }, [selectedLearningPathId, learningPathNodeIds, learningPathOrderMap, viewMode, setViewMode, state, startNarrative, graphRef]);

  const handleExitNarrative = useCallback(() => {
    const saved = state.savedTransform;
    exitNarrative();
    // Restore camera position after exiting narrative mode
    if (saved) {
      graphRef.current?.animateToTransform?.(saved, 600);
    }
  }, [exitNarrative, state.savedTransform, graphRef]);

  const handleLearningPathNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      focusNodeWithNode(node);

      if (viewMode !== "mindmap") {
        setViewMode("mindmap");
      }
    },
    [
      nodes,
      focusNodeWithNode,
      viewMode,
      setViewMode,
    ],
  );

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
      if (!state.isExplorationMode && node.is_accepted === false) return;

      visited.add(nodeId);
      path.push(nodeId);

      const children = edges
        .filter((e) => e.source_knowledge_point_id === nodeId)
        .map((e) => e.target_knowledge_point_id);

      children.forEach((childId) => dfs(childId));
    };

    if (root) dfs(root.id);
    return path;
  }, [nodes, edges, state.isExplorationMode]);

  // Sync focused node when step changes
  React.useEffect(() => {
    if (state.isPresentationMode && presentationPath.length > 0) {
      const nodeId = presentationPath[state.presentationStep];
      if (nodeId) {
        focusNode(nodeId);
        // Sync sidebar selection
        setSelectedNodeIds(new Set([nodeId]));
      }
    }
  }, [
    state.isPresentationMode,
    state.presentationStep,
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
        if (state.isPresentationMode) {
          state.setPresentationStep((p) =>
            Math.min(p + 1, presentationPath.length - 1),
          );
        }
      },
      presentationPrev: () => {
        if (state.isPresentationMode) {
          state.setPresentationStep((p) => Math.max(p - 1, 0));
        }
      },
    },
    context: {
      presentationMode: state.isPresentationMode,
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
    state.setBranchSuggestions(suggestions);
  }, [selectedNode, id, aiOps, state]);

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
              rightPanelWidth={sidebarMode !== "none" ? state.sidebarWidth : 0}
              graphId={id}
              onLayoutUpdate={(_positions) => {
                queryClient.invalidateQueries({ queryKey: ["graphData", id] });
              }}
              isSelectingParent={isSelectingParentNode}
              onSelectParent={handleSelectParentFromGraph}
              currentNodeId={selectedNode?.id}
              selectedParentIds={state.nodeForm.parentNodeIds}
              leftPanelWidth={panelState.isRAGChatOpen ? panelState.ragChatWidth : 0}
              onNavigateToGraphMap={() => navigate(`/graph-map?from=${id}`)}
              onMarkNodeMastered={async (_nodeId: string) => {
                try {
                  await queryClient.invalidateQueries({
                    queryKey: ["graphNodeStatus", id],
                  });
                  message.success("节点状态已更新");
                } catch (err) {
                  console.error("Failed to update node status:", err);
                }
              }}
              onNodeLongPress={isMobile ? handleNodeLongPress : undefined}
              isMobilePreviewMode={isMobile && isMobilePreviewMode}
              onOpenDetail={() => setSidebarMode("detail")}
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
                  sidebarMode !== "none" ? state.sidebarWidth : 0
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
                onSwitchBranch={async (pathItem, selectedSuggestion) => {
                  const parentNode = nodes.find(
                    (n) => n.id === pathItem.parentNodeId,
                  );
                  if (parentNode) switchBranch(pathItem, selectedSuggestion, parentNode);
                }}
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
        onBack={() => navigate(-1)}
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
        onTextToGraph={() => state.setIsTextToGraphOpen(true)}
        onAIExpand={aiOps.handleAIExpand}
        onBranchExplore={handleGetBranchSuggestions}
        onBackgroundTask={aiOps.handleBackgroundTask}
        isChatOpen={panelState.isRAGChatOpen}
        setIsChatOpen={panelState.setIsRAGChatOpen}
        isTutorMode={state.isTutorMode}
        onToggleTutorMode={tutorOps.handleToggleTutorMode}
        isPathfindingMode={isPathfindingMode}
        setIsPathfindingMode={setIsPathfindingMode}
        pathfindingState={{
          startNode: state.pathStartNode,
          endNode: state.pathEndNode,
          pathLength: state.highlightedPath?.nodes.size || 0,
          reset: () => {
            state.setPathStartNode(null);
            state.setPathEndNode(null);
            state.setHighlightedPath(null);
          },
        }}
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
        onOpenSettings={() => state.setIsSettingsOpen(true)}
        isExportMenuOpen={state.isExportMenuOpen}
        setIsExportMenuOpen={state.setIsExportMenuOpen}
        exportActions={{
          onMarkdown: exportOps.handleExportMarkdown,
          onPDF: exportOps.handleExportPDF,
          onJSON: exportOps.handleExportJSON,
          onImage: () => state.setIsExportImageModalOpen(true),
          onAnki: exportOps.handleExportAnki,
          onDeleteGraph: exportOps.handleDeleteGraph,
        }}
        onRefresh={() => window.location.reload()}
        onOpenHelp={() => state.setIsHelpOpen(true)}
        onOpenShortcutSettings={() => panelState.setIsShortcutHelpOpen(true)}
        onShare={() => state.setIsShareModalOpen(true)}
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
        onTogglePresentation={() => {
          if (state.isPresentationMode) {
            state.setIsPresentationMode(false);
            // Reset focus state when exiting presentation mode
            state.setFocusedNodeId(null);
            state.setFocusedNodeIds(new Set());
            state.setFocusedLinkIds(new Set());
          } else {
            state.setIsPresentationMode(true);
            state.setPresentationStep(0);
          }
        }}
        onTogglePodcast={() => state.setIsPodcastModalOpen(true)}
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

      {state.isPresentationMode && (
        <PresentationControls
          currentStep={state.presentationStep}
          totalSteps={presentationPath.length}
          onNext={() =>
            state.setPresentationStep((p) =>
              Math.min(p + 1, presentationPath.length - 1),
            )
          }
          onPrev={() => state.setPresentationStep((p) => Math.max(p - 1, 0))}
          onExit={() => {
            state.setIsPresentationMode(false);
            // Reset focus state when exiting presentation mode
            state.setFocusedNodeId(null);
            state.setFocusedNodeIds(new Set());
            state.setFocusedLinkIds(new Set());
          }}
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
          onGoToIndex={(index) => {
            explorationPathOps.goToPathIndex(index);
            const pathItem = explorationPathOps.explorationPath[index];
            if (pathItem) {
              focusNode(pathItem.nodeId);
            }
          }}
          onGoBack={() => {
            explorationPathOps.goBack();
            const pathItem = explorationPathOps.getCurrentPathItem();
            if (pathItem) {
              focusNode(pathItem.nodeId);
            }
          }}
          onGoForward={() => {
            explorationPathOps.goForward();
            const pathItem = explorationPathOps.getCurrentPathItem();
            if (pathItem) {
              focusNode(pathItem.nodeId);
            }
          }}
          onSwitchBranch={async (pathItem, selectedSuggestion) => {
            const parentNode = nodes.find(
              (n) => n.id === pathItem.parentNodeId,
            );
            if (parentNode) switchBranch(pathItem, selectedSuggestion, parentNode);
          }}
          canGoBack={explorationPathOps.canGoBack()}
          canGoForward={explorationPathOps.canGoForward()}
          isDark={isDark}
          isCollapsed={!isTimelineVisible}
          onToggleCollapse={() =>
            state.setIsTimelineVisible(!isTimelineVisible)
          }
        />
      )}

      {sidebarMode === "none" && !isMobile && (
        <button
          onClick={() => setSidebarMode("outline")}
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
        onOpenRelationshipTypeSettings={() => {
          panelState.setIsStyleSettingsOpen(false);
          panelState.setIsRelationshipTypeSettingsOpen(true);
        }}
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
          onNodeClick={(nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) handleNodeClick(node);
          }}
          onCreateConnection={async (sourceId, targetId) => {
            try {
              await mutations.createEdgeMutation.mutateAsync({
                source_knowledge_point_id: sourceId,
                target_knowledge_point_id: targetId,
                graphId: id || "",
                relationship_type: "contains",
              });
              message.success("连接已创建");
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : "未知错误";
              message.error(`创建连接失败: ${errorMessage}`);
            }
          }}
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
        onNodeSelect={(nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (node) {
            handleNodeClick(node);
            if (viewMode !== "mindmap") {
              setViewMode("mindmap");
            }
          }
        }}
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
          onNodeClick={(nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) handleNodeClick(node);
          }}
          isOpen={panelState.isRAGChatOpen}
          onOpenChange={panelState.setIsRAGChatOpen}
          selectedNodeIds={Array.from(selectedNodeIds)}
          aiEnabled={aiEnabled}
          isTutorMode={state.isTutorMode}
          tutorMode={state.tutorMode}
          extractedConcepts={panelState.extractedConcepts as unknown as TutorExtractedConcept[]}
          onToggleTutorMode={tutorOps.handleToggleTutorMode}
          onSwitchTutorMode={state.setTutorMode}
          onExtractConcepts={tutorOps.handleExtractConcepts}
          onAddConceptToGraph={tutorOps.handleAddConceptToGraph}
          onAddAllConcepts={tutorOps.handleAddAllConcepts}
          onSuggestNextTopics={tutorOps.handleSuggestNextTopics}
          suggestedNextTopics={state.suggestedNextTopics}
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
        />
      </Suspense>

      {isMobile && (
        <MobileNodeActionMenu
          isOpen={mobileActionMenuOpen}
          onClose={() => {
            setMobileActionMenuOpen(false);
            setMobileActionNodeId(null);
          }}
          nodeId={mobileActionNodeId}
          nodeTitle={nodes.find((n) => n.id === mobileActionNodeId)?.title}
          onEdit={() => {
            const node = nodes.find((n) => n.id === mobileActionNodeId);
            if (node) {
              setSelectedNode(node);
              setSidebarMode("edit");
            }
          }}
          onAIExpand={() => {
            const node = nodes.find((n) => n.id === mobileActionNodeId);
            if (node) {
              setSelectedNode(node);
              aiOps.handleAIExpand();
            }
          }}
          onGenerateContent={() => {
            const node = nodes.find((n) => n.id === mobileActionNodeId);
            if (node) {
              setSelectedNode(node);
              state.setIsTextToGraphOpen(true);
            }
          }}
          onGenerateCards={() => {
            const node = nodes.find((n) => n.id === mobileActionNodeId);
            if (node) {
              setSelectedNode(node);
            }
          }}
          onStartLearning={() => {
            const node = nodes.find((n) => n.id === mobileActionNodeId);
            if (node) {
              setSelectedNode(node);
              tutorOps.handleToggleTutorMode();
            }
          }}
          onDelete={() => {
            const node = nodes.find((n) => n.id === mobileActionNodeId);
            if (node) {
              nodeOps.handleDeleteNode(node);
            }
          }}
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
              onConceptsSaved={async () => {
                await queryClient.invalidateQueries({
                  queryKey: ["graphData", id],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["graphNodeStatus", id],
                });
              }}
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
              onDiffSelect={(sourceSnapshotId, targetSnapshotId) => {
                panelState.setSelectedDiff({ sourceSnapshotId, targetSnapshotId });
              }}
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
            onClose={() => {
              panelState.setIsConceptPreviewOpen(false);
              panelState.setExtractedConcepts([]);
            }}
            onConfirm={handleConfirmConcepts}
          />
        </Suspense>
      )}
    </div>
  );
};

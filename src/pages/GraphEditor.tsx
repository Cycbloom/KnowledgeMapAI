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
} from "../hooks/graphEditor";
import { useGraphAIOperations } from "../hooks/graphAI";
import {
  useTheme,
  useIsMobile,
  useKeyboardShortcuts,
  useGlobalShortcuts,
  useTutorOperations,
  useConsole,
} from "../hooks";
import {
  useGraph,
  useGraphData,
  useGraphNodeStatus,
  useAIStatus,
} from "../hooks/queries";
import { useGraphMutations } from "../hooks/mutations";
import { MobileNodeActionMenu } from "../components/GraphEditor/mobile/MobileNodeActionMenu";
import {
  getFocusedNodes,
  getFocusedLinks,
  getDirectChildren,
  getDirectNeighbors,
  getDirectNeighborEdges,
} from "../lib/graphUtils";
import type {
  Node as GraphNode,
  ColorScheme,
  GraphColorMode,
  LinkStyle,
  LinkAnimation,
  NodeSizeMode,
  EdgeWidthMode,
  BranchSuggestion,
  ExtractedConcept,
} from "../types";
import type {
  CustomRegion,
  RegionInfo,
  GraphBackboneModule,
} from "@shared/types/graph";
import {
  BackboneModule,
  BACKBONE_MODULE_TITLES,
  BACKBONE_MODULE_COLORS,
  BACKBONE_MODULE_ICONS,
} from "@shared/types/graph";
import { PresentationControls } from "../components/GraphEditor/toolbar/PresentationControls";
import { ActionResultModal } from "../components/GraphEditor/modals/ActionResultModal";
import { NodeContextMenu } from "../components/GraphEditor/context-menu/NodeContextMenu";
import {
  CommandPalette,
  CommandItem,
} from "../components/GraphEditor/shared/CommandPalette";
import { ShortcutHelpPanel } from "../components/common";
import { api, AIAction } from "../services/api";
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

const ConceptPreviewList = lazy(() =>
  import("../components/LiteratureExtract/ConceptPreviewList").then(
    (module) => ({
      default: module.ConceptPreviewList,
    }),
  ),
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

interface CreatedBranchNode {
  node: GraphNode;
  suggestion: BranchSuggestion;
  isAccepted: boolean;
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

  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [actionResult, setActionResult] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("default");
  const [linkStyle, setLinkStyle] = useState<LinkStyle>("curved");
  const [linkAnimation, setLinkAnimation] = useState<LinkAnimation>("none");
  const [nodeSizeMode, setNodeSizeMode] = useState<NodeSizeMode>("fixed");
  const [edgeWidthMode, setEdgeWidthMode] = useState<EdgeWidthMode>("fixed");
  const [coloringMode, setColoringMode] = useState<GraphColorMode>("level"); // Default to level (structure) as requested
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isRAGChatOpen, setIsRAGChatOpen] = useState(false);
  const [ragChatWidth, setRagChatWidth] = useState(420);
  const [isLiteratureExtractOpen, setIsLiteratureExtractOpen] = useState(false);
  const [isResearchProgressOpen, setIsResearchProgressOpen] = useState(false);
  const [isLiteratureLibraryOpen, setIsLiteratureLibraryOpen] = useState(false);
  const [extractedConcepts, setExtractedConcepts] = useState<any[]>([]);
  const [isConceptPreviewOpen, setIsConceptPreviewOpen] = useState(false);

  const {
    isOpen: isConsoleOpen,
    isMinimized: isConsoleMinimized,
    context: consoleContext,
    open: openConsole,
    close: closeConsole,
    toggleMinimize: toggleConsoleMinimize,
  } = useConsole({
    userId: user?.id || "",
    autoRegisterCommands: true,
  });
  const [isSelectingParentNode, setIsSelectingParentNode] = useState(false);
  const [isRelationshipTypeSettingsOpen, setIsRelationshipTypeSettingsOpen] =
    useState(false);
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
      setExtractedConcepts(result.concepts);
      setIsConceptPreviewOpen(true);
      setIsLiteratureExtractOpen(false);
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
        setIsConceptPreviewOpen(false);
        setExtractedConcepts([]);
      }
    },
    [id, queryClient],
  );

  // Command Palette Logic
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: graphMeta } = useGraph(id || "");
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || "");
  const { data: nodeStatus } = useGraphNodeStatus(id || "");
  const { data: aiStatus } = useAIStatus(!!token);
  const aiEnabled = aiStatus?.enabled ?? true;

  const templateLayout = graphMeta?.settings?.layout;

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
  } = state;

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

  const handleLearningPathNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      setSelectedNode(node);
      setSelectedNodeIds(new Set([nodeId]));
      setFocusedNodeId(nodeId);

      const focusedNodes = getFocusedNodes(nodeId, nodes, edges);
      setFocusedNodeIds(focusedNodes);

      const focusedLinks = getFocusedLinks(focusedNodes, edges);
      setFocusedLinkIds(focusedLinks);

      const directChildren = getDirectChildren(nodeId, nodes, edges);
      setForceShowTextIds(new Set([nodeId, ...directChildren]));

      if (viewMode !== "mindmap") {
        setViewMode("mindmap");
      }
    },
    [
      nodes,
      edges,
      setSelectedNode,
      setSelectedNodeIds,
      setFocusedNodeId,
      setFocusedNodeIds,
      setFocusedLinkIds,
      setForceShowTextIds,
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
        setFocusedNodeId(nodeId);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          // Sync sidebar selection
          setSelectedNodeIds(new Set([nodeId]));

          // Calculate and sync focused nodes/links for highlighting
          const focusedNodes = getFocusedNodes(nodeId, nodes, edges);
          setFocusedNodeIds(focusedNodes);
          const focusedLinks = getFocusedLinks(focusedNodes, edges);
          setFocusedLinkIds(focusedLinks);
        }
      }
    }
  }, [
    state.isPresentationMode,
    state.presentationStep,
    presentationPath,
    nodes,
    edges,
    setFocusedNodeId,
    setSelectedNode,
    setSelectedNodeIds,
    setFocusedNodeIds,
    setFocusedLinkIds,
  ]);

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
    mutations,
    record,
    navigate,
    token,
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

  // Computed Values
  const lockedNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const result = new Set<string>();
    Object.entries(nodeStatus).forEach(([id, status]: [string, any]) => {
      if (status.locked) result.add(id);
    });
    return result;
  }, [nodeStatus]);

  const masteredNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const result = new Set<string>();
    Object.entries(nodeStatus).forEach(([id, status]: [string, any]) => {
      if (status.mastered) result.add(id);
    });
    return result;
  }, [nodeStatus]);

  const dueTodayNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const result = new Set<string>();
    Object.entries(nodeStatus).forEach(([id, status]: [string, any]) => {
      if (status.due_today || status.due) result.add(id);
    });
    return result;
  }, [nodeStatus]);

  const graphStats = useMemo(() => {
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      masteredCount: masteredNodeIds.size,
      lockedCount: lockedNodeIds.size,
      dueTodayCount: dueTodayNodeIds.size,
    };
  }, [
    nodes.length,
    edges.length,
    masteredNodeIds.size,
    lockedNodeIds.size,
    dueTodayNodeIds.size,
  ]);

  const regions = useMemo<RegionInfo[]>(() => {
    if (nodes.length === 0) return [];

    const isTopicResearch = graphMeta?.template_type === "topic_research";

    if (isTopicResearch) {
      const backboneModules = graphMeta?.backbone_modules;

      if (backboneModules && backboneModules.length > 0) {
        const angleStep = (2 * Math.PI) / backboneModules.length;

        return backboneModules
          .sort(
            (a: GraphBackboneModule, b: GraphBackboneModule) =>
              a.display_order - b.display_order,
          )
          .map((module: GraphBackboneModule, index: number) => {
            const angleStart = index * angleStep;
            const angleEnd = (index + 1) * angleStep;

            const regionNodes = nodes.filter(
              (n) => n.properties?.backboneModule === module.module_type,
            );

            return {
              id: `region-${module.module_type}`,
              name: module.title,
              color:
                module.color ||
                BACKBONE_MODULE_COLORS[module.module_type as BackboneModule],
              icon:
                module.icon ||
                BACKBONE_MODULE_ICONS[module.module_type as BackboneModule],
              angleStart,
              angleEnd,
              nodes: regionNodes,
              isCollapsed: collapsedRegions.includes(
                `region-${module.module_type}`,
              ),
            };
          });
      }

      const orderedBackboneModules = [
        BackboneModule.RESEARCH_BACKGROUND,
        BackboneModule.LITERATURE_REVIEW,
        BackboneModule.RESEARCH_METHODS,
        BackboneModule.CORE_CONCEPTS,
        BackboneModule.APPLICATION_DOMAINS,
        BackboneModule.FUTURE_DIRECTIONS,
      ];

      const angleStep = (2 * Math.PI) / 6;

      return orderedBackboneModules.map((module, index) => {
        const angleStart = index * angleStep;
        const angleEnd = (index + 1) * angleStep;

        const regionNodes = nodes.filter(
          (n) => n.properties?.backboneModule === module,
        );

        return {
          id: `region-${module}`,
          name: BACKBONE_MODULE_TITLES[module],
          color: BACKBONE_MODULE_COLORS[module],
          icon: BACKBONE_MODULE_ICONS[module],
          angleStart,
          angleEnd,
          nodes: regionNodes,
          isCollapsed: collapsedRegions.includes(`region-${module}`),
        };
      });
    } else {
      if (customRegions.length === 0) {
        const levelGroups = new Map<string, typeof nodes>();

        nodes.forEach((node) => {
          const level = node.level || "leaf";
          if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
          }
          levelGroups.get(level)!.push(node);
        });

        const levels = Array.from(levelGroups.keys());
        const angleStep = (2 * Math.PI) / levels.length;

        return levels.map((level, index) => {
          const angleStart = index * angleStep;
          const angleEnd = (index + 1) * angleStep;

          return {
            id: `region-${level}`,
            name:
              level === "root"
                ? "根节点"
                : level === "core"
                  ? "骨干节点"
                  : "叶节点",
            color: `hsl(${(index * 360) / levels.length}, 70%, 50%)`,
            angleStart,
            angleEnd,
            nodes: levelGroups.get(level) || [],
            isCollapsed: collapsedRegions.includes(`region-${level}`),
          };
        });
      }

      const angleStep = (2 * Math.PI) / customRegions.length;

      return customRegions.map((region, index) => {
        const angleStart = index * angleStep;
        const angleEnd = (index + 1) * angleStep;

        const regionNodes = nodes.filter((n) => region.nodeIds.includes(n.id));

        return {
          id: region.id,
          name: region.name,
          color: region.color,
          angleStart,
          angleEnd,
          nodes: regionNodes,
          isCollapsed: collapsedRegions.includes(region.id),
        };
      });
    }
  }, [nodes, edges, graphMeta?.template_type, customRegions, collapsedRegions]);

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
      showHelp: () => setIsShortcutHelpOpen(true),
      openCommandPalette: () => setIsCommandPaletteOpen((prev) => !prev),
      toggleTheme,
      openConsole: () => {
        if (isConsoleOpen) {
          closeConsole();
        } else {
          openConsole();
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
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setFocusedNodeId(null);
    setFocusedNodeIds(new Set());
    setFocusedLinkIds(new Set());
    state.setForceShowTextIds(new Set());
  }, [
    prevSidebarMode,
    setSidebarMode,
    setPrevSidebarMode,
    setSelectedNode,
    setSelectedNodeIds,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    state,
  ]);

  const handleConnectNodes = useCallback(
    async (sourceId: string, targetId: string) => {
      try {
        await mutations.createEdgeMutation.mutateAsync({
          source_knowledge_point_id: sourceId,
          target_knowledge_point_id: targetId,
          graphId: id || "",
          relationship_type: "related",
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
      const neighbors = getDirectNeighbors(node.id, edges);
      const focusedNodes = new Set([node.id, ...neighbors]);
      const focusedLinks = getDirectNeighborEdges(node.id, focusedNodes, edges);
      const directChildren = getDirectChildren(node.id, nodes, edges);

      setSelectedNode(node);
      setSelectedNodeIds(new Set([node.id]));
      setFocusedNodeId(node.id);
      setFocusedNodeIds(focusedNodes);
      setFocusedLinkIds(focusedLinks);
      state.setForceShowTextIds(new Set([node.id, ...directChildren]));

      if (isMobile && isMobilePreviewMode) {
        // 预览模式：不打开侧边栏，只选中节点
      } else {
        // 侧边栏模式：打开详情侧边栏
        setSidebarMode("detail");
      }
    },
    [
      setSelectedNode,
      setSelectedNodeIds,
      setSidebarMode,
      nodes,
      edges,
      setFocusedNodeId,
      setFocusedNodeIds,
      setFocusedLinkIds,
      state,
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
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setFocusedNodeId(null);
    setFocusedNodeIds(new Set());
    setFocusedLinkIds(new Set());
    state.setForceShowTextIds(new Set());
    if (sidebarMode !== "none" && sidebarMode !== "outline") {
      setSidebarMode("none");
    }
  }, [
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    state,
    setSelectedNode,
    setSelectedNodeIds,
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

  const handleExecuteAction = async (action: AIAction, nodeId: string) => {
    try {
      message.info(`正在执行动作: ${action.name}...`);
      const res = await api.aiActions.execute({
        action_id: action.id,
        node_id: nodeId,
        graph_id: id,
      });

      // Handle show_result or fallback if data is string
      if (
        action.target_mode === "show_result" ||
        typeof res.data === "string"
      ) {
        setActionResult({
          title: action.name,
          content:
            typeof res.data === "string"
              ? res.data
              : JSON.stringify(res.data, null, 2),
        });
        message.success(`动作执行成功`);
      } else {
        await queryClient.invalidateQueries({ queryKey: ["graphData", id] });
        await queryClient.invalidateQueries({
          queryKey: ["graphNodeStatus", id],
        });

        let feedback = `动作执行成功: ${action.name}`;
        if (res.message) feedback += ` (${res.message})`;

        if (action.target_mode === "update_node" && res.data?.updatedFields) {
          feedback += `。已更新: ${res.data.updatedFields.join(", ")}`;
        } else if (
          action.target_mode === "spawn_children" &&
          res.data?.createdCount
        ) {
          feedback += `。已生成 ${res.data.createdCount} 个子节点`;
        }

        message.success(feedback);
      }
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      message.error(`执行失败: ${errorMessage}`);
    }
  };

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
            onExecuteAction={handleExecuteAction}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["graph", id] });
              queryClient.invalidateQueries({ queryKey: ["graphNodes", id] });
            }}
          />
        )}

        <div className="h-full w-full bg-white dark:bg-slate-900 relative">
          {viewMode === "mindmap" && (
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
              onSelectBranch={async (selectedSuggestion) => {
                if (!selectedNode || !id) return;

                const suggestionsToCreate = [...branchSuggestions];
                setBranchSuggestions([]);

                const createdNodes: CreatedBranchNode[] = [];

                for (const suggestion of suggestionsToCreate) {
                  const isAccepted = suggestion.id === selectedSuggestion.id;
                  const newNode = await aiOps.handleCreateBranch(
                    suggestion,
                    isAccepted,
                  );
                  if (newNode) {
                    createdNodes.push({
                      node: newNode,
                      suggestion,
                      isAccepted,
                    });
                  }
                }

                if (createdNodes.length > 0) {
                  const selectedNodeData = createdNodes.find(
                    (n) => n.isAccepted,
                  );
                  if (selectedNodeData) {
                    explorationPathOps.addToPath({
                      nodeId: selectedNodeData.node.id,
                      nodeTitle: selectedNodeData.node.title,
                      branchChoice: selectedNodeData.suggestion.title,
                      parentNodeId: selectedNode?.id,
                      branchSuggestionId: selectedNodeData.suggestion.id,
                      alternativeBranches: suggestionsToCreate,
                    });
                    setSelectedNode(selectedNodeData.node);
                    setFocusedNodeId(selectedNodeData.node.id);
                    const focusedNodes = getFocusedNodes(
                      selectedNodeData.node.id,
                      nodes,
                      edges,
                    );
                    const focusedLinks = getFocusedLinks(focusedNodes, edges);
                    setFocusedNodeIds(focusedNodes);
                    setFocusedLinkIds(focusedLinks);
                    const directChildren = getDirectChildren(
                      selectedNodeData.node.id,
                      nodes,
                      edges,
                    );
                    setForceShowTextIds(
                      new Set([selectedNodeData.node.id, ...directChildren]),
                    );
                  }
                }
              }}
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
              leftPanelWidth={isRAGChatOpen ? ragChatWidth : 0}
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
            />
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
                onSelectBranch={async (selectedSuggestion) => {
                  if (!selectedNode || !id) return;

                  const suggestionsToCreate = [...branchSuggestions];
                  setBranchSuggestions([]);

                  const createdNodes: CreatedBranchNode[] = [];

                  for (const suggestion of suggestionsToCreate) {
                    const isAccepted = suggestion.id === selectedSuggestion.id;
                    const newNode = await aiOps.handleCreateBranch(
                      suggestion,
                      isAccepted,
                    );
                    if (newNode) {
                      createdNodes.push({
                        node: newNode,
                        suggestion,
                        isAccepted,
                      });
                    }
                  }

                  if (createdNodes.length > 0) {
                    const selectedNodeData = createdNodes.find(
                      (n) => n.isAccepted,
                    );
                    if (selectedNodeData) {
                      explorationPathOps.addToPath({
                        nodeId: selectedNodeData.node.id,
                        nodeTitle: selectedNodeData.node.title,
                        branchChoice: selectedNodeData.suggestion.title,
                        parentNodeId: selectedNode?.id,
                        branchSuggestionId: selectedNodeData.suggestion.id,
                        alternativeBranches: suggestionsToCreate,
                      });
                      setSelectedNode(selectedNodeData.node);
                      setFocusedNodeId(selectedNodeData.node.id);
                      const focusedNodes = getFocusedNodes(
                        selectedNodeData.node.id,
                        nodes,
                        edges,
                      );
                      const focusedLinks = getFocusedLinks(focusedNodes, edges);
                      setFocusedNodeIds(focusedNodes);
                      setFocusedLinkIds(focusedLinks);
                      const directChildren = getDirectChildren(
                        selectedNodeData.node.id,
                        nodes,
                        edges,
                      );
                      setForceShowTextIds(
                        new Set([selectedNodeData.node.id, ...directChildren]),
                      );
                    }
                  }
                }}
                onSwitchBranch={async (pathItem, selectedSuggestion) => {
                  const parentNode = nodes.find(
                    (n) => n.id === pathItem.parentNodeId,
                  );
                  if (!parentNode) return;

                  const branches = pathItem.alternativeBranches || [];
                  const createdNodes: CreatedBranchNode[] = [];

                  for (const suggestion of branches) {
                    const isAccepted = suggestion.id === selectedSuggestion.id;
                    const newNode = await aiOps.handleCreateBranch(
                      suggestion,
                      isAccepted,
                    );
                    if (newNode) {
                      createdNodes.push({
                        node: newNode,
                        suggestion,
                        isAccepted,
                      });
                    }
                  }

                  if (createdNodes.length > 0) {
                    const selectedNodeData = createdNodes.find(
                      (n) => n.isAccepted,
                    );
                    if (selectedNodeData) {
                      explorationPathOps.addToPath({
                        nodeId: selectedNodeData.node.id,
                        nodeTitle: selectedNodeData.node.title,
                        branchChoice: selectedNodeData.suggestion.title,
                        parentNodeId: parentNode.id,
                        branchSuggestionId: selectedNodeData.suggestion.id,
                        alternativeBranches: branches,
                      });
                      setHistoricalAlternativeBranches((prev) => [
                        ...prev.filter((item) => item.nodeId !== parentNode.id),
                        {
                          nodeId: parentNode.id,
                          branches,
                          selectedBranchId: selectedSuggestion.id,
                        },
                      ]);
                      setSelectedNode(selectedNodeData.node);
                      setFocusedNodeId(selectedNodeData.node.id);
                      const focusedNodes = getFocusedNodes(
                        selectedNodeData.node.id,
                        nodes,
                        edges,
                      );
                      const focusedLinks = getFocusedLinks(focusedNodes, edges);
                      setFocusedNodeIds(focusedNodes);
                      setFocusedLinkIds(focusedLinks);
                      const directChildren = getDirectChildren(
                        selectedNodeData.node.id,
                        nodes,
                        edges,
                      );
                      state.setForceShowTextIds(
                        new Set([selectedNodeData.node.id, ...directChildren]),
                      );
                    }
                  }
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
        onBack={() => navigate("/dashboard")}
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
        isChatOpen={isRAGChatOpen}
        setIsChatOpen={setIsRAGChatOpen}
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
        isStyleSettingsOpen={isStyleSettingsOpen}
        setIsStyleSettingsOpen={setIsStyleSettingsOpen}
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
        onOpenShortcutSettings={() => setIsShortcutHelpOpen(true)}
        onShare={() => state.setIsShareModalOpen(true)}
        onOpenAnalysis={() => setIsAnalysisPanelOpen(true)}
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
        isRAGChatOpen={isRAGChatOpen}
        ragChatWidth={ragChatWidth}
        isReadOnly={isReadOnly}
        isLiteratureExtractOpen={isLiteratureExtractOpen}
        setIsLiteratureExtractOpen={setIsLiteratureExtractOpen}
        isResearchProgressOpen={isResearchProgressOpen}
        setIsResearchProgressOpen={setIsResearchProgressOpen}
        isLiteratureLibraryOpen={isLiteratureLibraryOpen}
        setIsLiteratureLibraryOpen={setIsLiteratureLibraryOpen}
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

      {isTimelineVisible && isExplorationMode && (
        <ExplorationTimeline
          explorationPath={explorationPathOps.explorationPath}
          currentPathIndex={explorationPathOps.currentPathIndex}
          sidebarMode={sidebarMode}
          onGoToIndex={(index) => {
            explorationPathOps.goToPathIndex(index);
            const pathItem = explorationPathOps.explorationPath[index];
            if (pathItem) {
              const node = nodes.find((n) => n.id === pathItem.nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                const focusedNodes = getFocusedNodes(node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(node.id, nodes, edges);
                state.setForceShowTextIds(
                  new Set([node.id, ...directChildren]),
                );
              }
            }
          }}
          onGoBack={() => {
            explorationPathOps.goBack();
            const pathItem = explorationPathOps.getCurrentPathItem();
            if (pathItem) {
              const node = nodes.find((n) => n.id === pathItem.nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                const focusedNodes = getFocusedNodes(node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(node.id, nodes, edges);
                state.setForceShowTextIds(
                  new Set([node.id, ...directChildren]),
                );
              }
            }
          }}
          onGoForward={() => {
            explorationPathOps.goForward();
            const pathItem = explorationPathOps.getCurrentPathItem();
            if (pathItem) {
              const node = nodes.find((n) => n.id === pathItem.nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                const focusedNodes = getFocusedNodes(node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(node.id, nodes, edges);
                state.setForceShowTextIds(
                  new Set([node.id, ...directChildren]),
                );
              }
            }
          }}
          onSwitchBranch={async (pathItem, selectedSuggestion) => {
            const parentNode = nodes.find(
              (n) => n.id === pathItem.parentNodeId,
            );
            if (!parentNode) return;

            const branches = pathItem.alternativeBranches || [];
            const createdNodes: CreatedBranchNode[] = [];

            for (const suggestion of branches) {
              const isAccepted = suggestion.id === selectedSuggestion.id;
              const newNode = await aiOps.handleCreateBranch(
                suggestion,
                isAccepted,
              );
              if (newNode) {
                createdNodes.push({ node: newNode, suggestion, isAccepted });
              }
            }

            if (createdNodes.length > 0) {
              const selectedNodeData = createdNodes.find((n) => n.isAccepted);
              if (selectedNodeData) {
                explorationPathOps.addToPath({
                  nodeId: selectedNodeData.node.id,
                  nodeTitle: selectedNodeData.node.title,
                  branchChoice: selectedNodeData.suggestion.title,
                  parentNodeId: parentNode.id,
                  branchSuggestionId: selectedNodeData.suggestion.id,
                  alternativeBranches: branches,
                });
                setHistoricalAlternativeBranches((prev) => [
                  ...prev.filter((item) => item.nodeId !== parentNode.id),
                  {
                    nodeId: parentNode.id,
                    branches,
                    selectedBranchId: selectedSuggestion.id,
                  },
                ]);
                setSelectedNode(selectedNodeData.node);
                setFocusedNodeId(selectedNodeData.node.id);
                const focusedNodes = getFocusedNodes(
                  selectedNodeData.node.id,
                  nodes,
                  edges,
                );
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(
                  selectedNodeData.node.id,
                  nodes,
                  edges,
                );
                state.setForceShowTextIds(
                  new Set([selectedNodeData.node.id, ...directChildren]),
                );
              }
            }
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
        isOpen={!!actionResult}
        onClose={() => setActionResult(null)}
        title={actionResult?.title || ""}
        content={actionResult?.content || ""}
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
        isOpen={isStyleSettingsOpen}
        onClose={() => setIsStyleSettingsOpen(false)}
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
          setIsStyleSettingsOpen(false);
          setIsRelationshipTypeSettingsOpen(true);
        }}
      />

      <RelationshipTypeSettings
        isOpen={isRelationshipTypeSettingsOpen}
        onClose={() => setIsRelationshipTypeSettingsOpen(false)}
      />

      <Suspense fallback={<ViewLoader />}>
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
        />
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
                relationship_type: "related",
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

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
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
        isOpen={isShortcutHelpOpen}
        onClose={() => setIsShortcutHelpOpen(false)}
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
          isOpen={isRAGChatOpen}
          onOpenChange={setIsRAGChatOpen}
          selectedNodeIds={Array.from(selectedNodeIds)}
          aiEnabled={aiEnabled}
          isTutorMode={state.isTutorMode}
          tutorMode={state.tutorMode}
          extractedConcepts={state.extractedConcepts}
          onToggleTutorMode={tutorOps.handleToggleTutorMode}
          onSwitchTutorMode={state.setTutorMode}
          onExtractConcepts={tutorOps.handleExtractConcepts}
          onAddConceptToGraph={tutorOps.handleAddConceptToGraph}
          onAddAllConcepts={tutorOps.handleAddAllConcepts}
          onSuggestNextTopics={tutorOps.handleSuggestNextTopics}
          suggestedNextTopics={state.suggestedNextTopics}
          onTutorChat={tutorOps.handleTutorChat}
          width={ragChatWidth}
          onWidthChange={setRagChatWidth}
          isMobilePreviewMode={
            isMobile && isMobilePreviewMode && !!selectedNode
          }
          selectedLearningPathId={selectedLearningPathId}
          onPathSelect={handleSelectLearningPath}
          onLearningPathNodeClick={handleLearningPathNodeClick}
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
            isOpen={isConsoleOpen}
            onClose={closeConsole}
            context={consoleContext}
            onToggleMinimize={toggleConsoleMinimize}
            isMinimized={isConsoleMinimized}
          />
        </Suspense>
      )}

      {isLiteratureExtractOpen && id && (
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
              onClose={() => setIsLiteratureExtractOpen(false)}
            />
          </div>
        </Suspense>
      )}

      {isResearchProgressOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <ResearchProgressPanel
            graphId={id}
            onClose={() => setIsResearchProgressOpen(false)}
          />
        </Suspense>
      )}

      {isLiteratureLibraryOpen && id && (
        <Suspense fallback={<ViewLoader />}>
          <LiteratureLibraryPanel
            graphId={id}
            onClose={() => setIsLiteratureLibraryOpen(false)}
          />
        </Suspense>
      )}

      {isConceptPreviewOpen && extractedConcepts.length > 0 && (
        <Suspense fallback={<ViewLoader />}>
          <ConceptPreviewList
            concepts={extractedConcepts}
            isOpen={isConceptPreviewOpen}
            onClose={() => {
              setIsConceptPreviewOpen(false);
              setExtractedConcepts([]);
            }}
            onConfirm={handleConfirmConcepts}
          />
        </Suspense>
      )}
    </div>
  );
};

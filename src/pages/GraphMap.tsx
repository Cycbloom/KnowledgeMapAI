import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, BookOpen, X, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "../services/api";
import { useMessageStore } from "../store/useMessageStore";
import { queryKeys } from "../hooks/queries/queryConfig";
import { useIsMobile } from "../hooks/common/useIsMobile";
import { GraphMapToolbar } from "../components/GraphMap/GraphMapToolbar";
import { domainsApi, graphDomainsApi } from "../services/api/domains";
import type { DomainTreeNode } from "@shared/types/graph";
import { CreateRelationPanel } from "../components/GraphMap/CreateRelationPanel";
import { QuickCreateGraphPanel } from "../components/GraphMap/QuickCreateGraphPanel";
import { DomainManager } from "../components/GraphMap/DomainManager";
import { useAnalysisModules } from "../hooks/useAnalysisModules";
import type {
  Graph,
  GraphRelation,
  GraphMapFilterMode,
  GraphRelationType,
  QuickCreateGraphRequest,
  InfiniteExpansionProgress,
  DiscoveredRelation,
  AnalysisMode,
} from "../types";
import type { AnalysisModuleState } from "../components/GraphMap/types";

const GraphMapCanvas = lazy(() =>
  import("../components/GraphMap/GraphMapCanvas").then((module) => ({
    default: module.GraphMapCanvas,
  }))
);

const AIExpansionPanel = lazy(() =>
  import("../components/GraphMap/AIExpansionPanel").then((module) => ({
    default: module.AIExpansionPanel,
  }))
);

const DomainGraphGenerator = lazy(() =>
  import("../components/GraphMap/DomainGraphGenerator").then((module) => ({
    default: module.DomainGraphGenerator,
  }))
);

const PromptEditor = lazy(() =>
  import("../components/GraphEditor/panels/PromptEditor").then((module) => ({
    default: module.PromptEditor,
  }))
);

const NodeSelectorModal = lazy(() =>
  import("../components/GraphMap/NodeSelectorModal").then((module) => ({
    default: module.NodeSelectorModal,
  }))
);

const GenerateCardsModal = lazy(() =>
  import("../components/Learning/GenerateCardsModal").then((module) => ({
    default: module.GenerateCardsModal,
  }))
);

const GraphRelationDiscoveryPanel = lazy(() =>
  import("../components/GraphMap/GraphRelationDiscoveryPanel").then((module) => ({
    default: module.GraphRelationDiscoveryPanel,
  }))
);

const ModularAnalysisPanel = lazy(() =>
  import("../components/GraphMap/ModularAnalysisPanel").then((module) => ({
    default: module.ModularAnalysisPanel,
  }))
);

const AnalysisResultViewer = lazy(() =>
  import("../components/GraphMap/AnalysisResultViewer").then((module) => ({
    default: module.AnalysisResultViewer,
  }))
);

const BatchOperationPanel = lazy(() =>
  import("../components/GraphMap/BatchOperationPanel").then((module) => ({
    default: module.BatchOperationPanel,
  }))
);

const AgentAnalysisPanel = lazy(() =>
  import("../components/GraphMap/AgentAnalysisPanel").then((module) => ({
    default: module.AgentAnalysisPanel,
  }))
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export const GraphMap = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { addMessage } = useMessageStore();
  const { isMobile } = useIsMobile();

  const fromGraphId = searchParams.get("from");

  const [filterMode, setFilterMode] = useState<GraphMapFilterMode>("all");
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(
    fromGraphId,
  );
  const [multiSelectedGraphIds, setMultiSelectedGraphIds] = useState<
    Set<string>
  >(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [isCreateGraphPanelOpen, setIsCreateGraphPanelOpen] = useState(false);
  const [createGraphRelationType, setCreateGraphRelationType] = useState<
    GraphRelationType | undefined
  >(undefined);
  const [isAIExpansionOpen, setIsAIExpansionOpen] = useState(false);
  const [expansionProgress, setExpansionProgress] =
    useState<InfiniteExpansionProgress | null>(null);
  const [isExpansionRunning, setIsExpansionRunning] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [promptContent, setPromptContent] = useState("");
  const [promptEditMode, setPromptEditMode] = useState<"depth" | "width">(
    "width",
  );
  const [depthPromptType, setDepthPromptType] = useState<"init" | "expand">(
    "init",
  );
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const [isDomainGeneratorOpen, setIsDomainGeneratorOpen] = useState(false);
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isGenerateCardsModalOpen, setIsGenerateCardsModalOpen] =
    useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isDiscoveryPanelOpen, setIsDiscoveryPanelOpen] = useState(false);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);
  const [isModularAnalysisOpen, setIsModularAnalysisOpen] = useState(false);
  const [viewingModule, setViewingModule] = useState<AnalysisModuleState | null>(null);
  const [isAgentAnalysisOpen, setIsAgentAnalysisOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('quick');
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(() => {
    const domainParam = searchParams.get('domain');
    if (!domainParam) return new Set();
    return new Set(domainParam.split(',').filter(Boolean));
  });
  const [isBatchDomainPickerOpen, setIsBatchDomainPickerOpen] = useState(false);
  const [isBatchSettingDomain, setIsBatchSettingDomain] = useState(false);
  const [showDomainManager, setShowDomainManager] = useState(false);

  useEffect(() => {
    if (selectedDomainIds.size > 0) {
      setSearchParams({ domain: Array.from(selectedDomainIds).join(',') }, { replace: true });
    } else {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('domain');
      setSearchParams(newParams, { replace: true });
    }
  }, [selectedDomainIds]);

  const {
    modules,
    toggleModule,
    executeModules,
    resetModules,
  } = useAnalysisModules();

  const {
    data: mapData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["graphMap"],
    queryFn: () => api.graphs.getMap(),
  });

  const {
    data: domainTreeRaw,
  } = useQuery({
    queryKey: ["domainTree"],
    queryFn: () => domainsApi.getTree(),
    staleTime: 5 * 60 * 1000,
  });

  const domainTree = useMemo(() => {
    if (!domainTreeRaw) return [];
    if (Array.isArray(domainTreeRaw)) return domainTreeRaw;
    if (domainTreeRaw && 'domains' in domainTreeRaw && Array.isArray((domainTreeRaw as any).domains)) {
      return (domainTreeRaw as any).domains;
    }
    return [];
  }, [domainTreeRaw]);

  const hasCheckedUncategorized = useRef(false);

  useEffect(() => {
    if (hasCheckedUncategorized.current) return;
    if (domainTree && !domainTree.some((d: DomainTreeNode) => d.name === '未分类')) {
      hasCheckedUncategorized.current = true;
      domainsApi.ensureUncategorized().catch(() => {});
    }
  }, [domainTree]);

  const graphs = useMemo(() => mapData?.graphs || [], [mapData?.graphs]);
  const relations = useMemo(
    () => mapData?.relations || [],
    [mapData?.relations],
  );

  // 构建领域 ID -> 颜色 映射
  const domainColorMap = useMemo(() => {
    const map = new Map<string, string>();

    function flattenDomains(nodes: DomainTreeNode[]) {
      nodes.forEach(node => {
        map.set(node.id, node.color);
        if (node.children?.length) {
          flattenDomains(node.children);
        }
      });
    }

    if (domainTree) {
      flattenDomains(domainTree);
    }
    return map;
  }, [domainTree]);

  // 构建领域 ID -> {name, color} 映射（用于内部逻辑）
  const domainIdToInfo = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();

    function flattenDomains(nodes: DomainTreeNode[]) {
      nodes.forEach(node => {
        map.set(node.id, { name: node.name, color: node.color });
        if (node.children?.length) {
          flattenDomains(node.children);
        }
      });
    }

    if (domainTree) {
      flattenDomains(domainTree);
    }
    return map;
  }, [domainTree]);

  // 构建 graphId -> 其所属领域ID集合的映射
  const graphDomainMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    graphs.forEach((graph: Graph) => {
      const domainIds = (graph as any).domainIds || [];
      if (domainIds.length > 0) {
        map.set(graph.id, new Set(domainIds));
      } else if (graph.domain) {
        // 回退：通过名称匹配（兼容旧数据）
        const matchedId = Array.from(domainIdToInfo.entries()).find(
          ([, info]) => info.name === graph.domain
        )?.[0];
        if (matchedId) {
          map.set(graph.id, new Set([matchedId]));
        }
      }
    });

    return map;
  }, [graphs, domainIdToInfo]);

  // 领域筛选变更处理
  const handleDomainSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedDomainIds(ids);
  }, []);

  const fromGraph = graphs.find((g: Graph) => g.id === fromGraphId);

  const handleGraphClick = useCallback((graph: Graph) => {
    setSelectedGraphId(graph.id);
    setMultiSelectedGraphIds(new Set());
  }, []);

  const handleMultiSelectGraph = useCallback(
    (graphId: string, isMultiSelect: boolean, isRangeSelect?: boolean) => {
      if (isRangeSelect && lastSelectedIndex >= 0) {
        const currentIndex = graphs.findIndex((g: Graph) => g.id === graphId);
        if (currentIndex >= 0) {
          const start = Math.min(lastSelectedIndex, currentIndex);
          const end = Math.max(lastSelectedIndex, currentIndex);
          const rangeIds = graphs.slice(start, end + 1).map((g: Graph) => g.id);
          setMultiSelectedGraphIds(new Set(rangeIds));
        }
      } else if (isMultiSelect) {
        setMultiSelectedGraphIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(graphId)) {
            newSet.delete(graphId);
          } else {
            newSet.add(graphId);
          }
          return newSet;
        });
        setLastSelectedIndex(graphs.findIndex((g: Graph) => g.id === graphId));
      } else {
        setMultiSelectedGraphIds(new Set([graphId]));
        setLastSelectedIndex(graphs.findIndex((g: Graph) => g.id === graphId));
      }
    },
    [graphs, lastSelectedIndex],
  );

  const clearMultiSelection = useCallback(() => {
    setMultiSelectedGraphIds(new Set());
    setLastSelectedIndex(-1);
  }, []);

  const handleBoxSelection = useCallback((graphIds: string[]) => {
    setMultiSelectedGraphIds(new Set(graphIds));
    if (graphIds.length > 0) {
      setLastSelectedIndex(graphs.findIndex((g: Graph) => g.id === graphIds[graphIds.length - 1]));
    }
  }, [graphs]);

  const selectRelatedGraphs = useCallback((graphId: string) => {
    const relatedIds = new Set<string>([graphId]);

    relations.forEach((r: GraphRelation) => {
      if (r.source_graph_id === graphId) relatedIds.add(r.target_graph_id);
      if (r.target_graph_id === graphId) relatedIds.add(r.source_graph_id);
    });

    setMultiSelectedGraphIds(relatedIds);
    setSelectedGraphId(null);
  }, [relations]);

  const handleBatchCreateRelation = useCallback(() => {
    setIsCreatePanelOpen(true);
  }, []);

  const handleBatchAnalyze = useCallback(() => {
    setIsModularAnalysisOpen(true);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(multiSelectedGraphIds);
    if (ids.length === 0) return;

    const confirmMessage = `确定要删除选中的 ${ids.length} 个图谱吗？此操作不可撤销。`;
    if (!window.confirm(confirmMessage)) return;

    try {
      for (const id of ids) {
        await api.graphs.delete(id);
      }
      addMessage({ type: "success", content: `成功删除 ${ids.length} 个图谱` });
      setMultiSelectedGraphIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["graphMap"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "批量删除失败";
      addMessage({ type: "error", content: message });
    }
  }, [multiSelectedGraphIds, addMessage, queryClient]);

  const handleBatchSetDomain = useCallback(async (domainId: string) => {
    const ids = Array.from(multiSelectedGraphIds);
    if (ids.length === 0) return;

    setIsBatchSettingDomain(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const graphId of ids) {
        try {
          await graphDomainsApi.updateByGraphId(graphId, [{ domain_id: domainId }]);
          successCount++;
        } catch (error) {
          failCount++;
        }
      }

      if (failCount === 0) {
        addMessage({ type: "success", content: `成功为 ${successCount} 个图谱设置领域` });
      } else if (successCount > 0) {
        addMessage({
          type: "warning",
          content: `部分完成：${successCount} 个成功，${failCount} 个失败`,
        });
      } else {
        addMessage({ type: "error", content: `批量设置领域失败` });
      }

      setMultiSelectedGraphIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["graphMap"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      setIsBatchDomainPickerOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "批量设置领域失败";
      addMessage({ type: "error", content: message });
    } finally {
      setIsBatchSettingDomain(false);
    }
  }, [multiSelectedGraphIds, addMessage, queryClient]);

  const handleCombinedOpen = useCallback(() => {
    const ids = Array.from(multiSelectedGraphIds);
    if (ids.length === 2) {
      navigate(`/combined-graphs/${ids[0]}/${ids[1]}`);
    }
  }, [multiSelectedGraphIds, navigate]);

  const handleCreateRelation = useCallback(
    async (data: {
      source_graph_id: string;
      target_graph_id: string;
      relation_type: GraphRelationType;
      context?: string;
    }) => {
      try {
        await api.graphs.createRelation(data);
        addMessage({ type: "success", content: "关系创建成功" });
        queryClient.invalidateQueries({ queryKey: ["graphMap"] });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "创建关系失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [addMessage, queryClient],
  );

  const handleDeleteRelation = useCallback(
    async (relationId: string) => {
      try {
        await api.graphs.deleteRelationById(relationId);
        addMessage({ type: "success", content: "关系已删除" });
        queryClient.invalidateQueries({ queryKey: ["graphMap"] });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "删除关系失败";
        addMessage({ type: "error", content: message });
      }
    },
    [addMessage, queryClient],
  );

  const handleQuickCreateGraph = useCallback(
    async (data: QuickCreateGraphRequest) => {
      try {
        const newGraph = await api.graphs.create({
          title: data.title,
          description: data.description,
        });

        if (data.relation_to) {
          const sourceId =
            data.relation_to.type === "prerequisite"
              ? newGraph.id
              : data.relation_to.graph_id;
          const targetId =
            data.relation_to.type === "prerequisite"
              ? data.relation_to.graph_id
              : newGraph.id;

          await api.graphs.createRelation({
            source_graph_id: sourceId,
            target_graph_id: targetId,
            relation_type: data.relation_to.type,
          });
        }

        addMessage({ type: "success", content: "图谱创建成功" });
        queryClient.invalidateQueries({ queryKey: ["graphMap"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });

        if (data.auto_generate_content) {
          addMessage({ type: "info", content: "正在生成初始内容..." });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "创建图谱失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [addMessage, queryClient],
  );

  const handleCreateRelatedGraph = useCallback(
    (relationType: GraphRelationType) => {
      setCreateGraphRelationType(relationType);
      setIsCreateGraphPanelOpen(true);
    },
    [],
  );

  const handleInfiniteExpand = useCallback(
    async (config: {
      max_depth: number;
      max_graphs_per_level: number;
      relation_types: GraphRelationType[];
      auto_generate_nodes: boolean;
      node_depth: number;
    }) => {
      if (!selectedGraphId) return;

      try {
        await api.graphs.infiniteExpand(selectedGraphId, config);
        addMessage({ type: "success", content: "无限扩展任务已启动" });
        setIsExpansionRunning(true);
        setExpansionProgress({
          status: "running",
          current_depth: 0,
          total_graphs_created: 0,
          total_nodes_created: 0,
          created_graphs: [],
          errors: [],
        });

        queryClient.invalidateQueries({ queryKey: ["graphMap"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "启动扩展失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [selectedGraphId, addMessage, queryClient],
  );

  const handleDepthExpand = useCallback(
    async (config: {
      style: "academic" | "practical" | "beginner" | "custom";
      customPrompt?: string;
      sources?: string[];
      depth: number;
    }): Promise<{ root: any; coreNodes: any[] } | null> => {
      if (!selectedGraphId) return null;

      try {
        const graph = graphs.find((g: Graph) => g.id === selectedGraphId);
        if (!graph) return null;

        const result = await api.autoGraph.init({
          topic: graph.title,
          style: config.style,
          customPrompt: config.customPrompt,
          sources: config.sources,
          graph_id: selectedGraphId,
        });

        if (result.root && result.coreNodes) {
          const nodes = [
            {
              title: result.root.title,
              content: result.root.content,
              level: "root",
            },
            ...result.coreNodes.map((n: any) => ({
              title: n.title,
              content: n.content,
              level: n.level || "core",
            })),
          ];

          const saveResult = await api.autoGraph.saveNodes({
            graph_id: selectedGraphId,
            nodes,
          });

          queryClient.invalidateQueries({ queryKey: ["graphMap"] });

          // 将 nodeMapping 中的 ID 映射到 coreNodes
          if (saveResult.nodeMapping) {
            const coreNodesWithIds = result.coreNodes.map(
              (n: any, index: number) => {
                const tempId = `temp-${index + 1}`; // root 是 temp-0, coreNodes 从 temp-1 开始
                return {
                  ...n,
                  id: saveResult.nodeMapping[tempId]?.graphNodeId,
                };
              },
            );
            return { root: result.root, coreNodes: coreNodesWithIds };
          }

          return { root: result.root, coreNodes: result.coreNodes };
        }
        return null;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "深度拓展失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [selectedGraphId, graphs, addMessage, queryClient],
  );

  const handleDepthExpandNode = useCallback(
    async (config: {
      nodeId: string;
      nodeTitle: string;
      nodeContent?: string;
      nodeLevel?: string;
      style: "academic" | "practical" | "beginner" | "custom";
      customPrompt?: string;
      existingChildren?: { title: string }[];
    }): Promise<any[] | null> => {
      if (!selectedGraphId) return null;

      try {
        const result = await api.autoGraph.expand({
          node_id: config.nodeId,
          node_title: config.nodeTitle,
          node_content: config.nodeContent,
          node_level: config.nodeLevel,
          graph_id: selectedGraphId,
          style: config.style,
          customPrompt: config.customPrompt,
          existing_children: config.existingChildren,
        });

        if (result.children && result.children.length > 0) {
          const nodes = result.children.map((n: any) => ({
            title: n.title,
            content: n.content,
            level: n.level || "sub",
            parentId: config.nodeId,
          }));

          await api.autoGraph.saveNodes({
            graph_id: selectedGraphId,
            nodes,
          });

          queryClient.invalidateQueries({ queryKey: ["graphMap"] });

          return result.children;
        }
        return null;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "展开节点失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [selectedGraphId, addMessage, queryClient],
  );

  const handleOpenPromptEditor = useCallback(
    async (mode: "depth" | "width") => {
      try {
        const templates = await api.prompts.list();

        if (mode === "depth") {
          setShowPromptSelector(true);
          setPromptEditMode(mode);
          setDepthPromptType("init");
          const systemTemplate = templates.system?.find(
            (t: any) => t.code === "auto_graph_init",
          );
          const userTemplate = templates.user?.find(
            (t: any) => t.code === "auto_graph_init",
          );
          const effectiveTemplate = userTemplate || systemTemplate;
          setPromptContent(effectiveTemplate?.template_content || "");
        } else {
          setShowPromptSelector(false);
          const systemTemplate = templates.system?.find(
            (t: any) => t.code === "infinite_graph_expansion",
          );
          const userTemplate = templates.user?.find(
            (t: any) => t.code === "infinite_graph_expansion",
          );
          const effectiveTemplate = userTemplate || systemTemplate;
          setPromptContent(effectiveTemplate?.template_content || "");
          setPromptEditMode(mode);
        }
        setIsPromptEditorOpen(true);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "获取提示词失败";
        addMessage({ type: "error", content: message });
      }
    },
    [addMessage],
  );

  const handleSwitchDepthPrompt = useCallback(
    async (type: "init" | "expand") => {
      try {
        const templates = await api.prompts.list();
        const templateCode =
          type === "init" ? "auto_graph_init" : "auto_graph_expand";
        const systemTemplate = templates.system?.find(
          (t: any) => t.code === templateCode,
        );
        const userTemplate = templates.user?.find(
          (t: any) => t.code === templateCode,
        );
        const effectiveTemplate = userTemplate || systemTemplate;
        setPromptContent(effectiveTemplate?.template_content || "");
        setDepthPromptType(type);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "获取提示词失败";
        addMessage({ type: "error", content: message });
      }
    },
    [addMessage],
  );

  const handleSavePrompt = useCallback(
    async (content: string) => {
      try {
        let templateCode: string;
        if (promptEditMode === "depth") {
          templateCode =
            depthPromptType === "init"
              ? "auto_graph_init"
              : "auto_graph_expand";
        } else {
          templateCode = "infinite_graph_expansion";
        }
        await api.prompts.save({
          code: templateCode,
          scope: "user",
          template_content: content,
        });
        addMessage({ type: "success", content: "提示词已保存" });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "保存提示词失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [promptEditMode, depthPromptType, addMessage],
  );

  const handleNodeSelectorConfirm = useCallback((nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
    setIsNodeSelectorOpen(false);
    setIsGenerateCardsModalOpen(true);
  }, []);

  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [intelligentSuggestions, setIntelligentSuggestions] =
    useState<any>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [createdRelationIds, setCreatedRelationIds] = useState<Set<string>>(
    new Set(),
  );

  const handleDiscoverRelations = useCallback(
    async (opts?: { graph_ids?: string[]; max_suggestions?: number }) => {
      setIsDiscovering(true);
      try {
        const result = await api.graphs.discoverRelations(opts);
        setDiscoveryResult(result);
        setCreatedRelationIds(new Set());

        const suggestions = await api.graphs.getIntelligentSuggestions(
          opts?.graph_ids,
        );
        setIntelligentSuggestions(suggestions);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "关系发现失败";
        addMessage({ type: "error", content: message });
      } finally {
        setIsDiscovering(false);
      }
    },
    [addMessage],
  );

  const handleCreateDiscoveredRelation = useCallback(
    async (relation: DiscoveredRelation) => {
      try {
        await api.graphs.createDiscoveredRelation({
          source_graph_id: relation.source_graph_id,
          target_graph_id: relation.target_graph_id,
          relation_type: relation.relation_type,
          context: relation.reason,
          confidence: relation.confidence,
          shared_concepts: relation.shared_concepts,
        });
        const key = `${relation.source_graph_id}-${relation.target_graph_id}-${relation.relation_type}`;
        setCreatedRelationIds((prev) => new Set(prev).add(key));
        addMessage({ type: "success", content: "关系创建成功" });
        queryClient.invalidateQueries({ queryKey: ["graphMap"] });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "创建关系失败";
        addMessage({ type: "error", content: message });
        throw error;
      }
    },
    [addMessage, queryClient],
  );

  const handleGenerateCards = useCallback(
    async (config: { count: number; types: string[] }) => {
      if (selectedNodeIds.length === 0) return;

      try {
        const result = await api.ai.batchGenerateCards(selectedNodeIds, {
          count: config.count,
          types: config.types,
        });

        if (result.success) {
          addMessage({
            type: "success",
            content: "题目自动生成任务已提交至后台",
            duration: 5000,
            action: {
              label: "查看任务",
              onClick: () => navigate("/tasks"),
            },
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "题目生成失败";
        addMessage({ type: "error", content: message });
      }
    },
    [selectedNodeIds, addMessage, navigate],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedGraphId(null);
        setMultiSelectedGraphIds(new Set());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
      <GraphMapToolbar
        onBack={() => navigate("/dashboard")}
        onRefresh={() => refetch()}
        onCreateRelation={() => setIsCreatePanelOpen(true)}
        onCreateGraph={() => {
          setCreateGraphRelationType(undefined);
          setIsCreateGraphPanelOpen(true);
        }}
        onIntelligentAnalyze={() => setIsModularAnalysisOpen(true)}
        onAgentAnalysis={() => setIsAgentAnalysisOpen(true)}
        onCustomAnalysis={() => {
          setAnalysisMode('custom');
          setIsAgentAnalysisOpen(true);
        }}
        onDomainGenerate={() => setIsDomainGeneratorOpen(true)}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        graphCount={graphs.length}
        relationCount={relations.length}
        isLoading={isLoading}
        fromGraphId={fromGraphId}
        fromGraphTitle={fromGraph?.title}
        onReturnToGraph={() => navigate(`/graph/${fromGraphId}`)}
        analysisMode={analysisMode}
        onAnalysisModeChange={setAnalysisMode}
        domains={domainTree || []}
        selectedDomainIds={selectedDomainIds}
        onDomainSelectionChange={handleDomainSelectionChange}
        onManageDomains={() => setShowDomainManager(true)}
      />

      <div className="flex-1 relative">
        <Suspense fallback={<LoadingFallback />}>
          <GraphMapCanvas
            graphs={graphs}
            relations={relations}
            selectedGraphId={selectedGraphId}
            onGraphClick={handleGraphClick}
            filterMode={filterMode}
            fromGraphId={fromGraphId}
            fromGraphTitle={fromGraph?.title}
            onReturnToGraph={() => navigate(`/graph/${fromGraphId}`)}
            multiSelectedGraphIds={multiSelectedGraphIds}
            onMultiSelectGraph={handleMultiSelectGraph}
            onBoxSelection={handleBoxSelection}
            selectedDomainIds={selectedDomainIds}
            domainColorMap={domainColorMap}
            graphDomainMap={graphDomainMap}
          />
        </Suspense>

        {multiSelectedGraphIds.size === 2 && (
          <div className="absolute top-4 left-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-5 max-w-sm border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                联立视图模式
              </h3>
            </div>
            <div className="space-y-2 mb-4">
              {Array.from(multiSelectedGraphIds).map((id, index) => {
                const graph = graphs.find((g: Graph) => g.id === id);
                return graph ? (
                  <div
                    key={id}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? "bg-blue-500" : "bg-green-500"}`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                      {graph.title}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
            <button
              onClick={handleCombinedOpen}
              className="w-full px-4 py-2.5 text-sm bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-lg hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 transition-all font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              联立打开
            </button>
            <button
              onClick={() => setMultiSelectedGraphIds(new Set())}
              className="w-full mt-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-1"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              取消选择
            </button>
          </div>
        )}

        {selectedGraphId && multiSelectedGraphIds.size === 0 && (
          <>
            {isMobile ? (
              <div
                className={`fixed left-0 right-0 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out z-40 ${
                  isMobilePanelExpanded
                    ? "bottom-0 max-h-[80vh]"
                    : "bottom-0 max-h-[180px]"
                }`}
                style={{
                  paddingBottom: "env(safe-area-inset-bottom, 16px)",
                }}
              >
                <div
                  className="flex justify-center pt-2 pb-1 cursor-pointer"
                  onClick={() => setIsMobilePanelExpanded(!isMobilePanelExpanded)}
                >
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>
                {(() => {
                  const graph = graphs.find((g: Graph) => g.id === selectedGraphId);
                  if (!graph) return null;

                  const graphRelations = relations.filter(
                    (r: GraphRelation) =>
                      r.source_graph_id === selectedGraphId ||
                      r.target_graph_id === selectedGraphId,
                  );

                  return (
                    <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: isMobilePanelExpanded ? "calc(80vh - 40px)" : "140px" }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {graph.title}
                          </h3>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {(graph as any).node_count || 0} 个节点 · {graphRelations.length} 个关系
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedGraphId(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {graph.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                          {graph.description}
                        </p>
                      )}

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => navigate(`/graph/${graph.id}`)}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg active:bg-blue-600 transition-colors"
                        >
                          打开图谱
                        </button>
                        <button
                          onClick={() => setIsCreatePanelOpen(true)}
                          className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg active:bg-gray-200 dark:active:bg-slate-600 transition-colors"
                        >
                          添加关系
                        </button>
                      </div>

                      <button
                        onClick={() => selectRelatedGraphs(selectedGraphId)}
                        className="w-full mb-3 px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg active:bg-purple-200 dark:active:bg-purple-900/50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        选择关联图谱
                      </button>

                      {isMobilePanelExpanded && (
                        <>
                          <div className="mb-3">
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              快速创建关联图谱
                            </h4>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCreateRelatedGraph("prerequisite")}
                                className="flex-1 px-2 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg active:bg-blue-100 dark:active:bg-blue-900/50 transition-colors"
                              >
                                + 前置知识
                              </button>
                              <button
                                onClick={() => handleCreateRelatedGraph("extension")}
                                className="flex-1 px-2 py-2 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg active:bg-green-100 dark:active:bg-green-900/50 transition-colors"
                              >
                                + 扩展知识
                              </button>
                              <button
                                onClick={() => handleCreateRelatedGraph("related")}
                                className="flex-1 px-2 py-2 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg active:bg-amber-100 dark:active:bg-amber-900/50 transition-colors"
                              >
                                + 相关知识
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => setIsAIExpansionOpen(true)}
                              className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg flex items-center justify-center gap-2"
                            >
                              <Sparkles className="w-4 h-4" />
                              AI 拓展
                            </button>
                            <button
                              onClick={() => setIsNodeSelectorOpen(true)}
                              className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg flex items-center justify-center gap-2"
                            >
                              <BookOpen className="w-4 h-4" />
                              生成题目
                            </button>
                          </div>

                          {graphRelations.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                相关图谱
                              </h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {graphRelations.slice(0, 5).map((relation: GraphRelation) => {
                                  const isSource = relation.source_graph_id === selectedGraphId;
                                  const otherGraphId = isSource
                                    ? relation.target_graph_id
                                    : relation.source_graph_id;
                                  const otherGraph = graphs.find((g: Graph) => g.id === otherGraphId);

                                  if (!otherGraph) return null;

                                  const relationColor = {
                                    prerequisite: "bg-blue-500",
                                    extension: "bg-green-500",
                                    related: "bg-amber-500",
                                    cross_domain: "bg-purple-500",
                                  }[relation.relation_type];

                                  return (
                                    <div
                                      key={relation.id}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-2 h-2 rounded-full ${relationColor}`} />
                                        <span className="text-gray-700 dark:text-gray-300 truncate">
                                          {otherGraph.title}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteRelation(relation.id)}
                                        className="text-gray-400 hover:text-red-500 ml-2"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => setIsMobilePanelExpanded(!isMobilePanelExpanded)}
                        className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-2 py-1"
                      >
                        {isMobilePanelExpanded ? (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            收起
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            展开更多
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="absolute top-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 max-w-xs">
                {(() => {
                  const graph = graphs.find((g: Graph) => g.id === selectedGraphId);
                  if (!graph) return null;

                  const graphRelations = relations.filter(
                    (r: GraphRelation) =>
                      r.source_graph_id === selectedGraphId ||
                      r.target_graph_id === selectedGraphId,
                  );

                  return (
                    <>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {graph.title}
                      </h3>
                      {graph.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {graph.description}
                        </p>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {(graph as any).node_count || 0} 个节点 ·{" "}
                        {graphRelations.length} 个关系
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/graph/${graph.id}`)}
                          className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          打开图谱
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatePanelOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          添加关系
                        </button>
                      </div>

                      <button
                        onClick={() => selectRelatedGraphs(selectedGraphId)}
                        className="w-full mt-2 px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        选择关联图谱
                      </button>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          快速创建关联图谱
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateRelatedGraph("prerequisite")}
                            className="flex-1 px-2 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            + 前置知识
                          </button>
                          <button
                            onClick={() => handleCreateRelatedGraph("extension")}
                            className="flex-1 px-2 py-1.5 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          >
                            + 扩展知识
                          </button>
                          <button
                            onClick={() => handleCreateRelatedGraph("related")}
                            className="flex-1 px-2 py-1.5 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                          >
                            + 相关知识
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setIsAIExpansionOpen(true)}
                          className="w-full px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          AI 智能拓展
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                          生成知识点或相关知识网络
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setIsNodeSelectorOpen(true)}
                          className="w-full px-3 py-2 text-sm bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 transition-all flex items-center justify-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          生成题目
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                          为该图谱知识点生成学习题目
                        </p>
                      </div>

                      {graphRelations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            相关图谱
                          </h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {graphRelations
                              .slice(0, 5)
                              .map((relation: GraphRelation) => {
                                const isSource =
                                  relation.source_graph_id === selectedGraphId;
                                const otherGraphId = isSource
                                  ? relation.target_graph_id
                                  : relation.source_graph_id;
                                const otherGraph = graphs.find(
                                  (g: Graph) => g.id === otherGraphId,
                                );

                                if (!otherGraph) return null;

                                const relationColor = {
                                  prerequisite: "bg-blue-500",
                                  extension: "bg-green-500",
                                  related: "bg-amber-500",
                                  cross_domain: "bg-purple-500",
                                }[relation.relation_type];

                                return (
                                  <div
                                    key={relation.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div
                                        className={`w-2 h-2 rounded-full ${relationColor}`}
                                      />
                                      <span className="text-gray-700 dark:text-gray-300 truncate">
                                        {otherGraph.title}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleDeleteRelation(relation.id)
                                      }
                                      className="text-gray-400 hover:text-red-500 ml-2"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}

        <div className="hidden md:block absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            关系类型图例
          </h4>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                前置知识
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                扩展知识
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                相关知识
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                跨学科
              </span>
            </div>
          </div>
        </div>
      </div>

      <CreateRelationPanel
        graphs={graphs}
        isOpen={isCreatePanelOpen}
        onClose={() => setIsCreatePanelOpen(false)}
        onSubmit={handleCreateRelation}
        initialSourceId={selectedGraphId || undefined}
      />

      <QuickCreateGraphPanel
        isOpen={isCreateGraphPanelOpen}
        onClose={() => setIsCreateGraphPanelOpen(false)}
        onSubmit={handleQuickCreateGraph}
        relatedGraphId={selectedGraphId || undefined}
        relatedGraphTitle={
          graphs.find((g: Graph) => g.id === selectedGraphId)?.title
        }
        defaultRelationType={createGraphRelationType}
      />

      <Suspense fallback={<LoadingFallback />}>
        <AIExpansionPanel
          isOpen={isAIExpansionOpen}
          onClose={() => setIsAIExpansionOpen(false)}
          sourceGraphId={selectedGraphId || ""}
          sourceGraphTitle={
            graphs.find((g: Graph) => g.id === selectedGraphId)?.title || ""
          }
          sourceGraphDescription={
            graphs.find((g: Graph) => g.id === selectedGraphId)?.description
          }
          onDepthExpand={handleDepthExpand}
          onDepthExpandNode={handleDepthExpandNode}
          onWidthExpand={handleInfiniteExpand}
          progress={expansionProgress}
          isRunning={isExpansionRunning}
          onEditPrompt={handleOpenPromptEditor}
          hasNodes={
            (graphs.find((g: Graph) => g.id === selectedGraphId) as any)
              ?.node_count > 0
          }
        />
      </Suspense>

      {isPromptEditorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 h-[70vh] overflow-hidden flex flex-col">
            {showPromptSelector && promptEditMode === "depth" && (
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleSwitchDepthPrompt("init")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    depthPromptType === "init"
                      ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-900/20"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  图谱初始化 (auto_graph_init)
                </button>
                <button
                  onClick={() => handleSwitchDepthPrompt("expand")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    depthPromptType === "expand"
                      ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-900/20"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  节点展开 (auto_graph_expand)
                </button>
              </div>
            )}
            <Suspense fallback={<LoadingFallback />}>
              <PromptEditor
                key={`${promptEditMode}-${depthPromptType}`}
                initialContent={promptContent}
                variables={
                  promptEditMode === "depth"
                    ? depthPromptType === "init"
                      ? [
                          "topic",
                          "isCustom",
                          "customPrompt",
                          "isAcademic",
                          "isPractical",
                          "isBeginner",
                          "hasSources",
                          "sources",
                        ]
                      : [
                          "nodeTitle",
                          "nodeContent",
                          "nodeLevel",
                          "isCustom",
                          "customPrompt",
                          "isAcademic",
                          "isPractical",
                          "isBeginner",
                          "existingChildren",
                        ]
                    : ["domainTitle", "domainDescription", "maxGraphsPerLevel"]
                }
                onSave={handleSavePrompt}
                onCancel={() => setIsPromptEditorOpen(false)}
                title={
                  promptEditMode === "depth"
                    ? depthPromptType === "init"
                      ? "编辑图谱初始化提示词"
                      : "编辑节点展开提示词"
                    : "编辑宽度拓展提示词"
                }
              />
            </Suspense>
          </div>
        </div>
      )}

      <Suspense fallback={<LoadingFallback />}>
        <DomainGraphGenerator
          isOpen={isDomainGeneratorOpen}
          onClose={() => setIsDomainGeneratorOpen(false)}
          onGenerateDomain={async (domain: string, count: number) => {
            const result = await api.graphs.analyzeDomain(domain, count);
            return {
              graphs: result.recommendations,
              relations: result.relations,
            };
          }}
          onBatchCreate={async (graphs, relations, domain?: string) => {
            const result = await api.graphs.batchCreateDomainGraphs({
              graphs: graphs.map((g) => ({
                title: g.title,
                description: g.description,
              })),
              relations: relations,
              domain: domain,
            });
            queryClient.invalidateQueries({ queryKey: ["graphMap"] });
            queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
            addMessage({
              type: "success",
              content: `成功创建 ${result.created.length} 个图谱`,
            });
            return result.created;
          }}
          onInitializeGraphs={async (graphIds: string[]) => {
            const result = await api.graphs.batchInitializeGraphs({
              graph_ids: graphIds,
              style: "academic",
            });
            addMessage({
              type: "success",
              content: `已提交 ${result.summary.pending} 个图谱的初始化任务，请在任务列表中查看进度`,
            });
          }}
          onLoadSourceGraphs={async () => {
            const result = await api.graphs.getMap();
            return { graphs: result.graphs };
          }}
          onLoadDomains={async () => {
            const result = await api.graphs.getDomains();
            return { domains: result.domains };
          }}
          onExpandDomain={async (graphIds: string[], count: number, domain?: string) => {
            const result = await api.graphs.expandDomain(graphIds, count, domain);
            return {
              recommendations: result.recommendations,
              relations: result.relations,
            };
          }}
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <NodeSelectorModal
          isOpen={isNodeSelectorOpen}
          onClose={() => setIsNodeSelectorOpen(false)}
          onConfirm={handleNodeSelectorConfirm}
          graphId={selectedGraphId || ""}
          graphTitle={
            graphs.find((g: Graph) => g.id === selectedGraphId)?.title || ""
          }
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <GenerateCardsModal
          isOpen={isGenerateCardsModalOpen}
          onClose={() => setIsGenerateCardsModalOpen(false)}
          onGenerate={handleGenerateCards}
          nodeTitle={`${selectedNodeIds.length} 个知识点`}
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <GraphRelationDiscoveryPanel
          isOpen={isDiscoveryPanelOpen}
          onClose={() => setIsDiscoveryPanelOpen(false)}
          discoveryResult={discoveryResult}
          intelligentSuggestions={intelligentSuggestions}
          isLoading={isDiscovering}
          onDiscover={handleDiscoverRelations}
          onCreateRelation={handleCreateDiscoveredRelation}
          onGraphClick={(graphId) => {
            setSelectedGraphId(graphId);
            setIsDiscoveryPanelOpen(false);
          }}
          createdRelationIds={createdRelationIds}
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <ModularAnalysisPanel
          isOpen={isModularAnalysisOpen}
          onClose={() => {
            setIsModularAnalysisOpen(false);
            resetModules();
          }}
          modules={modules}
          onToggleModule={toggleModule}
          onExecuteModules={(selectedIds) => {
            executeModules(selectedIds, { graph_ids: selectedGraphId ? [selectedGraphId] : undefined });
          }}
          onViewResult={(moduleId) => {
            const module = modules.find(m => m.id === moduleId);
            if (module) {
              setViewingModule(module);
            }
          }}
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <AnalysisResultViewer
          isOpen={viewingModule !== null}
          onClose={() => setViewingModule(null)}
          module={viewingModule}
          onGraphClick={(graphId) => {
            setSelectedGraphId(graphId);
            setViewingModule(null);
          }}
          onCreateRelation={async (sourceId, targetId, relationType) => {
            await handleCreateRelation({
              source_graph_id: sourceId,
              target_graph_id: targetId,
              relation_type: relationType as GraphRelationType,
            });
          }}
          onCreateGraph={async (title, domain) => {
            await handleQuickCreateGraph({
              title,
              description: domain ? `领域：${domain}` : undefined,
            });
          }}
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <BatchOperationPanel
          selectedCount={multiSelectedGraphIds.size}
          onBatchCreateRelation={handleBatchCreateRelation}
          onBatchAnalyze={handleBatchAnalyze}
          onBatchDelete={handleBatchDelete}
          onBatchSetDomain={() => setIsBatchDomainPickerOpen(true)}
          onClearSelection={clearMultiSelection}
        />
      </Suspense>

      <Suspense fallback={<LoadingFallback />}>
        <AgentAnalysisPanel
          isOpen={isAgentAnalysisOpen}
          onClose={() => setIsAgentAnalysisOpen(false)}
          selectedGraphIds={Array.from(multiSelectedGraphIds)}
          graphTitles={Array.from(multiSelectedGraphIds).map(
            (id) => graphs.find((g: Graph) => g.id === id)?.title || ""
          )}
          analysisMode={analysisMode}
          onGraphsMerged={() => {
            queryClient.invalidateQueries({ queryKey: ["graphMap"] });
          }}
        />
      </Suspense>

      {isBatchDomainPickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-4">
            <h3 className="text-base font-semibold mb-3 text-gray-900 dark:text-white">
              批量设置领域
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              为选中的 {multiSelectedGraphIds.size} 个图谱设置领域
            </p>
            {isBatchSettingDomain ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : (
              <>
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {domainTree.map((domain: DomainTreeNode) => (
                    <button
                      key={domain.id}
                      onClick={() => handleBatchSetDomain(domain.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: domain.color }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {domain.name}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    onClick={() => setIsBatchDomainPickerOpen(false)}
                    className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>

    <DomainManager
      isOpen={showDomainManager}
      onClose={() => setShowDomainManager(false)}
    />
    </>
  );
};

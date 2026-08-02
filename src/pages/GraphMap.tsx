import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef, useId } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, BookOpen, X, ChevronUp, ChevronDown, Layers, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../services/api";
import { useStore } from "../store/useStore";
import { queryKeys } from "../hooks/queries/config";
import { useIsMobile } from "../hooks/common/useIsMobile";
import { ErrorBoundary, Skeleton, LazyLoadFallback } from "../components/common";
import { GraphMapToolbar } from "../components/GraphMap/GraphMapToolbar";
import { domainsApi, graphDomainsApi } from "../services/api/domains";
import type { DomainTreeNode, Domain } from "@shared/types/graph";
import { CreateRelationPanel } from "../components/GraphMap/CreateRelationPanel";
import { QuickCreateGraphPanel } from "../components/GraphMap/QuickCreateGraphPanel";
import { DomainManager } from "../components/GraphMap/DomainManager";
import { CrossDomainInsightsSection } from "../components/GraphMap/CrossDomainInsightsSection";
import type { CrossDomainAnalysisResult, AnalysisModuleState } from "../components/GraphMap/types";
import { useAnalysisModules } from "../hooks/graphAI/useAnalysisModules";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { message } from "../utils/messageHelper";
import type {
  Graph,
  GraphRelation,
  GraphMapFilterMode,
  GraphRelationType,
  QuickCreateGraphRequest,
  InfiniteExpansionProgress,
  DiscoveredRelation,
  AnalysisMode,
  DiscoveryResult,
  IntelligentSuggestion,
} from "../types";

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

interface CoreNode {
  title: string;
  content?: string;
  level?: string;
  backboneModule?: string;
  needsRefinement?: boolean;
  color?: string;
  id?: string;
}

interface ChildNode {
  title: string;
  content?: string;
  level?: string;
}

interface PromptTemplate {
  code: string;
  template_content?: string;
  [key: string]: unknown;
}

interface PromptListResult {
  system?: PromptTemplate[];
  user?: PromptTemplate[];
}

interface SingleGraphDomainPickerProps {
  graphId: string;
  domainTree: DomainTreeNode[];
  currentDomains: Array<{ id: string; name: string; color: string }>;
  isSetting: boolean;
  onConfirm: (domainIds: string[]) => void;
  onClose: () => void;
}

const SingleGraphDomainPicker: React.FC<SingleGraphDomainPickerProps> = ({
  domainTree,
  currentDomains,
  isSetting,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const domainPickerTitleId = useId();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(currentDomains.map((d) => d.id)),
  );

  const allDomainList = useMemo(() => {
    const list: DomainTreeNode[] = [];
    function flatten(nodes: DomainTreeNode[]) {
      nodes.forEach((node) => {
        list.push(node);
        if (node.children?.length) flatten(node.children);
      });
    }
    flatten(domainTree);
    return list;
  }, [domainTree]);

  const toggleDomain = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={domainPickerTitleId}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id={domainPickerTitleId} className="text-base font-semibold text-gray-900 dark:text-white">
            {t('graphMap.domainPicker.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors min-h-[24px] min-w-[24px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSetting ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                <Skeleton variant="circular" width={12} height={12} />
                <Skeleton variant="rectangular" className="flex-1 h-5" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {allDomainList.map((domain) => {
                const isSelected = selectedIds.has(domain.id);
                return (
                  <button
                    key={domain.id}
                    onClick={() => toggleDomain(domain.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-800'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${isSelected ? 'ring-2 ring-offset-1 ring-primary-400 dark:ring-offset-slate-800' : ''}`}
                      style={{ backgroundColor: domain.color }}
                    />
                    <span className={`text-sm flex-1 ${isSelected ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {domain.name}
                    </span>
                    {isSelected && (
                      <svg aria-hidden="true" className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
              {allDomainList.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t('graphMap.domainPicker.noDomains')}</p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => onConfirm(Array.from(selectedIds))}
                disabled={isSetting}
                className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {t('common.confirmButton')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const GraphMap = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useStore();
  const { isMobile } = useIsMobile();
  const promptEditorTitleId = useId();
  const batchDomainPickerTitleId = useId();
  const crossDomainTitleId = useId();

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
  const [expansionSessionId, setExpansionSessionId] = useState<string | null>(null);
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
  const [domainBatchSessionId, setDomainBatchSessionId] = useState<string | null>(null);
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
  const [singleGraphDomainPicker, setSingleGraphDomainPicker] = useState<{ graphId: string; open: boolean }>({ graphId: '', open: false });
  const [isSettingSingleGraphDomain, setIsSettingSingleGraphDomain] = useState(false);
  const [crossDomainResult, setCrossDomainResult] = useState<CrossDomainAnalysisResult | null>(null);
  const [isAnalyzingCrossDomain, setIsAnalyzingCrossDomain] = useState(false);
  const [showCrossDomainInsights, setShowCrossDomainInsights] = useState(false);

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
    error,
    refetch: refetchMap,
  } = useQuery({
    queryKey: queryKeys.graphMap(),
    queryFn: () => api.graphs.getMap(),
  });

  const {
    data: domainTreeRaw,
    error: domainTreeError,
    refetch: refetchDomainTree,
  } = useQuery({
    queryKey: queryKeys.domainTree(),
    queryFn: () => domainsApi.getTree(),
    staleTime: 5 * 60 * 1000,
  });

  const domainTree = useMemo(() => {
    if (!domainTreeRaw) return [];
    if (Array.isArray(domainTreeRaw)) return domainTreeRaw;
    // 兼容后端可能返回 { domains: DomainTreeNode[] } 包装格式
    const wrapped = domainTreeRaw as unknown as { domains?: DomainTreeNode[] };
    if (wrapped.domains && Array.isArray(wrapped.domains)) {
      return wrapped.domains;
    }
    return [];
  }, [domainTreeRaw]);

  const hasCheckedUncategorized = useRef(false);

  useEffect(() => {
    if (hasCheckedUncategorized.current) return;
    if (domainTree && !domainTree.some((d: DomainTreeNode) => d.name === '未分类')) {
      hasCheckedUncategorized.current = true;
      domainsApi.ensureUncategorized().catch((err) => { console.error(err); });
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
      const domainIds = graph.domainIds || [];
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

    const confirmMessage = t('graphMap.batch.deleteConfirm', { count: ids.length });
    if (!await asyncConfirm({
      title: t('graphMap.batch.confirmDeleteTitle'),
      message: confirmMessage,
      isDangerous: true,
    })) return;

    try {
      for (const id of ids) {
        await api.graphs.delete(id);
      }
      message.success(t('graphMap.batch.deleteSuccess', { count: ids.length }));
      setMultiSelectedGraphIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('graphMap.batch.deleteFailed');
      message.error(errMsg);
    }
  }, [multiSelectedGraphIds, queryClient, t]);

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
        message.success(t('graphMap.batch.setDomainSuccess', { count: successCount }));
      } else if (successCount > 0) {
        message.warning(t('graphMap.batch.setDomainPartial', { success: successCount, fail: failCount }));
      } else {
        message.error(t('graphMap.batch.setDomainFailed'));
      }

      setMultiSelectedGraphIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      setIsBatchDomainPickerOpen(false);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('graphMap.batch.setDomainFailed');
      message.error(errMsg);
    } finally {
      setIsBatchSettingDomain(false);
    }
  }, [multiSelectedGraphIds, queryClient, t]);

  const handleSetSingleGraphDomains = useCallback(async (domainIds: string[]) => {
    const graphId = singleGraphDomainPicker.graphId;
    if (!graphId) return;

    setIsSettingSingleGraphDomain(true);
    try {
      await graphDomainsApi.updateByGraphId(
        graphId,
        domainIds.map((id) => ({ domain_id: id })),
      );
      message.success(t('graphMap.domainPicker.setSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      setSingleGraphDomainPicker({ graphId: '', open: false });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('graphMap.domainPicker.setFailed');
      message.error(errMsg);
    } finally {
      setIsSettingSingleGraphDomain(false);
    }
  }, [singleGraphDomainPicker.graphId, queryClient, t]);

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
        message.success(t('graphMap.relation.createSuccess'));
        queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.relation.createFailed');
        message.error(errMsg);
        throw error;
      }
    },
    [queryClient, t],
  );

  const handleDeleteRelation = useCallback(
    async (relationId: string) => {
      try {
        await api.graphs.deleteRelationById(relationId);
        message.success(t('graphMap.relation.deleteSuccess'));
        queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.relation.deleteFailed');
        message.error(errMsg);
      }
    },
    [queryClient, t],
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

        message.success(t('graphMap.graphCreation.success'));
        queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });

        if (data.auto_generate_content) {
          message.info(t('graphMap.graphCreation.generatingContent'));
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.graphCreation.failed');
        message.error(errMsg);
        throw error;
      }
    },
    [queryClient, t],
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
        message.success(t('graphMap.expansion.started'));
        setIsExpansionRunning(true);
        setExpansionProgress({
          status: "running",
          current_depth: 0,
          total_graphs_created: 0,
          total_nodes_created: 0,
          created_graphs: [],
          errors: [],
        });

        queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.expansion.startFailed');
        message.error(errMsg);
        throw error;
      }
    },
    [selectedGraphId, queryClient, expansionSessionId, t],
  );

  const handleDepthExpand = useCallback(
    async (config: {
      style: "academic" | "practical" | "beginner" | "custom";
      customPrompt?: string;
      sources?: string[];
      depth: number;
    }): Promise<{ root: { title: string; content: string }; coreNodes: CoreNode[] } | null> => {
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

        setExpansionSessionId(result.sessionId);

        if (result.root && result.coreNodes) {
          const nodes = [
            {
              title: result.root.title,
              content: result.root.content,
              level: "root",
            },
            ...result.coreNodes.map((n: CoreNode) => ({
              title: n.title,
              content: n.content,
              level: n.level || "core",
              backboneModule: n.backboneModule,
              needsRefinement: n.needsRefinement,
              color: n.color,
            })),
          ];

          const saveResult = await api.autoGraph.saveNodes({
            graph_id: selectedGraphId,
            nodes,
          }) as { nodeMapping?: Record<string, { graphNodeId: string }> };

          queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });

          if (saveResult.nodeMapping) {
            const nodeMapping = saveResult.nodeMapping;
            const coreNodesWithIds = result.coreNodes.map(
              (n: CoreNode, index: number) => {
                const tempId = `temp-${index + 1}`;
                return {
                  ...n,
                  id: nodeMapping[tempId]?.graphNodeId,
                };
              },
            );
            return { root: result.root, coreNodes: coreNodesWithIds };
          }

          return { root: result.root, coreNodes: result.coreNodes };
        }
        return null;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.expansion.depthFailed');
        message.error(errMsg);
        throw error;
      }
    },
    [selectedGraphId, graphs, queryClient, t],
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
    }): Promise<ChildNode[] | null> => {
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
          session_id: expansionSessionId || undefined,
        });

        if (result.children && result.children.length > 0) {
          const nodes = result.children.map((n: ChildNode) => ({
            title: n.title,
            content: n.content,
            level: n.level || "sub",
            parentId: config.nodeId,
          }));

          await api.autoGraph.saveNodes({
            graph_id: selectedGraphId,
            nodes,
          });

          queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });

          return result.children;
        }
        return null;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.expansion.nodeExpandFailed');
        message.error(errMsg);
        throw error;
      }
    },
    [selectedGraphId, queryClient, expansionSessionId, t],
  );

  const handleOpenPromptEditor = useCallback(
    async (mode: "depth" | "width") => {
      try {
        const templates = await api.prompts.list() as PromptListResult;

        if (mode === "depth") {
          setShowPromptSelector(true);
          setPromptEditMode(mode);
          setDepthPromptType("init");
          const systemTemplate = templates.system?.find(
            (t) => t.code === "auto_graph_init",
          );
          const userTemplate = templates.user?.find(
            (t) => t.code === "auto_graph_init",
          );
          const effectiveTemplate = userTemplate || systemTemplate;
          setPromptContent(effectiveTemplate?.template_content || "");
        } else {
          setShowPromptSelector(false);
          const systemTemplate = templates.system?.find(
            (t) => t.code === "infinite_graph_expansion",
          );
          const userTemplate = templates.user?.find(
            (t) => t.code === "infinite_graph_expansion",
          );
          const effectiveTemplate = userTemplate || systemTemplate;
          setPromptContent(effectiveTemplate?.template_content || "");
          setPromptEditMode(mode);
        }
        setIsPromptEditorOpen(true);
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : t('graphMap.prompt.fetchFailed');
        message.error(errMsg);
      }
    },
    [t],
  );

  const handleSwitchDepthPrompt = useCallback(
    async (type: "init" | "expand") => {
      try {
        const templates = await api.prompts.list() as PromptListResult;
        const templateCode =
          type === "init" ? "auto_graph_init" : "auto_graph_expand";
        const systemTemplate = templates.system?.find(
          (t) => t.code === templateCode,
        );
        const userTemplate = templates.user?.find(
          (t) => t.code === templateCode,
        );
        const effectiveTemplate = userTemplate || systemTemplate;
        setPromptContent(effectiveTemplate?.template_content || "");
        setDepthPromptType(type);
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : t('graphMap.prompt.fetchFailed');
        message.error(errMsg);
      }
    },
    [t],
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
        message.success(t('graphMap.prompt.saveSuccess'));
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : t('graphMap.prompt.saveFailed');
        message.error(errMsg);
        throw error;
      }
    },
    [promptEditMode, depthPromptType, t],
  );

  const handleNodeSelectorConfirm = useCallback((nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
    setIsNodeSelectorOpen(false);
    setIsGenerateCardsModalOpen(true);
  }, []);

  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [intelligentSuggestions, setIntelligentSuggestions] =
    useState<IntelligentSuggestion | null>(null);
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
        const errMsg = error instanceof Error ? error.message : t('graphMap.relation.discoveryFailed');
        message.error(errMsg);
      } finally {
        setIsDiscovering(false);
      }
    },
    [t],
  );

  const handleCrossDomainAnalysis = useCallback(async () => {
    setIsAnalyzingCrossDomain(true);
    try {
      const result = await api.graphs.discoverRelations({
        include_cross_domain: true,
      });
      setCrossDomainResult(result as unknown as CrossDomainAnalysisResult);
      setShowCrossDomainInsights(true);
      message.success(t('graphMap.crossDomain.analyzeComplete'));
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : t('graphMap.crossDomain.analyzeFailed');
      message.error(errMsg);
    } finally {
      setIsAnalyzingCrossDomain(false);
    }
  }, [t]);

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
        message.success(t('graphMap.relation.createSuccess'));
        queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.relation.createFailed');
        message.error(errMsg);
        throw error;
      }
    },
    [queryClient, t],
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
          message.success(t('graphMap.cards.taskSubmitted'), {
            duration: 5000,
            action: {
              label: t('graphMap.cards.viewTasks'),
              onClick: () => navigate("/tasks"),
            },
          });
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : t('graphMap.cards.generateFailed');
        message.error(errMsg);
      }
    },
    [selectedNodeIds, navigate, t],
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

  if (error || domainTreeError) {return (
    <div className="p-8 flex flex-col items-center justify-center text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <p role="alert" className="text-red-600 dark:text-red-400 mb-4">{t('graphMap.loadError')}</p>
      <button
        type="button"
        onClick={() => { void refetchMap(); void refetchDomainTree(); }}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        {t('graphMap.retry')}
      </button>
    </div>
  );}

  return (
    <>
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
      <h1 className="sr-only">{t('graphMap.title')}</h1>
      <GraphMapToolbar
        onBack={() => navigate("/dashboard")}
        onRefresh={() => { void refetchMap(); }}
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
        <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
          <ErrorBoundary>
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
          </ErrorBoundary>
        </Suspense>

        {multiSelectedGraphIds.size === 2 && (
          <div className="absolute top-4 left-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-5 max-w-sm border border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-500 flex items-center justify-center">
                <svg aria-hidden="true"
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
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {t('graphMap.combinedView.title')}
              </h2>
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
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? "bg-primary-500" : "bg-green-500"}`}
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
              className="w-full px-4 py-2.5 text-sm bg-gradient-to-r from-primary-500 via-primary-500 to-pink-500 text-white rounded-lg hover:from-primary-600 hover:via-primary-600 hover:to-pink-600 transition-all font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg aria-hidden="true"
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
              {t('graphMap.combinedView.openCombined')}
            </button>
            <button
              onClick={() => setMultiSelectedGraphIds(new Set())}
              className="w-full mt-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-1"
            >
              <svg aria-hidden="true"
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
              {t('graphMap.combinedView.cancelSelection')}
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
                          <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                            {graph.title}
                          </h2>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('graphMap.graph.nodeCount', { count: graph.node_count || 0 })} · {t('graphMap.graph.relationCount', { count: graphRelations.length })}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedGraphId(null)}
                          aria-label={t('common.aria.close')}
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

                      {graph.domains && graph.domains.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {graph.domains.map((domain: Domain) => (
                            <span
                              key={domain.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${domain.color}20`,
                                color: domain.color,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: domain.color }}
                              />
                              {domain.name}
                            </span>
                          ))}
                          {user && graph.user_id === user.id && (
                            <button
                              onClick={() => setSingleGraphDomainPicker({ graphId: graph.id, open: true })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-dashed border-gray-300 dark:border-gray-600"
                            >
                              <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {t('graphMap.graph.setDomain')}
                            </button>
                          )}
                        </div>
                      )}
                      {user && graph.user_id === user.id && (!graph.domains || graph.domains.length === 0) && (
                        <button
                          onClick={() => setSingleGraphDomainPicker({ graphId: graph.id, open: true })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-dashed border-gray-300 dark:border-gray-600 mb-3"
                        >
                          <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {t('graphMap.graph.setDomain')}
                        </button>
                      )}

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => navigate(`/graph/${graph.id}`)}
                          className="flex-1 px-3 py-2 bg-primary-500 text-white text-sm rounded-lg active:bg-primary-600 transition-colors"
                        >
                          {t('graphMap.graph.openGraph')}
                        </button>
                        <button
                          onClick={() => setIsCreatePanelOpen(true)}
                          className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg active:bg-gray-200 dark:active:bg-slate-600 transition-colors"
                        >
                          {t('graphMap.graph.addRelation')}
                        </button>
                      </div>

                      <button
                        onClick={() => selectRelatedGraphs(selectedGraphId)}
                        className="w-full mb-3 px-3 py-2 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg active:bg-primary-200 dark:active:bg-primary-900/50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {t('graphMap.graph.selectRelated')}
                      </button>

                      {isMobilePanelExpanded && (
                        <>
                          <div className="mb-3">
                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              {t('graphMap.graph.quickCreate')}
                            </h4>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCreateRelatedGraph("prerequisite")}
                                className="flex-1 px-2 py-2 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg active:bg-primary-100 dark:active:bg-primary-900/50 transition-colors"
                              >
                                + {t('graphMap.graph.prerequisite')}
                              </button>
                              <button
                                onClick={() => handleCreateRelatedGraph("extension")}
                                className="flex-1 px-2 py-2 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg active:bg-green-100 dark:active:bg-green-900/50 transition-colors"
                              >
                                + {t('graphMap.graph.extension')}
                              </button>
                              <button
                                onClick={() => handleCreateRelatedGraph("related")}
                                className="flex-1 px-2 py-2 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg active:bg-amber-100 dark:active:bg-amber-900/50 transition-colors"
                              >
                                + {t('graphMap.graph.related')}
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => setIsAIExpansionOpen(true)}
                              className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-primary-500 to-pink-500 text-white rounded-lg flex items-center justify-center gap-2"
                            >
                              <Sparkles className="w-4 h-4" />
                              {t('graphMap.graph.aiExpand')}
                            </button>
                            <button
                              onClick={() => setIsNodeSelectorOpen(true)}
                              className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-lg flex items-center justify-center gap-2"
                            >
                              <BookOpen className="w-4 h-4" />
                              {t('graphMap.graph.generateQuestions')}
                            </button>
                          </div>

                          {graphRelations.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                {t('graphMap.graph.relatedGraphs')}
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
                                    prerequisite: "bg-primary-500",
                                    extension: "bg-green-500",
                                    related: "bg-amber-500",
                                    cross_domain: "bg-primary-500",
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
                            {t('graphMap.graph.collapse')}
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            {t('graphMap.graph.expandMore')}
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
                      <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {graph.title}
                      </h2>
                      {graph.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {graph.description}
                        </p>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {t('graphMap.graph.nodeCount', { count: graph.node_count || 0 })} ·{" "}
                        {t('graphMap.graph.relationCount', { count: graphRelations.length })}
                      </div>

                      {graph.domains && graph.domains.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {graph.domains.map((domain: Domain) => (
                            <span
                              key={domain.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${domain.color}20`,
                                color: domain.color,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: domain.color }}
                              />
                              {domain.name}
                            </span>
                          ))}
                          {user && graph.user_id === user.id && (
                            <button
                              onClick={() => setSingleGraphDomainPicker({ graphId: graph.id, open: true })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-dashed border-gray-300 dark:border-gray-600"
                            >
                              <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {t('graphMap.graph.setDomain')}
                            </button>
                          )}
                        </div>
                      )}
                      {user && graph.user_id === user.id && (!graph.domains || graph.domains.length === 0) && (
                        <div className="mb-3">
                          <button
                            onClick={() => setSingleGraphDomainPicker({ graphId: graph.id, open: true })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-dashed border-gray-300 dark:border-gray-600"
                          >
                            <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('graphMap.graph.setDomain')}
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/graph/${graph.id}`)}
                          className="flex-1 px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
                        >
                          {t('graphMap.graph.openGraph')}
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatePanelOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          {t('graphMap.graph.addRelation')}
                        </button>
                      </div>

                      <button
                        onClick={() => selectRelatedGraphs(selectedGraphId)}
                        className="w-full mt-2 px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {t('graphMap.graph.selectRelated')}
                      </button>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {t('graphMap.graph.quickCreate')}
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateRelatedGraph("prerequisite")}
                            className="flex-1 px-2 py-1.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                          >
                            + {t('graphMap.graph.prerequisite')}
                          </button>
                          <button
                            onClick={() => handleCreateRelatedGraph("extension")}
                            className="flex-1 px-2 py-1.5 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          >
                            + {t('graphMap.graph.extension')}
                          </button>
                          <button
                            onClick={() => handleCreateRelatedGraph("related")}
                            className="flex-1 px-2 py-1.5 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                          >
                            + {t('graphMap.graph.related')}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setIsAIExpansionOpen(true)}
                          className="w-full px-3 py-2 text-sm bg-gradient-to-r from-primary-500 to-pink-500 text-white rounded-lg hover:from-primary-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          {t('graphMap.graph.aiSmartExpand')}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                          {t('graphMap.graph.aiExpandDesc')}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => setIsNodeSelectorOpen(true)}
                          className="w-full px-3 py-2 text-sm bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-lg hover:from-primary-600 hover:to-violet-600 transition-all flex items-center justify-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          {t('graphMap.graph.generateQuestions')}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                          {t('graphMap.graph.generateQuestionsDesc')}
                        </p>
                      </div>

                      {graphRelations.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            {t('graphMap.graph.relatedGraphs')}
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
                                  prerequisite: "bg-primary-500",
                                  extension: "bg-green-500",
                                  related: "bg-amber-500",
                                  cross_domain: "bg-primary-500",
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
            {t('graphMap.legend.title')}
          </h4>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {t('graphMap.legend.prerequisite')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {t('graphMap.legend.extension')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {t('graphMap.legend.related')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {t('graphMap.legend.crossDomain')}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCrossDomainAnalysis}
          disabled={isAnalyzingCrossDomain}
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-full shadow-lg transition-all flex items-center gap-2 z-40 ${
            isAnalyzingCrossDomain
              ? 'bg-gradient-to-r from-primary-400 to-pink-400 cursor-wait'
              : 'bg-gradient-to-r from-primary-500 to-pink-500 hover:from-primary-600 hover:to-pink-600 hover:shadow-xl active:scale-95'
          }`}
        >
          {isAnalyzingCrossDomain ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span className="text-white font-medium">{t('graphMap.crossDomain.analyzing')}</span>
            </>
          ) : (
            <>
              <Layers className="w-5 h-5 text-white" />
              <span className="text-white font-medium">{t('graphMap.crossDomain.analyze')}</span>
            </>
          )}
        </button>
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
        domains={domainTree}
      />

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
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
            (graphs.find((g: Graph) => g.id === selectedGraphId)?.node_count ?? 0) > 0
          }
        />
      </Suspense>

      {isPromptEditorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={promptEditorTitleId}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 h-[70vh] overflow-hidden flex flex-col"
          >
            <h2 id={promptEditorTitleId} className="sr-only">
              {promptEditMode === "depth"
                ? depthPromptType === "init"
                  ? t('graphMap.prompt.editInitPrompt')
                  : t('graphMap.prompt.editExpandPrompt')
                : t('graphMap.prompt.editWidthPrompt')}
            </h2>
            {showPromptSelector && promptEditMode === "depth" && (
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleSwitchDepthPrompt("init")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    depthPromptType === "init"
                      ? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/20"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {t('graphMap.prompt.graphInit')}
                </button>
                <button
                  onClick={() => handleSwitchDepthPrompt("expand")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    depthPromptType === "expand"
                      ? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/20"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {t('graphMap.prompt.nodeExpand')}
                </button>
              </div>
            )}
            <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
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
                      ? t('graphMap.prompt.editInitPrompt')
                      : t('graphMap.prompt.editExpandPrompt')
                    : t('graphMap.prompt.editWidthPrompt')
                }
              />
            </Suspense>
          </div>
        </div>
      )}

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
        <DomainGraphGenerator
          isOpen={isDomainGeneratorOpen}
          onClose={() => {
            setIsDomainGeneratorOpen(false);
            setDomainBatchSessionId(null);
          }}
          onGenerateDomain={async (domain: string, count: number) => {
            const batchSessionId = crypto.randomUUID();
            setDomainBatchSessionId(batchSessionId);
            const result = await api.graphs.analyzeDomain(domain, count, batchSessionId);
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
              relations,
              domain,
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
            queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
            message.success(t('graphMap.graphCreation.batchCreateSuccess', { count: result.created.length, failed: result.failed?.length || 0 }));
            return result;
          }}
          onInitializeGraphs={async (graphIds: string[]) => {
            const result = await api.graphs.batchInitializeGraphs({
              graph_ids: graphIds,
              style: "academic",
              session_id: domainBatchSessionId || undefined,
            });
            message.success(t('graphMap.graphCreation.initTaskSubmitted', { count: result.summary.pending }));
          }}
          onLoadSourceGraphs={async () => {
            const result = await api.graphs.getMap();
            return { graphs: result.graphs };
          }}
          onLoadDomains={async () => {
            return await api.graphs.getDomains();
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

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
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

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
        <GenerateCardsModal
          isOpen={isGenerateCardsModalOpen}
          onClose={() => setIsGenerateCardsModalOpen(false)}
          onGenerate={handleGenerateCards}
          nodeTitle={t('graphMap.cards.knowledgePoints', { count: selectedNodeIds.length })}
        />
      </Suspense>

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
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

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
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
          graphId={selectedGraphId ?? undefined}
        />
      </Suspense>

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
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
              description: domain ? t('graphMap.domainLabel', { domain }) : undefined,
            });
          }}
        />
      </Suspense>

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
        <BatchOperationPanel
          selectedCount={multiSelectedGraphIds.size}
          onBatchCreateRelation={handleBatchCreateRelation}
          onBatchAnalyze={handleBatchAnalyze}
          onBatchDelete={handleBatchDelete}
          onBatchSetDomain={() => setIsBatchDomainPickerOpen(true)}
          onClearSelection={clearMultiSelection}
        />
      </Suspense>

      <Suspense fallback={<LazyLoadFallback variant="card" count={3} />}>
        <AgentAnalysisPanel
          isOpen={isAgentAnalysisOpen}
          onClose={() => setIsAgentAnalysisOpen(false)}
          selectedGraphIds={Array.from(multiSelectedGraphIds)}
          graphTitles={Array.from(multiSelectedGraphIds).map(
            (id) => graphs.find((g: Graph) => g.id === id)?.title || ""
          )}
          analysisMode={analysisMode}
          onGraphsMerged={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
          }}
        />
      </Suspense>

      {isBatchDomainPickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={batchDomainPickerTitleId}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-4"
          >
            <h2 id={batchDomainPickerTitleId} className="text-base font-semibold mb-3 text-gray-900 dark:text-white">
              {t('graphMap.domainPicker.batchTitle')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('graphMap.domainPicker.batchDesc', { count: multiSelectedGraphIds.size })}
            </p>
            {isBatchSettingDomain ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                    <Skeleton variant="circular" width={12} height={12} />
                    <Skeleton variant="rectangular" className="flex-1 h-5" />
                  </div>
                ))}
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
                    {t('common.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {singleGraphDomainPicker.open && (
        <SingleGraphDomainPicker
          graphId={singleGraphDomainPicker.graphId}
          domainTree={domainTree}
          currentDomains={graphs.find((g: Graph) => g.id === singleGraphDomainPicker.graphId)?.domains || []}
          isSetting={isSettingSingleGraphDomain}
          onConfirm={handleSetSingleGraphDomains}
          onClose={() => setSingleGraphDomainPicker({ graphId: '', open: false })}
        />
      )}
    </div>

    <DomainManager
      isOpen={showDomainManager}
      onClose={() => setShowDomainManager(false)}
    />

    {showCrossDomainInsights && crossDomainResult && (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCrossDomainInsights(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={crossDomainTitleId}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30">
              <h2 id={crossDomainTitleId} className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary-500" />
                {t('graphMap.crossDomain.title')}
              </h2>
              <button
                onClick={() => setShowCrossDomainInsights(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <Suspense fallback={
                <div className="space-y-4">
                  <Skeleton variant="rectangular" className="w-full h-32" />
                  <Skeleton variant="rectangular" className="w-full h-24" />
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} variant="rectangular" className="w-full h-16" />
                    ))}
                  </div>
                </div>
              }>
                <CrossDomainInsightsSection
                  result={crossDomainResult}
                  onGraphClick={(graphId) => {
                    setSelectedGraphId(graphId);
                    setShowCrossDomainInsights(false);
                  }}
                />
              </Suspense>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button
                onClick={handleCrossDomainAnalysis}
                disabled={isAnalyzingCrossDomain}
                className="px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyzingCrossDomain ? 'animate-spin' : ''}`} />
                {t('graphMap.crossDomain.reanalyze')}
              </button>
              <button
                onClick={() => setShowCrossDomainInsights(false)}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )}
    </>
  );
};

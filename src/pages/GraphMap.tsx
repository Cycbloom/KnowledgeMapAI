import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef, useId } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, BookOpen, X, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { api } from "../services/api";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { queryKeys } from "../hooks/queries/config";
import { useGraphData } from "../hooks/queries";
import { tasksApi } from "../services/api/tasks";
import { useAutoClassifyNotificationStore } from "../store/useAutoClassifyNotificationStore";
import { useAutoClassifyPanelStore } from "../store/useAutoClassifyPanelStore";
import { useIsMobile } from "../hooks/common/useIsMobile";
import { ErrorBoundary, Skeleton, Loading } from "../components/common";
import { GraphMapToolbar } from "../components/GraphMap/GraphMapToolbar";
import { GraphMapSkeleton } from "../components/GraphMap/GraphMapSkeleton";
import { domainsApi, graphDomainsApi } from "../services/api/domains";
import type { DomainTreeNode, Domain } from "@shared/types/graph";
import { CreateRelationPanel } from "../components/GraphMap/CreateRelationPanel";
import { DomainManager } from "../components/GraphMap/DomainManager";
import { useGraphStyleSettingsStore } from "../store/useGraphStyleSettingsStore";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { message } from "../utils/messageHelper";
import { getErrorMessage } from "../utils/errors";
import type {
  Graph,
  GraphRelation,
  GraphMapFilterMode,
  GraphRelationType,
  InfiniteExpansionProgress,
  DiscoveredRelation,
  DiscoveryResult,
  IntelligentSuggestion,
} from "../types";

const GraphMapCanvas = lazy(() =>
  import("../components/GraphMap/GraphMapCanvas").then((module) => ({
    default: module.GraphMapCanvas,
  }))
);

const GraphStyleSettings = lazy(() =>
  import("../components/GraphEditor/shared/GraphStyleSettings").then((module) => ({
    default: module.GraphStyleSettings,
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

const AutoClassifyDomainPanel = lazy(() =>
  import("../components/GraphMap/AutoClassifyDomainPanel").then((module) => ({
    default: module.AutoClassifyDomainPanel,
  }))
);

const BatchOperationPanel = lazy(() =>
  import("../components/GraphMap/BatchOperationPanel").then((module) => ({
    default: module.BatchOperationPanel,
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



export const GraphMap = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { isMobile } = useIsMobile();
  const promptEditorTitleId = useId();
  const batchDomainPickerTitleId = useId();

  const fromGraphId = searchParams.get("from");

  const [filterMode, setFilterMode] = useState<GraphMapFilterMode>("all");
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(
    fromGraphId,
  );
  const { data: selectedGraphData } = useGraphData(selectedGraphId ?? "");
  const [multiSelectedGraphIds, setMultiSelectedGraphIds] = useState<
    Set<string>
  >(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [isAIExpansionOpen, setIsAIExpansionOpen] = useState(false);
  const [expansionProgress, setExpansionProgress] =
    useState<InfiniteExpansionProgress | null>(null);
  const [isExpansionRunning, setIsExpansionRunning] = useState(false);
  const [expansionSessionId, setExpansionSessionId] = useState<string | null>(null);
  // 当前 AI 智能扩展(宽度扩展)后台任务的 id，用于按任务过滤 SSE 进度
  const [infiniteTaskId, setInfiniteTaskId] = useState<string | null>(null);
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
  const [isAutoClassifyOpen, setIsAutoClassifyOpen] = useState(false);
  const [autoClassifyTaskId, setAutoClassifyTaskId] = useState<string | null>(null);
  const [domainBatchSessionId, setDomainBatchSessionId] = useState<string | null>(null);
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isGenerateCardsModalOpen, setIsGenerateCardsModalOpen] =
    useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isDiscoveryPanelOpen, setIsDiscoveryPanelOpen] = useState(false);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(() => {
    const domainParam = searchParams.get('domain');
    if (!domainParam) return new Set();
    return new Set(domainParam.split(',').filter(Boolean));
  });
  const [isBatchDomainPickerOpen, setIsBatchDomainPickerOpen] = useState(false);
  const [isBatchSettingDomain, setIsBatchSettingDomain] = useState(false);
  const [showDomainManager, setShowDomainManager] = useState(false);
  // 领域 hover 联动：在左侧领域树上悬停某领域时，画布高亮对应领域节点
  const [hoveredDomainId, setHoveredDomainId] = useState<string | null>(null);
  // 「全部」过滤模式下不产生选中/悬停效果：仅当勾选了具体领域时才联动
  const effectiveHoveredDomainId =
    selectedDomainIds.size > 0 ? hoveredDomainId : null;

  useEffect(() => {
    if (selectedDomainIds.size > 0) {
      setSearchParams({ domain: Array.from(selectedDomainIds).join(',') }, { replace: true });
    } else {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('domain');
      setSearchParams(newParams, { replace: true });
    }
  }, [selectedDomainIds]);

  // 图地图样式与图编辑器共用同一份持久化设置（节点形状/中心点/光晕/网格/配色/连线/动画）
  const {
    colorScheme,
    linkStyle,
    linkAnimation,
    nodeShape,
    centerDotShape,
    nodeGlow,
    gridStyle,
    setColorScheme,
    setLinkStyle,
    setLinkAnimation,
    setNodeGlow,
  } = useGraphStyleSettingsStore();
  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false);

  const {
    data: mapData,
    isLoading,
    error,
    refetch: refetchMap,
  } = useQuery({
    queryKey: queryKeys.graphMap(),
    queryFn: () => api.graphs.getMap(),
    // 图谱地图（图谱列表+关系）低频变化，mutation 已显式失效该键，加长 staleTime 减少重复拉取
    staleTime: 5 * 60 * 1000,
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
    // 按结构身份识别「未分类」系统领域（is_system + icon），不依赖本地化后的名称字符串，
    // 兼容历史数据中名称被误存为 i18n key 的情况
    if (domainTree && !domainTree.some((d: DomainTreeNode) => d.is_system && d.icon === 'FolderOpen')) {
      hasCheckedUncategorized.current = true;
      domainsApi.ensureUncategorized().catch((err) => { console.error(err); });
    }
  }, [domainTree]);

  const graphs = useMemo(() => mapData?.graphs || [], [mapData?.graphs]);
  // 预构建 graph.id -> graph 映射，避免渲染时对每个选中 id 线性扫描 graphs（原为 O(selectedIds*graphs)）
  const graphById = useMemo(() => {
    const m = new Map<string, Graph>();
    graphs.forEach((g) => {
      m.set(g.id, g);
    });
    return m;
  }, [graphs]);
  const relations = useMemo(
    () => mapData?.relations || [],
    [mapData?.relations],
  );
  // 预计算选中图的关系，替代渲染中两处重复 filter 全量 relations 的扫描
  const selectedGraphRelations = useMemo(
    () =>
      selectedGraphId
        ? relations.filter(
            (r: GraphRelation) =>
              r.source_graph_id === selectedGraphId ||
              r.target_graph_id === selectedGraphId,
          )
        : [],
    [relations, selectedGraphId],
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

    // 预构建 领域名称 -> 首个领域ID 映射（与 find 的首个匹配语义一致），
    // 避免在回退分支对每张 graph 线性扫描 domainIdToInfo（原为 O(graphs*domains)）
    const domainNameToId = new Map<string, string>();
    domainIdToInfo.forEach((info, id) => {
      if (!domainNameToId.has(info.name)) {
        domainNameToId.set(info.name, id);
      }
    });

    graphs.forEach((graph: Graph) => {
      const domainIds = graph.domainIds || [];
      if (domainIds.length > 0) {
        map.set(graph.id, new Set(domainIds));
      } else if (graph.domain) {
        // 回退：通过名称匹配（兼容旧数据）
        const matchedId = domainNameToId.get(graph.domain);
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

  // 通过预构建 graphById 映射取图，替代每次渲染对 graphs 的线性 find（原每次渲染 O(graphs) 扫描）
  const fromGraph = fromGraphId ? graphById.get(fromGraphId) : undefined;

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

  const handleBatchCreateRelation = useCallback(() => {
    setIsCreatePanelOpen(true);
  }, []);

  // 自动分类领域：提交后台任务（AI 聚类较耗时），完成后再通知用户
  const handleStartAutoClassify = useCallback(async () => {
    try {
      const task = await tasksApi.create({
        type: "auto_classify_domains",
        payload: {},
      });
      useAutoClassifyNotificationStore.getState().startTracking(task.id);
      message.success(t("graphMap.autoClassify.submitted"));
    } catch (error: unknown) {
      const errMsg =
        getErrorMessage(error) || t("graphMap.autoClassify.startFailed");
      message.error(errMsg);
    }
  }, [t]);

  // 由完成通知「继续」请求打开候选确认面板，并加载对应任务结果
  const panelTaskId = useAutoClassifyPanelStore((s) =>
    s.open ? s.taskId : null,
  );
  useEffect(() => {
    if (!panelTaskId) return;
    useAutoClassifyPanelStore.getState().clearOpen();
    setAutoClassifyTaskId(panelTaskId);
    setIsAutoClassifyOpen(true);
  }, [panelTaskId]);

  const handleUndoBatchDelete = useCallback(async (ids: string[]) => {
    try {
      for (const id of ids) {
        await api.graphs.restore(id);
      }
      message.success(t('common.restored'));
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error) || t('common.restoreFailed');
      message.error(errMsg);
    } finally {
      setMultiSelectedGraphIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    }
  }, [queryClient, t]);

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
      const toastId = message.success(t('graphMap.batch.deleteSuccess', { count: ids.length }), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            message.dismiss(toastId);
            void handleUndoBatchDelete(ids);
          },
        },
      });
      setMultiSelectedGraphIds(new Set());
      queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('graphMap.batch.deleteFailed');
      message.error(errMsg);
    }
  }, [multiSelectedGraphIds, queryClient, t, handleUndoBatchDelete]);

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
        } catch (_) {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.domainTree() });
      setIsBatchDomainPickerOpen(false);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('graphMap.batch.setDomainFailed');
      message.error(errMsg);
    } finally {
      setIsBatchSettingDomain(false);
    }
  }, [multiSelectedGraphIds, queryClient, t]);

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
        const result = (await api.graphs.infiniteExpand(
          selectedGraphId,
          config,
        )) as { taskId?: string } | null;
        if (result?.taskId) {
          setInfiniteTaskId(result.taskId);
        }
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

  // 订阅全局 SSE 事件总线，实时同步无限扩展后台任务进度到 AI 智能扩展面板。
  // useTaskEvents 已在 Layout 层建立 /tasks/events 连接，并广播所有消息到 sse_message。
  useEffect(() => {
    if (!infiniteTaskId) return;

    const toPanelStatus = (
      status: string,
    ): InfiniteExpansionProgress["status"] => {
      if (status === "completed") return "completed";
      if (status === "failed" || status === "cancelled") return "failed";
      return "running";
    };

    const handler = (raw: unknown) => {
      const msg = raw as {
        type?: string;
        taskId?: string;
        status?: string;
        error?: unknown;
        progress?: {
          current_depth?: number;
          total_graphs_created?: number;
          total_nodes_created?: number;
          current_graph_title?: string;
          created_graphs?: InfiniteExpansionProgress["created_graphs"];
        };
      };
      if (!msg || msg.type !== "task_update" || msg.taskId !== infiniteTaskId) {
        return;
      }

      const status = msg.status ?? "in_progress";
      const p = msg.progress;

      // 任务进入终态（完成/失败/取消）时，追加一次图谱地图刷新，
      // 覆盖创建任务时那次的失效（此时扩展尚未落库）
      const isTerminal =
        status === "completed" || status === "failed" || status === "cancelled";
      if (status === "completed") {
        queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
      }

      setExpansionProgress((prev) => {
        const next: InfiniteExpansionProgress = {
          status: toPanelStatus(status),
          current_depth: p?.current_depth ?? prev?.current_depth ?? 0,
          total_graphs_created:
            p?.total_graphs_created ?? prev?.total_graphs_created ?? 0,
          total_nodes_created:
            p?.total_nodes_created ?? prev?.total_nodes_created ?? 0,
          current_graph_title: p?.current_graph_title,
          created_graphs: Array.isArray(p?.created_graphs)
            ? (p.created_graphs as InfiniteExpansionProgress["created_graphs"])
            : (prev?.created_graphs ?? []),
          errors:
            status === "failed" || msg.error != null
              ? [
                  {
                    message:
                      typeof msg.error === "string"
                        ? msg.error
                        : String(msg.error ?? ""),
                  },
                ]
              : (prev?.errors ?? []),
        };
        return next;
      });

      setIsExpansionRunning(!isTerminal);
    };

    const unsubscribe = frontendEventBus.subscribe("sse_message", handler);
    return () => unsubscribe();
  }, [infiniteTaskId, queryClient]);

  // 重新打开 AI 智能扩展面板时（关闭→打开 的上升沿），若无正在运行的扩展，才清理上一次的完成/失败进度，
  // 避免换了源图谱后仍显示旧任务的「扩展完成」。
  // 注意：不能用 isExpansionRunning 作依赖，否则任务完成（running 变 false）的瞬间也会触发清理，
  // 导致面板刚展示「完成」就被打回「未开始」；改用 ref 读取，避免 exhaustive-deps 报缺失依赖。
  const prevExpansionOpenRef = useRef(false);
  const expansionRunningRef = useRef(isExpansionRunning);
  useEffect(() => {
    expansionRunningRef.current = isExpansionRunning;
  }, [isExpansionRunning]);

  useEffect(() => {
    const justOpened = isAIExpansionOpen && !prevExpansionOpenRef.current;
    prevExpansionOpenRef.current = isAIExpansionOpen;
    if (justOpened && !expansionRunningRef.current) {
      setExpansionProgress(null);
      setInfiniteTaskId(null);
    }
  }, [isAIExpansionOpen]);

  const handleDepthExpand = useCallback(
    async (config: {
      style: "academic" | "practical" | "beginner" | "custom";
      customPrompt?: string;
      sources?: string[];
      depth: number;
    }): Promise<{ root: { title: string; content: string }; coreNodes: CoreNode[] } | null> => {
      if (!selectedGraphId) return null;

      try {
        const graph = graphById.get(selectedGraphId);
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
              // core 挂到 root 下：root 在 calculateNodePositions 中恒为 temp-0
              parentId: "temp-0",
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
    async (config: {
      count: number;
      types: string[];
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
      coverage?: 'current_only' | 'with_children' | 'with_siblings' | 'graph';
      customPrompt?: string;
      targetNodeIds?: string[];
      cardsPerType?: Partial<Record<string, number>>;
      countPerDifficulty?: Partial<Record<'easy' | 'medium' | 'hard', number>>;
      countMatrix?: Record<string, { easy: number; medium: number; hard: number }>;
    }) => {
      const nodeIds =
        config.targetNodeIds && config.targetNodeIds.length > 0
          ? config.targetNodeIds
          : Array.from(selectedNodeIds);
      if (nodeIds.length === 0) return;

      try {
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
        // 题型×难度矩阵：剔除全零格，保证只传有效配置
        const countMatrix =
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

        const result = await api.ai.batchGenerateCards(nodeIds, {
          count: config.count,
          types: config.types,
          difficulty: config.difficulty,
          coverage: config.coverage,
          custom_prompt: config.customPrompt || undefined,
          cards_per_type: cardsPerTypeNum,
          count_per_difficulty: countPerDiffNum as { easy?: number; medium?: number; hard?: number } | undefined,
          count_matrix: countMatrix,
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
    [selectedNodeIds, t, navigate],
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
        onDomainGenerate={() => setIsDomainGeneratorOpen(true)}
        onAutoClassify={handleStartAutoClassify}
        onOpenStyleSettings={() => setIsStyleSettingsOpen(true)}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        graphCount={graphs.length}
        relationCount={relations.length}
        isLoading={isLoading}
        fromGraphId={fromGraphId}
        fromGraphTitle={fromGraph?.title}
        onReturnToGraph={() => navigate(`/graph/${fromGraphId}`)}
        domains={domainTree || []}
        selectedDomainIds={selectedDomainIds}
        onDomainSelectionChange={handleDomainSelectionChange}
        hoveredDomainId={effectiveHoveredDomainId}
        onHoverDomainChange={setHoveredDomainId}
        onManageDomains={() => setShowDomainManager(true)}
      />

      <div className="flex-1 relative">
        <Suspense fallback={<GraphMapSkeleton />}>
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
              hoveredDomainId={effectiveHoveredDomainId}
              domainColorMap={domainColorMap}
              domainIdToInfo={domainIdToInfo}
              graphDomainMap={graphDomainMap}
              colorScheme={colorScheme}
              linkStyle={linkStyle}
              linkAnimation={linkAnimation}
              nodeShape={nodeShape}
              centerDotShape={centerDotShape}
              nodeGlow={nodeGlow}
              gridStyle={gridStyle}
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
                const graph = graphById.get(id);
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
                  const graph = graphById.get(selectedGraphId);
                  if (!graph) return null;

                  const graphRelations = selectedGraphRelations;

                  return (
                    <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: isMobilePanelExpanded ? "calc(80vh - 40px)" : "140px" }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                            {graph.title}
                          </h2>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('graphMap.graph.nodeCount', { count: graph.nodes_count || 0 })} · {t('graphMap.graph.relationCount', { count: graphRelations.length })}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedGraphId(null)}
                          aria-label={t('common.aria.close')}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                          
                        </div>
                      )}
                      

                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => navigate(`/graph/${graph.id}`)}
                          className="flex-1 px-3 py-2 bg-primary-500 text-white text-sm rounded-lg active:bg-primary-600 transition-colors"
                        >
                          {t('graphMap.graph.openGraph')}
                        </button>
                        
                      </div>

                      

                      {isMobilePanelExpanded && (
                        <>
                          

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
                                  const otherGraph = graphById.get(otherGraphId);

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
                  const graph = graphById.get(selectedGraphId);
                  if (!graph) return null;

                  const graphRelations = selectedGraphRelations;

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
                        {t('graphMap.graph.nodeCount', { count: graph.nodes_count || 0 })} ·{" "}
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
                          
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/graph/${graph.id}`)}
                          className="flex-1 px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
                        >
                          {t('graphMap.graph.openGraph')}
                        </button>
                        
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
                                const otherGraph = graphById.get(otherGraphId);

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
      </div>

      <CreateRelationPanel
        graphs={graphs}
        isOpen={isCreatePanelOpen}
        onClose={() => setIsCreatePanelOpen(false)}
        onSubmit={handleCreateRelation}
        initialSourceId={selectedGraphId || undefined}
      />

      <Suspense fallback={null}>
        <AIExpansionPanel
          isOpen={isAIExpansionOpen}
          onClose={() => setIsAIExpansionOpen(false)}
          sourceGraphId={selectedGraphId || ""}
          sourceGraphTitle={
            graphById.get(selectedGraphId ?? '')?.title || ""
          }
          sourceGraphDescription={
            graphById.get(selectedGraphId ?? '')?.description || ""
          }
          onDepthExpand={handleDepthExpand}
          onDepthExpandNode={handleDepthExpandNode}
          onWidthExpand={handleInfiniteExpand}
          progress={expansionProgress}
          isRunning={isExpansionRunning}
          onEditPrompt={handleOpenPromptEditor}
          hasNodes={
            (graphById.get(selectedGraphId ?? '')?.nodes_count ?? 0) > 0
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
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <Loading />
                </div>
              }
            >
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

      <Suspense fallback={null}>
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
            // 批量创建可能新建领域节点，刷新领域树避免工具栏领域筛选/联动使用旧缓存
            queryClient.invalidateQueries({ queryKey: queryKeys.domainTree() });
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
            // 优先复用已缓存的图谱地图，避免绕过缓存重复拉取全量地图
            const cached = queryClient.getQueryData<Awaited<ReturnType<typeof api.graphs.getMap>>>(queryKeys.graphMap());
            if (cached) return { graphs: cached.graphs };
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
              inferredDomain: result.inferred_domain,
            };
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <NodeSelectorModal
          isOpen={isNodeSelectorOpen}
          onClose={() => setIsNodeSelectorOpen(false)}
          onConfirm={handleNodeSelectorConfirm}
          graphId={selectedGraphId || ""}
          graphTitle={
            graphById.get(selectedGraphId ?? '')?.title || ""
          }
        />
      </Suspense>

      <Suspense fallback={null}>
        <GenerateCardsModal
          isOpen={isGenerateCardsModalOpen}
          onClose={() => setIsGenerateCardsModalOpen(false)}
          onGenerate={handleGenerateCards}
          graphId={selectedGraphId ?? undefined}
          selectedNodes={selectedNodeIds
            .map((id) => {
              const n = selectedGraphData?.nodes?.find((x) => x.id === id);
              const title =
                (n as { title?: string } | undefined)?.title ??
                (n as { name?: string } | undefined)?.name ??
                "";
              return { id, title };
            })
            .filter((x) => x.title.length > 0 || x.id)}
          graphNodes={(selectedGraphData?.nodes ?? []).map((n) => {
            const node = n as { id: string; title?: string; name?: string };
            return { id: node.id, title: node.title ?? node.name ?? "" };
          })}
          graphEdges={(selectedGraphData?.edges ?? []).map((e) => ({
            source_knowledge_point_id: e.source_knowledge_point_id,
            target_knowledge_point_id: e.target_knowledge_point_id,
          }))}
        />
      </Suspense>

      <Suspense fallback={null}>
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

      <Suspense fallback={null}>
        <BatchOperationPanel
          selectedCount={multiSelectedGraphIds.size}
          onBatchCreateRelation={handleBatchCreateRelation}
          onBatchDelete={handleBatchDelete}
          onBatchSetDomain={() => setIsBatchDomainPickerOpen(true)}
          onClearSelection={clearMultiSelection}
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
    </div>

    <DomainManager
      isOpen={showDomainManager}
      onClose={() => setShowDomainManager(false)}
    />

    <Suspense fallback={null}>
      <AutoClassifyDomainPanel
        isOpen={isAutoClassifyOpen}
        onClose={() => {
          setIsAutoClassifyOpen(false);
          setAutoClassifyTaskId(null);
        }}
        initialTaskId={autoClassifyTaskId}
        onApplied={() => {
          setIsAutoClassifyOpen(false);
          setAutoClassifyTaskId(null);
          queryClient.invalidateQueries({ queryKey: queryKeys.domainTree() });
          queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() });
          queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
        }}
      />
    </Suspense>

    {isStyleSettingsOpen && (
      <Suspense fallback={null}>
        <GraphStyleSettings
          isOpen={isStyleSettingsOpen}
          onClose={() => setIsStyleSettingsOpen(false)}
          currentColorScheme={colorScheme}
          currentLinkStyle={linkStyle}
          currentLinkAnimation={linkAnimation}
          onColorSchemeChange={setColorScheme}
          onLinkStyleChange={setLinkStyle}
          onLinkAnimationChange={setLinkAnimation}
          nodeGlow={nodeGlow}
          onNodeGlowChange={setNodeGlow}
        />
      </Suspense>
    )}
    </>
  );
};

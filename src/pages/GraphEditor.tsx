import React, { useEffect, useState, useRef, useMemo, lazy, Suspense, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { api } from '../services/api';
import { type Graph3DRef, type Graph3DProps } from '../components/Graph3D';
import { Node } from '../types';

// Lazy load heavy 3D component
// Cast the lazy loaded component to proper type including ref
const Graph3D = lazy(() => import('../components/Graph3D').then(module => ({ default: module.Graph3D }))) as unknown as React.ForwardRefExoticComponent<Graph3DProps & React.RefAttributes<Graph3DRef>>;
import { getLevel, findShortestPath, NodeLevel } from '../lib/graphUtils';
import { LEVEL_CONFIG } from '../config/graphConfig';
import { Save, Wand2, Download, Trash2, X, Navigation, GraduationCap, Sparkles, Edit3, Eraser, Check, Lock, ArrowLeft, Loader2, LayoutList } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { generateMarkdown, generateJSON, downloadFile, downloadImage } from '../utils/exportUtils';
import { preprocessMarkdown } from '../utils/markdownUtils';
import { GraphOutline } from '../components/GraphEditor/GraphOutline';
import { TextToGraphModal } from '../components/GraphEditor/TextToGraphModal';
import { GraphSettingsModal } from '../components/GraphEditor/GraphSettingsModal';
import { ChatDialog } from '../components/GraphEditor/ChatDialog';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { HelpModal } from '../components/HelpModal';
import { useHistory, HistoryAction } from '../hooks/useHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.tsx';
import { GraphToolbar } from '../components/GraphEditor/GraphToolbar';
import { useTheme } from '../hooks/useTheme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useIsMobile } from '../hooks/useIsMobile';
const levelLabels: Record<string, string> = {
  root: '根节点',
  core: '核心节点',
  sub: '次级节点',
  normal: '普通节点',
  leaf: '叶子节点'
};

import { 
  useGraph, 
  useGraphData, 
  useCreateNodeMutation, 
  useUpdateNodeOptimisticMutation, 
  useDeleteNodeMutation, 
  useCreateEdgeMutation,
  useDeleteEdgeMutation,
  useAIGenerateMutation,
  useAIExpandMutation,
  useAIGenerateCardsMutation, 
  useCreateCardsBatchMutation, 
  useDocumentToGraphMutation, 
  useRecommendConnectionsMutation, 
  useDeleteGraphMutation, 
  useGraphNodeStatus, 
  useCreateTaskMutation, 
  useAIStatus, 
  useBatchDeleteNodesMutation,
  queryKeys
} from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useStore();
  // useStore kept only for user/token if needed, or if we want to sync global state for other components
  // But for this page, we rely on React Query
  // const { nodes, edges, setNodes, setEdges, addNode, updateNode, removeNode, addEdge } = useStore();
  
  // React Query Hooks
  const { data: graphMeta } = useGraph(id || '');
  const { data: graphData, isLoading: isGraphLoading, refetch: refetchGraph } = useGraphData(id || '');
  const { data: nodeStatus } = useGraphNodeStatus(id || '');
  
  const createNodeMutation = useCreateNodeMutation();
  const updateNodeMutation = useUpdateNodeOptimisticMutation();
  const deleteNodeMutation = useDeleteNodeMutation();
  const batchDeleteNodesMutation = useBatchDeleteNodesMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const deleteEdgeMutation = useDeleteEdgeMutation();
  const aiExpandMutation = useAIExpandMutation();
  const aiGenerateCardsMutation = useAIGenerateCardsMutation();
  const createCardsBatchMutation = useCreateCardsBatchMutation();
  const recommendConnectionsMutation = useRecommendConnectionsMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const createTaskMutation = useCreateTaskMutation();
  const { data: aiStatus } = useAIStatus(!!token);
  const { addMessage } = useMessageStore();
  const isMobile = useIsMobile();
  const aiEnabled = aiStatus?.enabled ?? true;
  const hasShownAIWarningRef = useRef(false);

  useEffect(() => {
    if (aiEnabled) return;
    if (hasShownAIWarningRef.current) return;
    hasShownAIWarningRef.current = true;
    addMessage({
      type: 'warning',
      content: 'AI 未配置：文本分析/对话将使用模拟结果，文档解析与智能推荐不可用',
      duration: 12000,
      action: { label: '配置说明', onClick: () => navigate('/profile') }
    });
  }, [aiEnabled, addMessage, navigate]);

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // State
  const graphRef = useRef<Graph3DRef>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isEngineLoading, setIsEngineLoading] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<'none' | 'create' | 'edit' | 'outline' | 'detail'>('none');
  const [prevSidebarMode, setPrevSidebarMode] = useState<'none' | 'create' | 'edit' | 'outline' | 'detail'>('none');
  const [showGrid, setShowGrid] = useState(false);
  const { isDark } = useTheme();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [loading, setLoading] = useState(false); // For non-query loading (e.g. AI)
  // const [graphTitle, setGraphTitle] = useState(''); // Use graphMeta.title

  // Layout & Clustering State
  const [layoutMode, setLayoutMode] = useState<'3d-force' | '2d-tree' | '3d-sphere'>('3d-force');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  const lockedNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const ids = new Set<string>();
    Object.entries(nodeStatus).forEach(([nodeId, status]: [string, any]) => {
      if (status.locked) ids.add(nodeId);
    });
    return ids;
  }, [nodeStatus]);

  const masteredNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const ids = new Set<string>();
    Object.entries(nodeStatus).forEach(([nodeId, status]: [string, any]) => {
      if (status.mastered) ids.add(nodeId);
    });
    return ids;
  }, [nodeStatus]);

  // Calculate Graph Stats for Dashboard
  const graphStats = useMemo(() => {
    if (!nodeStatus) return { masteredCount: 0, dueTodayCount: 0 };
    let mastered = 0;
    let due = 0;
    const now = new Date();
    Object.values(nodeStatus).forEach((status: any) => {
      if (status.mastered) mastered++;
      if (status.next_review && new Date(status.next_review) <= now) due++;
    });
    return { masteredCount: mastered, dueTodayCount: due };
  }, [nodeStatus]);

  // Pathfinding State
  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [pathStartNode, setPathStartNode] = useState<Node | null>(null);
  const [pathEndNode, setPathEndNode] = useState<Node | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<{ nodes: Set<string>, links: Set<string> } | null>(null);

  // Form State
  const [nodeForm, setNodeForm] = useState<{
    title: string;
    content: string;
    color: string;
    parentNodeId: string;
    level: NodeLevel;
  }>({
    title: '',
    content: '',
    color: '#3B82F6',
    parentNodeId: '',
    level: 'leaf'
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isTextToGraphOpen, setIsTextToGraphOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);
  const [relatedNodes, setRelatedNodes] = useState<any[]>([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [showRelatedSection, setShowRelatedSection] = useState(false);

  // Reset related nodes when selection changes
  useEffect(() => {
    setRelatedNodes([]);
    setShowRelatedSection(false);
  }, [selectedNode?.id]);

  const handleFetchRelatedNodes = async () => {
    if (!selectedNode) return;
    setIsRelatedLoading(true);
    setShowRelatedSection(true);
    try {
      const res = await api.nodes.getRelated(selectedNode.id);
      setRelatedNodes(res || []);
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '获取相关节点失败' });
    } finally {
      setIsRelatedLoading(false);
    }
  };

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [exportImageOptions, setExportImageOptions] = useState({
    transparent: false,
    fitView: true,
    hideGrid: true
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const recommendTimeoutRef = useRef<any>(null);
  const hasShownRecommendErrorRef = useRef(false);

  // Fetch recommendations when title changes
  useEffect(() => {
    // Don't recommend for default "New Node" title or empty/short titles
    if (!nodeForm.title || 
        nodeForm.title.length < 2 || 
        nodeForm.title === '新节点' || 
        !id ||
        aiEnabled === false) {
      setRecommendations([]);
      return;
    }

    if (recommendTimeoutRef.current) clearTimeout(recommendTimeoutRef.current);

    recommendTimeoutRef.current = setTimeout(async () => {
      setIsRecommending(true);
      try {
        const res = await recommendConnectionsMutation.mutateAsync({
          graph_id: id,
          node_title: nodeForm.title,
          node_content: nodeForm.content
        });
        setRecommendations(res.recommendations || []);
      } catch (err) {
        console.error('Recommendation failed:', err);
        setRecommendations([]);
        if (!hasShownRecommendErrorRef.current) {
          hasShownRecommendErrorRef.current = true;
          const message = err instanceof Error ? err.message : '';
          addMessage({
            type: 'warning',
            content: message.includes('AI provider not configured') ? 'AI 未配置：智能连线推荐不可用' : '智能连线推荐失败',
            duration: 8000
          });
        }
      } finally {
        setIsRecommending(false);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(recommendTimeoutRef.current);
  }, [nodeForm.title, nodeForm.content, id, aiEnabled]);

  // Stabilize history handlers
  const handleCreateNodeHistory = useCallback((data: any) => createNodeMutation.mutateAsync(data), [createNodeMutation]);
  const handleUpdateNodeHistory = useCallback((params: any) => updateNodeMutation.mutateAsync(params), [updateNodeMutation]);
  const handleDeleteNodeHistory = useCallback((params: any) => deleteNodeMutation.mutateAsync(params), [deleteNodeMutation]);
  const handleCreateEdgeHistory = useCallback((data: any) => createEdgeMutation.mutateAsync(data), [createEdgeMutation]);
  const handleDeleteEdgeHistory = useCallback((params: any) => deleteEdgeMutation.mutateAsync(params), [deleteEdgeMutation]);

  // History Hook
  const { undo, redo, record, canUndo, canRedo } = useHistory({
    createNode: handleCreateNodeHistory,
    updateNode: handleUpdateNodeHistory,
    deleteNode: handleDeleteNodeHistory,
    createEdge: handleCreateEdgeHistory,
    deleteEdge: handleDeleteEdgeHistory
  });

  // Keyboard Shortcuts for Undo/Redo and Focus Mode
  useKeyboardShortcuts({
    undo,
    redo,
    canUndo,
    canRedo,
    isFocusMode,
    setIsFocusMode
  });

  // Update form when selected node changes
  useEffect(() => {
    if (selectedNode && sidebarMode === 'edit') {
      const parentEdge = edges.find(e => e.target_node_id === selectedNode.id);
      setNodeForm({
        title: selectedNode.title,
        content: selectedNode.content || '',
        color: selectedNode.color || '#3B82F6',
        parentNodeId: parentEdge ? parentEdge.source_node_id : '',
        level: getLevel(selectedNode, edges)
      });
    }
  }, [selectedNode, sidebarMode, edges]); // Added edges dependency

  // BFS algorithm for shortest path (unweighted graph)
  // const findShortestPath = ... (Removed, imported from utils)

  const handleStartCreate = () => {
    setPrevSidebarMode(sidebarMode);
    setSidebarMode('create');
    setSelectedNode(null);
    setNodeForm({
      title: '新节点',
      content: '',
      color: '#3B82F6',
      parentNodeId: '',
      level: 'root' // Default to root for new standalone nodes
    });
  };

  const handleNodeClick = (node: Node) => {
    if (isDeleteMode) {
      handleDeleteNode(node);
      return;
    }

    if (lockedNodeIds.has(node.id)) {
      addMessage({ content: '此节点尚未解锁！请先学习前置知识点。', type: 'warning' });
      return;
    }

    if (isPathfindingMode) {
      if (!pathStartNode) {
        setPathStartNode(node);
        addMessage({ content: '请选择终点节点', type: 'info' });
      } else if (!pathEndNode) {
        setPathEndNode(node);
        const path = findShortestPath(nodes, edges, pathStartNode.id, node.id);
        if (path.nodes.size > 0) {
          setHighlightedPath(path);
          addMessage({ content: `找到路径，长度: ${path.nodes.size - 1} 步`, type: 'success' });
        } else {
          addMessage({ content: '未找到路径', type: 'error' });
        }
      } else {
        // Reset and start over
        setPathStartNode(node);
        setPathEndNode(null);
        setHighlightedPath(null);
      }
      return;
    }

    setSelectedNode(node);
    setSelectedNodeIds(new Set([node.id]));
    setPrevSidebarMode(sidebarMode);
    setSidebarMode('detail');

    // Smooth transition: zoom to node
    // if (graphRef.current) {
    //   graphRef.current.focusNode(node.id);
    // }
  };

  const handleSelectionChange = (ids: string[]) => {
    const newSet = new Set(ids);
    setSelectedNodeIds(newSet);
    
    if (newSet.size === 1) {
      const node = nodes.find(n => n.id === ids[0]);
      if (node) {
        setSelectedNode(node);
        setPrevSidebarMode(sidebarMode);
        setSidebarMode('edit');
      }
    } else if (newSet.size > 1) {
      setSelectedNode(null);
      setSidebarMode('none');
    }
    // If 0, do nothing or clear? Usually handled by background click.
    // But if we select nothing with box, we should clear.
    if (newSet.size === 0) {
      setSelectedNode(null);
      setSidebarMode('none');
    }
  };

  const getNextLevel = (parentLevel: string): NodeLevel => {
    switch (parentLevel) {
      case 'root': return 'core';
      case 'core': return 'sub';
      case 'sub': return 'normal';
      case 'normal': return 'leaf';
      default: return 'leaf';
    }
  };

  const handleToggleCollapse = (nodeId: string) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleLayoutChange = (mode: '3d-force' | '2d-tree' | '3d-sphere') => {
    setLayoutMode(mode);
    // Reset camera or other view settings if needed
    addMessage({ type: 'success', content: `切换至 ${mode === '2d-tree' ? '2D 树状图' : mode === '3d-sphere' ? '3D 球形布局' : '3D 力导向'}` });
    // Ensure simulation version updates to reset interaction layers
    if (graphRef.current) {
      // Small delay to ensure state has propagated
      setTimeout(() => {
        // We can't directly trigger setSimulationVersion here as it's internal to useGraphSimulation,
        // but changing layoutMode already triggers the useEffect in useGraphSimulation.
        // However, we want to ensure the visual state resets.
      }, 50);
    }
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setSidebarMode('none');
  };

  const handleCloseSidebar = () => {
    if (prevSidebarMode === 'outline') {
      setSidebarMode('outline');
      setPrevSidebarMode('none');
    } else {
      setSidebarMode('none');
    }
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  };

  const handleSaveNode = async () => {
    if (!id) return;
    setLoading(true);
    try {
      if (sidebarMode === 'create') {
        // Create Node
        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: nodeForm.title,
          content: nodeForm.content,
          // Ensure integers for DB to prevent syntax errors
          x_position: Math.round((Math.random() - 0.5) * 20),
          y_position: Math.round((Math.random() - 0.5) * 20),
          color: nodeForm.color,
          level: nodeForm.level,
          properties: {}
        });

        // Create Edge if parent selected
        if (nodeForm.parentNodeId) {
          const newEdge = await createEdgeMutation.mutateAsync({
            source_node_id: nodeForm.parentNodeId,
            target_node_id: newNode.id,
            relationship_type: 'related',
            graphId: id
          });
          record({ type: 'CREATE_EDGE', payload: newEdge });
        }

        // Record history
        record({ type: 'CREATE_NODE', payload: newNode });

        // Switch to edit mode for the new node
        setSelectedNode(newNode);
        setSidebarMode('edit');
      } else if (sidebarMode === 'edit' && selectedNode) {
        // Prepare data for update and history
        const beforeState = {
          graph_id: selectedNode.graph_id,
          title: selectedNode.title,
          content: selectedNode.content,
          color: selectedNode.color,
          level: selectedNode.level,
          properties: selectedNode.properties
        };

        const updateData = {
          graph_id: selectedNode.graph_id,
          title: nodeForm.title,
          content: nodeForm.content,
          color: nodeForm.color,
          level: nodeForm.level,
          properties: selectedNode.properties
        };

        const actions: HistoryAction[] = [];

        // Update Node
        const updated = await updateNodeMutation.mutateAsync({
          id: selectedNode.id,
          data: updateData,
          graphId: id
        });
        
        actions.push({
          type: 'UPDATE_NODE',
          payload: {
            id: selectedNode.id,
            before: beforeState,
            after: updateData
          }
        });

        // Handle Edge Updates (Parent Node Change)
        const currentParentEdge = edges.find(e => e.target_node_id === selectedNode.id);
        const newParentId = nodeForm.parentNodeId;
        
        // 1. Delete old edge if parent changed or removed
        if (currentParentEdge && currentParentEdge.source_node_id !== newParentId) {
          await deleteEdgeMutation.mutateAsync({ id: currentParentEdge.id });
          actions.push({ type: 'DELETE_EDGE', payload: currentParentEdge });
        }
        
        // 2. Create new edge if new parent is selected
        if (newParentId && (!currentParentEdge || currentParentEdge.source_node_id !== newParentId)) {
          if (newParentId !== selectedNode.id) { // Prevent self-loop
            const newEdge = await createEdgeMutation.mutateAsync({
              source_node_id: newParentId,
              target_node_id: selectedNode.id,
              relationship_type: 'related',
              graphId: id
            });
            actions.push({ type: 'CREATE_EDGE', payload: newEdge });
          }
        }
        
        // Record history
        if (actions.length === 1) {
          record(actions[0]);
        } else if (actions.length > 1) {
          record({ type: 'BATCH', payload: actions });
        }
        
        // Update selected node state to prevent stale history
        setSelectedNode(updated);
        setSidebarMode('edit');
      }
      addMessage({ type: 'success', content: sidebarMode === 'create' ? '节点创建成功' : '节点保存成功' });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = (nodeToDelete: Node | null = selectedNode) => {
    if (!nodeToDelete || !id) return;
    
    // Find connected edges
    const connectedEdges = edges.filter(e => 
      e.source_node_id === nodeToDelete.id || e.target_node_id === nodeToDelete.id
    );
    
    setConfirmModal({
      isOpen: true,
      title: '删除节点',
      message: `确定要删除节点 "${nodeToDelete.title}" 吗?`,
      onConfirm: () => {
        deleteNodeMutation.mutate({ id: nodeToDelete.id, graphId: id }, {
          onSuccess: () => {
            record({ 
              type: 'DELETE_NODE', 
              payload: { node: nodeToDelete, edges: connectedEdges } 
            });
            // If we deleted the currently selected node, clear selection
            if (selectedNode?.id === nodeToDelete.id) {
              handleCloseSidebar();
            }
            addMessage({ type: 'success', content: '节点已删除' });
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          },
          onError: (err) => {
            console.error(err);
            addMessage({ type: 'error', content: '删除失败' });
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        });
      }
    });
  };

  const handleBatchDelete = () => {
    if (!id || selectedNodeIds.size === 0) return;
    
    // Prepare history data
    const batchAction: HistoryAction = {
      type: 'BATCH',
      payload: []
    };
    
    Array.from(selectedNodeIds).forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const connectedEdges = edges.filter(e => e.source_node_id === nodeId || e.target_node_id === nodeId);
        batchAction.payload.push({
          type: 'DELETE_NODE',
          payload: { node, edges: connectedEdges }
        });
      }
    });
    
    setConfirmModal({
      isOpen: true,
      title: '批量删除',
      message: `确定要删除选中的 ${selectedNodeIds.size} 个节点吗?`,
      onConfirm: () => {
        setLoading(true);
        const nodeIds = Array.from(selectedNodeIds);
        
        batchDeleteNodesMutation.mutateAsync({ nodeIds, graphId: id })
          .then(() => {
            if (batchAction.payload.length > 0) {
              record(batchAction);
            }
            setSelectedNodeIds(new Set());
            setSelectedNode(null);
            setSidebarMode('none');
            addMessage({ content: '批量删除成功', type: 'success' });
          }).catch((err) => {
            console.error(err);
            addMessage({ content: '批量删除失败', type: 'error' });
          }).finally(() => {
            setLoading(false);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          });
      }
    });
  };

  const handleBatchColorUpdate = async (color: string) => {
    if (!id || selectedNodeIds.size === 0) return;
    
    setLoading(true);
    const nodeIds = Array.from(selectedNodeIds);
    
    // Prepare history
    const batchAction: HistoryAction = {
      type: 'BATCH',
      payload: []
    };
    
    nodeIds.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        batchAction.payload.push({
          type: 'UPDATE_NODE',
          payload: {
            id: nodeId,
            before: { color: node.color },
            after: { color }
          }
        });
      }
    });
    
    try {
      await Promise.all(nodeIds.map(nodeId => 
        updateNodeMutation.mutateAsync({ id: nodeId, graphId: id, data: { color } })
      ));
      if (batchAction.payload.length > 0) {
        record(batchAction);
      }
      addMessage({ content: `已将 ${selectedNodeIds.size} 个节点颜色修改为 ${color}`, type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: '批量修改颜色失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchLevelUpdate = async (level: string) => {
    if (!id || selectedNodeIds.size === 0) return;
    
    setLoading(true);
    const nodeIds = Array.from(selectedNodeIds);
    
    // Prepare history
    const batchAction: HistoryAction = {
      type: 'BATCH',
      payload: []
    };
    
    nodeIds.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        batchAction.payload.push({
          type: 'UPDATE_NODE',
          payload: {
            id: nodeId,
            before: { level: node.level },
            after: { level: level as NodeLevel }
          }
        });
      }
    });
    
    try {
      await Promise.all(nodeIds.map(nodeId => 
        updateNodeMutation.mutateAsync({ id: nodeId, graphId: id, data: { level: level as NodeLevel } })
      ));
      if (batchAction.payload.length > 0) {
        record(batchAction);
      }
      addMessage({ content: `已将 ${selectedNodeIds.size} 个节点等级修改为 ${levelLabels[level] || level}`, type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: '批量修改等级失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!nodeForm.title) return;
    setLoading(true);
    // Reset content for streaming
    setNodeForm(prev => ({ ...prev, content: '' }));
    
    try {
      await api.ai.generateContentStream(
        { 
          topic: nodeForm.title, 
          context: aiPrompt,
          level: nodeForm.level
        },
        (chunk) => {
          setNodeForm(prev => ({ 
            ...prev, 
            content: (prev.content || '') + chunk 
          }));
        }
      );
      setAiPrompt('');
      addMessage({ content: 'AI 内容生成完成', type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: 'AI 生成失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAIExpand = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
      // Determine new node level based on parent
      const parentLevel = getLevel(selectedNode, edges);
      const newLevel = getNextLevel(parentLevel);

      // Collect existing node titles for context to avoid duplicates or link to them
      const existingTitles = nodes.map(n => n.title);
      
      // Get current direct children titles
      const currentChildrenIds = edges
        .filter(e => e.source_node_id === selectedNode.id)
        .map(e => e.target_node_id);
      const currentChildrenTitles = nodes
        .filter(n => currentChildrenIds.includes(n.id))
        .map(n => n.title);

      const res = await aiExpandMutation.mutateAsync({ 
        node_title: selectedNode.title,
        node_content: selectedNode.content,
        existing_nodes: existingTitles,
        child_nodes: currentChildrenTitles,
        context_level: parentLevel
      });
      const suggestions = res.suggestions;
      
      let newNodesCount = 0;
      let newEdgesCount = 0;

      for (const s of suggestions) {
        // Check if node already exists
        const existingNode = nodes.find(n => n.title === s.title);
        
        if (existingNode) {
          // Check if edge already exists
          const edgeExists = edges.some(e => 
            (e.source_node_id === selectedNode.id && e.target_node_id === existingNode.id) ||
            (e.source_node_id === existingNode.id && e.target_node_id === selectedNode.id)
          );
          
          if (!edgeExists && existingNode.id !== selectedNode.id) {
             const newEdge = await createEdgeMutation.mutateAsync({
              source_node_id: selectedNode.id,
              target_node_id: existingNode.id,
              relationship_type: 'related',
              graphId: id
            });
            record({ type: 'CREATE_EDGE', payload: newEdge });
            newEdgesCount++;
          }
        } else {
          // Generate new nodes in a semi-random position
          const angle = Math.random() * Math.PI * 2;
          const radius = 4 + Math.random() * 4; // Distance from parent
          const x = Math.round(selectedNode.x_position + Math.cos(angle) * radius);
          const y = Math.round(selectedNode.y_position + Math.sin(angle) * radius);
          
          const newNode = await createNodeMutation.mutateAsync({
            graph_id: id,
            title: s.title,
            content: s.content,
            x_position: x,
            y_position: y,
            color: LEVEL_CONFIG[newLevel]?.color || '#10B981', 
            level: newLevel,
            properties: {}
          });
          
          record({ type: 'CREATE_NODE', payload: newNode });

          const newEdge = await createEdgeMutation.mutateAsync({
            source_node_id: selectedNode.id,
            target_node_id: newNode.id,
            relationship_type: 'related',
            graphId: id
          });
          record({ type: 'CREATE_EDGE', payload: newEdge });
          newNodesCount++;
          newEdgesCount++;
        }
      }

      if (newNodesCount > 0 || newEdgesCount > 0) {
        addMessage({ type: 'success', content: `拓展完成：新增 ${newNodesCount} 个节点，${newEdgesCount} 条连线` });
      } else {
        addMessage({ type: 'info', content: '未发现新的关联' });
      }
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '拓展失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerateCards = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
      // 1. Generate Cards
      const res = await aiGenerateCardsMutation.mutateAsync({ 
        node_title: selectedNode.title, 
        node_content: selectedNode.content
      });
      
      const cards = res.cards.map((c: any) => ({
        node_id: selectedNode.id,
        question: c.question,
        answer: c.answer,
        type: c.type,
        options: c.options
      }));

      if (cards.length === 0) {
        addMessage({ type: 'error', content: 'AI 未能生成有效的卡片' });
        return;
      }

      // 2. Save Cards
      await createCardsBatchMutation.mutateAsync(cards);
      addMessage({ type: 'success', content: `成功生成并保存了 ${cards.length} 张复习卡片！` });
      
      // Invalidate status to update mastery
      queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(id) });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '生成卡片失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleBackgroundTask = async (type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions') => {
    // If it's a batch generate success notification, just show the message
    if (type === 'batch_generate_questions') {
      addMessage({
        type: 'success',
        content: '批量生成任务已提交',
        duration: 3000,
        action: { label: '查看任务', onClick: () => navigate('/tasks') }
      });
      return;
    }

    // If no nodes selected, do nothing
    if (selectedNodeIds.size === 0 && !selectedNode) return;
    if (!id) return;
    
    // Determine which nodes to process
    // If multiple nodes selected, process all of them
    // If only one node selected (or none but selectedNode is set), process that one
    const nodesToProcess = selectedNodeIds.size > 0 
      ? Array.from(selectedNodeIds).map(nid => nodes.find(n => n.id === nid)).filter(Boolean)
      : [selectedNode];

    if (nodesToProcess.length === 0) return;

    try {
      let successCount = 0;
      
      // Get AI settings from user store (via api helper in backend calls, but here we construct payload manually)
      // Since we can't easily access the store config here without importing store, 
      // and we are creating a task payload that the backend will process.
      // The backend task processor should load the user's config if not provided in payload.
      // So we can safely omit provider/model here and let the backend handle it.
      // Alternatively, we can use useStore() hook since this is a component.
      
      const { user } = useStore.getState();
      const aiConfig = user?.profile?.settings?.ai_config?.text;
      const provider = aiConfig?.provider;
      const model = aiConfig?.model;

      for (const node of nodesToProcess) {
        if (!node) continue;
        
        const payload: any = {
          graph_id: id,
          node_id: node.id,
          node_title: node.title,
          node_content: node.content,
          provider,
          model
        };

        if (type === 'expand_graph') {
          // Collect existing node titles for context
          const existingTitles = nodes.map(n => n.title);
          
          // Get current direct children titles
          const currentChildrenIds = edges
            .filter(e => e.source_node_id === node.id)
            .map(e => e.target_node_id);
          const currentChildrenTitles = nodes
            .filter(n => currentChildrenIds.includes(n.id))
            .map(n => n.title);
            
          payload.existing_nodes = existingTitles;
          payload.child_nodes = currentChildrenTitles;
        }

        await createTaskMutation.mutateAsync({
          type,
          payload
        });
        successCount++;
      }
      
      addMessage({
        type: 'success',
        content: '任务提交成功',
        duration: 3000,
        action: { label: '查看任务', onClick: () => navigate('/tasks') }
      });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '任务提交失败' });
    }
  };

  const handleStartLevelTest = () => {
    if (!selectedNode) return;
    navigate(`/study?node_id=${selectedNode.id}`);
  };

  const handleExportJSON = async () => {
    if (!graphMeta) return;
    try {
      const json = generateJSON(graphMeta, nodes, edges);
      downloadFile(json, `${graphMeta.title}_backup.json`, 'application/json');
      addMessage({ content: 'JSON 导出成功', type: 'success' });
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error(err);
      addMessage({ content: '导出失败', type: 'error' });
    }
  };

  const handleExportMarkdown = async () => {
    if (!id || !graphMeta) return;
    try {
      setIsExportMenuOpen(false);
      const blob = await api.data.export(id, 'markdown');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${graphMeta.title}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addMessage({ content: 'Markdown 导出成功', type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: 'Markdown 导出失败', type: 'error' });
    }
  };

  const handleExportPDF = async () => {
    if (!id || !graphMeta) return;
    try {
      setIsExportMenuOpen(false);
      const blob = await api.data.export(id, 'pdf');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${graphMeta.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addMessage({ content: 'PDF 导出成功', type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: 'PDF 导出失败', type: 'error' });
    }
  };

  const handleDeleteGraph = () => {
    if (!id || !graphMeta) return;
    
    setConfirmModal({
      isOpen: true,
      title: '删除图谱',
      message: `确定要删除当前图谱 "${graphMeta.title}" 吗？此操作无法撤销。`,
      onConfirm: () => {
        setLoading(true);
        deleteGraphMutation.mutate(id, {
          onSuccess: () => {
            addMessage({ content: '图谱已删除', type: 'success' });
            navigate('/dashboard');
            // No need to close modal as we navigate away
          },
          onError: (err: any) => {
            console.error(err);
            addMessage({ content: err.message || '删除失败', type: 'error' });
            setLoading(false);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          },
        });
      }
    });
  };

  const handleExportImage = () => {
    setIsExportMenuOpen(false);
    setIsExportImageModalOpen(true);
  };

  const confirmExportImage = async () => {
    try {
      if (!graphRef.current) return;
      const dataUrl = await graphRef.current.captureScreenshot(exportImageOptions);
      downloadImage(dataUrl, `${graphMeta?.title || 'graph'}_snapshot.png`);
      setIsExportImageModalOpen(false);
      addMessage({ content: '图片导出成功', type: 'success' });
    } catch (error) {
      console.error('Export image failed:', error);
      addMessage({ content: '图片导出失败', type: 'error' });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Removed handleFileUpload as it's now integrated into TextToGraphModal

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-50 rounded-full shadow-sm active:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-base font-bold truncate px-2 text-gray-800 max-w-[150px]">{graphMeta?.title || 'Knowledge Graph'}</h1>
          <button 
            onClick={() => navigate(`/study/${id}`)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md active:scale-95 transition-transform"
          >
            <GraduationCap size={14} />
            <span>复习</span>
          </button>
        </div>

        {/* Mobile Main View: GraphOutline */}
        <div className="flex-1 overflow-hidden bg-white">
           <GraphOutline 
             nodes={nodes} 
             edges={edges}
             onNodeClick={(node) => {
               setSelectedNode(node);
               setSidebarMode('edit'); 
             }}
             selectedNodeId={selectedNode?.id}
             selectedNodeIds={selectedNodeIds}
             onSelectionChange={setSelectedNodeIds}
             onBatchAction={(action) => {
                if (action === 'expand_graph') handleBackgroundTask('expand_graph');
                else if (action === 'delete') handleBatchDelete();
                else if (action === 'batch_generate_questions') handleBackgroundTask('batch_generate_questions');
             }}
             stats={graphStats}
             className="h-full border-none"
           />
        </div>
        
        {/* Reuse Edit Sidebar for Node Details (Full Screen on Mobile) */}
        {sidebarMode === 'edit' && selectedNode && (
            <div className="fixed inset-0 bg-white z-50 overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col">
               <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <button onClick={() => setSidebarMode('none')} className="text-gray-500 flex items-center font-medium">
                    <ArrowLeft size={18} className="mr-1"/> 返回列表
                  </button>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDeleteNode()}
                      className="p-2 text-red-500 bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
               </div>
               
               <div className="p-4 pb-20">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900">{selectedNode.title}</h2>
                  
                  <div className="mb-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ 
                        LEVEL_CONFIG[getLevel(selectedNode, edges)]?.color ? '' : 'bg-gray-100 text-gray-600'
                      }`} style={{ 
                        backgroundColor: `${selectedNode.color}15`, 
                        color: selectedNode.color,
                        borderColor: `${selectedNode.color}30`
                      }}>
                        {levelLabels[getLevel(selectedNode, edges)] || '普通节点'}
                      </span>
                    </div>
                    
                    <div className="prose prose-blue max-w-none text-gray-700">
                       <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                         {selectedNode.content || '*(无内容)*'}
                       </ReactMarkdown>
                    </div>
                  </div>

                  {/* Mobile Related Nodes Section */}
                  <div className="mt-8 pt-6 border-t border-gray-100">
                     <div className="flex justify-between items-center mb-4">
                       <h5 className="text-sm font-bold text-purple-700 flex items-center">
                         <Wand2 size={16} className="mr-2" />
                         AI 深度探索
                       </h5>
                     </div>
                     
                     <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                       <div className="flex justify-between items-center mb-3">
                         <span className="text-xs font-bold text-purple-700">语义相关节点</span>
                         {!showRelatedSection && (
                           <button 
                             onClick={handleFetchRelatedNodes}
                             className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg transition-colors font-medium"
                           >
                             查找关联
                           </button>
                         )}
                       </div>
                       
                       {showRelatedSection && (
                         <div className="space-y-2">
                           {isRelatedLoading ? (
                             <div className="flex items-center justify-center py-4 text-purple-400">
                               <Loader2 size={16} className="animate-spin mr-2" />
                               <span className="text-xs">分析中...</span>
                             </div>
                           ) : relatedNodes.length > 0 ? (
                             relatedNodes.map(node => (
                               <button
                                 key={node.id}
                                 onClick={() => setSelectedNode(node)}
                                 className="w-full text-left p-3 bg-white hover:bg-purple-50 border border-purple-100 rounded-lg text-sm transition-all flex items-center justify-between group shadow-sm"
                               >
                                 <span className="truncate flex-1 text-gray-700 font-medium group-hover:text-purple-700">{node.title}</span>
                                 <span className="text-xs text-purple-500 font-bold bg-purple-50 px-1.5 py-0.5 rounded ml-2">{(node.similarity * 100).toFixed(0)}%</span>
                               </button>
                             ))
                           ) : (
                             <div className="text-center py-2 text-xs text-purple-400 italic">
                               未发现显著相关的其他节点
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                  </div>
               </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* 3D Canvas */}
      <div className={`flex-1 h-full relative ${isDeleteMode ? 'cursor-not-allowed' : ''}`}>
        {(isGraphLoading || isEngineLoading) && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm">
             <div className="text-center">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
               <p className="text-gray-600 font-medium">
                  {isGraphLoading ? '正在加载数据...' : '正在初始化 3D 引擎...'}
               </p>
             </div>
          </div>
        )}
        <ErrorBoundary fallback={
          <div className="flex flex-col items-center justify-center h-full bg-gray-50 z-10 relative">
            <div className="text-red-500 font-bold mb-2">3D 视图加载失败</div>
            <p className="text-gray-500 text-sm mb-4">可能是 WebGL 上下文丢失或显存不足</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">刷新页面</button>
          </div>
        }>
          <Suspense fallback={null}>
            <Graph3D 
              ref={graphRef} 
              nodes={nodes} 
              edges={edges} 
              onNodeClick={handleNodeClick} 
              showGrid={showGrid} 
              isDark={isDark}
              selectedNodeId={selectedNode?.id}
              selectedNodeIds={selectedNodeIds}
              highlightedPath={highlightedPath}
              onEngineLoad={setIsEngineLoading}
              onSelectionChange={handleSelectionChange}
              onBoxUpdate={setSelectionBox}
              onBackgroundClick={handleBackgroundClick}
              collapsedNodeIds={collapsedNodeIds}
              layoutMode={layoutMode}
              lockedNodeIds={lockedNodeIds}
              masteredNodeIds={masteredNodeIds}
              gamificationEnabled={graphMeta?.settings?.gamification_enabled !== false}
              onNodeCollapse={handleToggleCollapse}
              textDisplayLevel={graphMeta?.settings?.text_display_level || 'important'}
            />
          </Suspense>
        </ErrorBoundary>

        {/* Selection Box Overlay - Rendered outside R3F to avoid R3F/DOM conflicts */}
        {selectionBox && (
          <div 
            style={{
              position: 'fixed',
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.width,
              height: selectionBox.height,
              border: '1px solid #3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />
        )}
      </div>

      {/* Floating Batch Actions Toolbar */}
      {selectedNodeIds.size > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900/50 flex items-center space-x-4 z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center space-x-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
            <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">已选择 {selectedNodeIds.size} 个节点</span>
          </div>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-slate-700"></div>
          
          {/* Quick Color Pick */}
          <div className="flex items-center space-x-1.5">
            {['#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map(color => (
              <button 
                key={color}
                onClick={() => handleBatchColorUpdate(color)}
                className="w-5 h-5 rounded-full border border-white dark:border-slate-700 hover:scale-125 transition-transform shadow-sm"
                style={{ backgroundColor: color }}
                title={`批量修改为此颜色`}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-slate-700"></div>

          <button 
            onClick={handleBatchDelete}
            className="flex items-center space-x-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors font-bold text-sm"
          >
            <Trash2 size={16} />
            <span>批量删除</span>
          </button>
          
          <button 
            onClick={() => setSelectedNodeIds(new Set())}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="取消选择"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Export Image Modal */}
      {isExportImageModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">导出图片设置</h3>
              <button onClick={() => setIsExportImageModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">自适应缩放 (展示全貌)</label>
                <input 
                  type="checkbox" 
                  checked={exportImageOptions.fitView}
                  onChange={(e) => setExportImageOptions({ ...exportImageOptions, fitView: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">背景透明</label>
                <input 
                  type="checkbox" 
                  checked={exportImageOptions.transparent}
                  onChange={(e) => setExportImageOptions({ ...exportImageOptions, transparent: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">隐藏网格线</label>
                <input 
                  type="checkbox" 
                  checked={exportImageOptions.hideGrid}
                  onChange={(e) => setExportImageOptions({ ...exportImageOptions, hideGrid: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button 
                onClick={() => setIsExportImageModalOpen(false)}
                className="flex-1 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                取消
              </button>
              <button 
                onClick={confirmExportImage}
                className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center"
              >
                <Download size={18} className="mr-2" />
                导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <GraphToolbar
        aiEnabled={aiEnabled}
        onBack={() => navigate(-1)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        title={graphMeta?.title || 'Loading...'}
        sidebarMode={sidebarMode}
        setSidebarMode={setSidebarMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        layoutMode={layoutMode}
        setLayoutMode={handleLayoutChange}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        onTextToGraph={() => setIsTextToGraphOpen(true)}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        onAIExpand={handleAIExpand}
        onBackgroundTask={handleBackgroundTask}
        isPathfindingMode={isPathfindingMode}
        setIsPathfindingMode={(mode) => {
          setIsPathfindingMode(mode);
          setPathStartNode(null);
          setPathEndNode(null);
          setHighlightedPath(null);
        }}
        pathfindingState={{
          startNode: pathStartNode,
          endNode: pathEndNode,
          pathLength: highlightedPath?.nodes.size ? highlightedPath.nodes.size - 1 : 0,
          reset: () => {
            setPathStartNode(null);
            setPathEndNode(null);
            setHighlightedPath(null);
          }
        }}
        onAddNode={handleStartCreate}
        isDeleteMode={isDeleteMode}
        setIsDeleteMode={(mode) => {
          setIsDeleteMode(mode);
          if (mode) {
            setIsPathfindingMode(false);
            setIsFocusMode(false);
          }
        }}
        selectedNodeIds={selectedNodeIds}
        onDeleteSelected={() => handleDeleteNode()}
        onBatchDelete={handleBatchDelete}
        onBatchColorUpdate={handleBatchColorUpdate}
        onBatchLevelUpdate={handleBatchLevelUpdate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isExportMenuOpen={isExportMenuOpen}
        setIsExportMenuOpen={setIsExportMenuOpen}
        exportActions={{
          onMarkdown: handleExportMarkdown,
          onPDF: handleExportPDF,
          onJSON: handleExportJSON,
          onImage: handleExportImage,
          onDeleteGraph: handleDeleteGraph
        }}
        onRefresh={refetchGraph}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Delete Mode Indicator */}
      {isDeleteMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-full shadow-lg z-20 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <Eraser size={16} />
          <span className="font-medium text-sm">删除模式：点击任意节点即可删除</span>
          <button 
            onClick={() => setIsDeleteMode(false)}
            className="ml-2 p-0.5 hover:bg-red-200 rounded-full"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pathfinding Instructions */}
      {isPathfindingMode && !isFocusMode && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-blue-100 flex items-center space-x-2 z-20">
          <Navigation size={16} className="text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {!pathStartNode 
              ? "请选择起点节点" 
              : !pathEndNode 
                ? "请选择终点节点" 
                : `路径长度: ${highlightedPath?.nodes.size ? highlightedPath.nodes.size - 1 : 0} 步`}
          </span>
          {highlightedPath && (
            <button
              onClick={() => {
                const nodeIds = Array.from(highlightedPath.nodes).join(',');
                navigate(`/study?node_ids=${nodeIds}`);
              }}
              className="ml-2 px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full hover:bg-indigo-700 shadow-sm flex items-center"
            >
              <Sparkles size={12} className="mr-1" />
              开启路径学习
            </button>
          )}
          {pathStartNode && (
            <button 
              onClick={() => {
                setPathStartNode(null);
                setPathEndNode(null);
                setHighlightedPath(null);
              }}
              className="ml-2 text-xs text-gray-500 hover:text-red-500 underline"
            >
              重置
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <TextToGraphModal 
        isOpen={isTextToGraphOpen}
        onClose={() => setIsTextToGraphOpen(false)}
        graphId={id || ''}
        aiEnabled={aiEnabled}
      />
      
      <GraphSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        graphId={id || ''}
      />

      <ChatDialog 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        graphId={id || ''}
        selectedNodeIds={Array.from(selectedNodeIds)}
        aiEnabled={aiEnabled}
      />
      
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="删除"
        isDangerous={true}
      />
      
      {/* Selection Hint */}
      {!isDeleteMode && !isPathfindingMode && selectedNodeIds.size === 0 && (
        <div className="absolute bottom-4 left-4 text-[10px] text-gray-400 dark:text-gray-500 bg-white/50 dark:bg-slate-900/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
          按住 Shift 键并拖动鼠标进行框选
        </div>
      )}
      
      {/* Right Sidebar */}
      {sidebarMode !== 'none' && (
        <ErrorBoundary fallback={
          <div className="w-80 bg-white shadow-lg border-l border-gray-200 absolute right-0 top-0 bottom-0 z-20 flex flex-col p-4 items-center justify-center">
            <div className="text-red-500 font-bold mb-2">侧边栏组件出错</div>
            <button onClick={handleCloseSidebar} className="text-blue-600 hover:underline">关闭侧边栏</button>
          </div>
        }>
        <div className={`w-80 bg-white shadow-lg border-l border-gray-200 absolute right-0 top-0 bottom-0 z-20 flex flex-col ${sidebarMode !== 'outline' ? 'p-4 overflow-y-auto' : ''}`}>
          {sidebarMode === 'outline' ? (
             <div className="h-full relative flex flex-col">
               <div className="absolute right-2 top-2 z-10">
                 <button onClick={handleCloseSidebar} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                   <X size={20} />
                 </button>
               </div>
               <GraphOutline 
                nodes={nodes} 
                edges={edges}
                onNodeClick={handleNodeClick} 
                selectedNodeId={selectedNode?.id}
                selectedNodeIds={selectedNodeIds}
                onSelectionChange={setSelectedNodeIds}
                onBatchAction={(action) => {
                  if (action === 'expand_graph') {
                    handleBackgroundTask('expand_graph');
                  } else if (action === 'delete') {
                    handleBatchDelete();
                  } else if (action === 'batch_generate_questions') {
                    handleBackgroundTask('batch_generate_questions');
                  }
                }}
                className="h-full"
                stats={graphStats}
              />
             </div>
          ) : sidebarMode === 'detail' && selectedNode ? (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-2">
                  {prevSidebarMode === 'outline' && (
                    <button 
                      onClick={() => {
                        setSidebarMode('outline');
                        setPrevSidebarMode('none');
                      }}
                      className="mr-1 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="返回大纲"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color || '#3B82F6' }}></div>
                  <h3 className="text-lg font-bold text-gray-800">节点详情</h3>
                </div>
                <button onClick={handleCloseSidebar} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto pr-1">
                <section>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">{selectedNode.title}</h1>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ 
                      LEVEL_CONFIG[getLevel(selectedNode, edges)]?.color ? '' : 'bg-gray-100 text-gray-600'
                    }`} style={{ 
                      backgroundColor: `${selectedNode.color}15`, 
                      color: selectedNode.color,
                      borderColor: `${selectedNode.color}30`
                    }}>
                      {levelLabels[getLevel(selectedNode, edges)] || '普通节点'}
                    </span>
                    <span className="text-gray-400 text-xs">•</span>
                    <span className="text-gray-400 text-xs">
                      更新于 {selectedNode.updated_at ? new Date(selectedNode.updated_at).toLocaleDateString() : '刚刚'}
                    </span>
                  </div>
                </section>

                <section className="bg-gray-50 rounded-xl p-4 border border-gray-100 min-h-[120px]">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">详细内容</h4>
                  <div className="prose prose-sm prose-blue max-w-none text-gray-700 leading-relaxed">
                    {selectedNode.content ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]} 
                        rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                      >
                        {preprocessMarkdown(selectedNode.content)}
                      </ReactMarkdown>
                    ) : (
                      <span className="italic text-gray-400">暂无详细描述...</span>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">知识关联</h4>
                  <div className="space-y-2">
                    {/* Parent */}
                    {edges.find(e => e.target_node_id === selectedNode.id) && (
                      <div className="flex items-center text-sm p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <span className="text-gray-400 mr-2">父节点:</span>
                        <button 
                          onClick={() => {
                            const edge = edges.find(e => e.target_node_id === selectedNode.id);
                            const parent = nodes.find(n => n.id === edge?.source_node_id);
                            if (parent) handleNodeClick(parent);
                          }}
                          className="text-blue-600 hover:underline font-medium truncate"
                        >
                          {nodes.find(n => n.id === edges.find(e => e.target_node_id === selectedNode.id)?.source_node_id)?.title}
                        </button>
                      </div>
                    )}
                    {/* Children */}
                    {edges.filter(e => e.source_node_id === selectedNode.id).length > 0 && (
                      <div className="p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">子节点:</span>
                          <button 
                            onClick={() => handleToggleCollapse(selectedNode.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {collapsedNodeIds.has(selectedNode.id) ? '展开分支' : '折叠分支'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {edges.filter(e => e.source_node_id === selectedNode.id).map(edge => {
                            const child = nodes.find(n => n.id === edge.target_node_id);
                            return child ? (
                              <button 
                                key={child.id}
                                onClick={() => handleNodeClick(child)}
                                className="px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded text-xs transition-colors border border-gray-100"
                              >
                                {child.title}
                              </button>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Mastery Status & Level Test */}
                <section className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                      <GraduationCap size={14} className="mr-1.5" />
                      学习进度
                    </h4>
                    {nodeStatus?.[selectedNode.id]?.mastered ? (
                      <span className="flex items-center text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <Check size={12} className="mr-1" /> 已掌握
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        学习中
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={handleStartLevelTest}
                    disabled={nodeStatus?.[selectedNode.id]?.locked}
                    className={`w-full py-3 rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 ${
                      nodeStatus?.[selectedNode.id]?.locked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : nodeStatus?.[selectedNode.id]?.mastered 
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                    }`}
                  >
                    {nodeStatus?.[selectedNode.id]?.locked ? (
                      <>
                        <Lock size={18} className="mr-2" />
                        节点已锁定 (需先掌握前置内容)
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} className="mr-2" />
                        {nodeStatus?.[selectedNode.id]?.mastered ? '再次复习关卡' : '进入关卡测验'}
                      </>
                    )}
                  </button>
                </section>

                {/* AI Assistant in Detail Mode */}
                <section className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center">
                    <Wand2 size={14} className="mr-1.5" />
                    AI 深度探索
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleAIExpand}
                        disabled={loading}
                        className="bg-white text-purple-600 border border-purple-200 py-2 rounded-lg hover:bg-purple-100 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
                      >
                        {loading ? '扩展中...' : '发现新关联'}
                      </button>
                      <button
                        onClick={() => handleBackgroundTask('expand_graph')}
                        className="text-[10px] text-purple-500 hover:text-purple-700 hover:underline"
                      >
                        后台扩展
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={handleAIGenerateCards}
                        disabled={loading}
                        className="bg-white text-indigo-600 border border-indigo-200 py-2 rounded-lg hover:bg-indigo-100 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
                      >
                        {loading ? '生成中...' : '生成复习卡片'}
                      </button>
                      <button
                        onClick={() => handleBackgroundTask('generate_questions')}
                        className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline"
                      >
                        后台生成
                      </button>
                    </div>
                  </div>
                  
                  {/* Related Nodes Section */}
                  <div className="mt-4 pt-4 border-t border-purple-200">
                     <div className="flex justify-between items-center mb-2">
                       <h5 className="text-xs font-bold text-purple-700">🔗 语义相关节点</h5>
                       {!showRelatedSection && (
                         <button 
                           onClick={handleFetchRelatedNodes}
                           className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition-colors"
                         >
                           查找关联
                         </button>
                       )}
                     </div>
                     
                     {showRelatedSection && (
                       <div className="space-y-2">
                         {isRelatedLoading ? (
                           <div className="flex items-center justify-center py-4 text-purple-400">
                             <Loader2 size={16} className="animate-spin mr-2" />
                             <span className="text-xs">分析中...</span>
                           </div>
                         ) : relatedNodes.length > 0 ? (
                           relatedNodes.map(node => (
                             <button
                               key={node.id}
                               onClick={() => handleNodeClick(node)}
                               className="w-full text-left p-2 bg-white/60 hover:bg-white border border-purple-100 rounded text-xs transition-all flex items-center justify-between group"
                             >
                               <span className="truncate flex-1 text-gray-700 group-hover:text-purple-700">{node.title}</span>
                               <span className="text-[10px] text-purple-400 bg-purple-50 px-1 rounded ml-2">{(node.similarity * 100).toFixed(0)}%</span>
                             </button>
                           ))
                         ) : (
                           <div className="text-center py-2 text-xs text-purple-400 italic">
                             未发现显著相关的其他节点
                           </div>
                         )}
                       </div>
                     )}
                  </div>
                </section>
              </div>

              <div className="pt-6 border-t border-gray-100 mt-auto flex space-x-2">
                <button
                  onClick={() => {
                    setPrevSidebarMode(sidebarMode);
                    setSidebarMode('edit');
                  }}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 flex items-center justify-center font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  <Edit3 size={18} className="mr-2" />
                  编辑节点
                </button>
                <button
                  onClick={() => handleDeleteNode()}
                  className="w-12 bg-white text-red-500 border border-red-100 rounded-xl hover:bg-red-50 flex items-center justify-center transition-all"
                  title="删除节点"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ) : (
             <>
               <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center space-x-2">
                   {prevSidebarMode === 'outline' && (sidebarMode === 'edit' || sidebarMode === 'create') && (
                     <button 
                       onClick={() => {
                         setSidebarMode('outline');
                         setPrevSidebarMode('none');
                       }}
                       className="mr-1 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                       title="返回大纲"
                     >
                       <ArrowLeft size={18} />
                     </button>
                   )}
                   <div className={`w-3 h-3 rounded-full ${sidebarMode === 'create' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                   <h3 className="text-lg font-bold text-gray-800">
                     {sidebarMode === 'create' ? '创建新节点' : '编辑节点'}
                   </h3>
                 </div>
                 <button onClick={handleCloseSidebar} className="text-gray-500 hover:text-gray-700">
                   <X size={20} />
                 </button>
               </div>
     
               <div className="space-y-4 flex-1">
                 <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
              <input
                type="text"
                value={nodeForm.title}
                onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="输入节点标题"
              />
            </div>

            {/* Parent Node Selection */}
            {(sidebarMode === 'create' || sidebarMode === 'edit') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">父节点 (可选)</label>
                <select
                  value={nodeForm.parentNodeId}
                  onChange={(e) => {
                    const parentId = e.target.value;
                    const parentNode = nodes.find(n => n.id === parentId);
                    const parentLevel = parentNode ? (parentNode.level || 'leaf') : 'leaf';
                    const newLevel = parentId ? getNextLevel(parentLevel) : 'root';
                    const config = LEVEL_CONFIG[newLevel];
                    
                    setNodeForm({ 
                      ...nodeForm, 
                      parentNodeId: parentId,
                      level: newLevel,
                      color: config ? config.color : nodeForm.color
                    });
                  }}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">无 (作为根节点)</option>
                  {nodes
                    .filter(node => !selectedNode || node.id !== selectedNode.id) // Avoid self-reference
                    .map(node => (
                    <option key={node.id} value={node.id}>{node.title}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Level Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">节点等级</label>
              <select
                value={nodeForm.level}
                onChange={(e) => {
                  const newLevel = e.target.value as NodeLevel;
                  const config = LEVEL_CONFIG[newLevel];
                  setNodeForm({ 
                    ...nodeForm, 
                    level: newLevel,
                    color: config ? config.color : nodeForm.color
                  });
                }}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="root">🟣 根节点 (Root)</option>
                <option value="core">🔴 核心节点 (Core)</option>
                <option value="sub">🟠 次级节点 (Sub)</option>
                <option value="normal">🟢 普通节点 (Normal)</option>
                <option value="leaf">🔵 叶子节点 (Leaf)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">颜色标记</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={nodeForm.color}
                  onChange={(e) => setNodeForm({ ...nodeForm, color: e.target.value })}
                  className="h-10 w-20 p-1 border border-gray-300 rounded-md cursor-pointer"
                />
                <span className="text-xs text-gray-500">点击选择颜色</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">详细内容</label>
              <textarea
                value={nodeForm.content}
                onChange={(e) => setNodeForm({ ...nodeForm, content: e.target.value })}
                rows={8}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="输入节点详细描述..."
              />
            </div>

            {/* AI Assistant Section */}
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
              <h4 className="font-semibold mb-2 flex items-center text-purple-700 text-sm">
                <Wand2 size={16} className="mr-2" />
                AI 助手
              </h4>
              <div className="space-y-2">
                <button
                  onClick={handleAIGenerate}
                  disabled={loading || !nodeForm.title}
                  className="w-full bg-white text-purple-600 border border-purple-200 py-2 rounded hover:bg-purple-50 text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? '生成中...' : '生成内容描述'}
                </button>
                {sidebarMode === 'edit' && (
                  <>
                    <button
                      onClick={handleAIExpand}
                      disabled={loading}
                      className="w-full bg-white text-green-600 border border-green-200 py-2 rounded hover:bg-green-50 text-sm transition-colors disabled:opacity-50"
                    >
                      {loading ? '拓展中...' : '智能拓展 (无限模式)'}
                    </button>
                    <button
                      onClick={handleAIGenerateCards}
                      disabled={loading}
                      className="w-full bg-white text-indigo-600 border border-indigo-200 py-2 rounded hover:bg-indigo-50 text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      <GraduationCap size={16} className="mr-2" />
                      {loading ? '生成中...' : '生成复习卡片'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Smart Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <h4 className="font-semibold mb-2 flex items-center text-blue-700 text-sm">
                  <Navigation size={16} className="mr-2" />
                  智能关联建议
                </h4>
                <div className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="bg-white p-2 rounded border border-blue-50 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-700">{rec.node_title}</span>
                        <button 
                          onClick={() => {
                            if (sidebarMode === 'create') {
                              const parentNode = nodes.find(n => n.id === rec.node_id);
                              const parentLevel = parentNode ? (parentNode.level || 'leaf') : 'leaf';
                              const nextLevel = getNextLevel(parentLevel);
                              const config = LEVEL_CONFIG[nextLevel];
                              
                              setNodeForm({ 
                                ...nodeForm, 
                                parentNodeId: rec.node_id,
                                level: nextLevel,
                                color: config ? config.color : nodeForm.color
                              });
                              addMessage({ type: 'success', content: `已设为父节点，等级自动调整为: ${nextLevel}` });
                            } else if (selectedNode) {
                              createEdgeMutation.mutate({
                                source_node_id: rec.node_id,
                                target_node_id: selectedNode.id,
                                relationship_type: 'related',
                                graphId: id
                              });
                              addMessage({ type: 'success', content: '已建立关联' });
                            }
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          {sidebarMode === 'create' ? '设为父节点' : '建立关联'}
                        </button>
                      </div>
                      <p className="text-gray-500 italic">"{rec.reason}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isRecommending && (
               <div className="text-center py-2">
                 <div className="animate-pulse text-xs text-blue-400">正在寻找关联建议...</div>
               </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-200 mt-4 flex space-x-2">
            <button
              onClick={handleSaveNode}
              disabled={loading || !nodeForm.title}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 flex items-center justify-center font-bold shadow-lg shadow-blue-100 transition-all disabled:opacity-50"
            >
              <Save size={18} className="mr-2" />
              {sidebarMode === 'create' ? '创建节点' : '完成编辑'}
            </button>
            {sidebarMode === 'edit' && (
              <>
                <button
                  onClick={() => setSidebarMode('detail')}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all"
                >
                  取消
                </button>
                {selectedNode && (
                  <button
                    onClick={() => handleDeleteNode()}
                    className="w-12 bg-white text-red-500 border border-red-100 rounded-xl hover:bg-red-50 flex items-center justify-center transition-all"
                    title="删除节点"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </>
            )}
          </div>
          </>
        )}
        </div>
        </ErrorBoundary>
      )}
    </div>
  );
};

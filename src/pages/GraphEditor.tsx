import React, { useEffect, useState, useRef, useMemo, lazy, Suspense, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { type Graph3DRef, type Graph3DProps } from '../components/Graph3D';
import { Node, Edge } from '../types';

// Lazy load heavy 3D component
// Cast the lazy loaded component to proper type including ref
const Graph3D = lazy(() => import('../components/Graph3D').then(module => ({ default: module.Graph3D }))) as unknown as React.ForwardRefExoticComponent<Graph3DProps & React.RefAttributes<Graph3DRef>>;
import { getLevel, getNextLevel, findShortestPath, NodeLevel } from '../lib/graphUtils';
import { LEVEL_CONFIG } from '../config/graphConfig';
import { Save, Plus, Wand2, Download, Trash2, ArrowLeft, Grid, X, Sun, Moon, Search, Navigation, GraduationCap, List, Undo, Redo, Maximize, Minimize, Sparkles, FileText, FileJson, Image, MessageSquare, Edit3, Eraser, Settings, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import toast from 'react-hot-toast';
import { generateMarkdown, generateJSON, downloadFile, downloadImage } from '../utils/exportUtils';
import { preprocessMarkdown } from '../utils/markdownUtils';
import { GraphOutline } from '../components/GraphEditor/GraphOutline';
import { TextToGraphModal } from '../components/GraphEditor/TextToGraphModal';
import { GraphSettingsModal } from '../components/GraphEditor/GraphSettingsModal';
import { ChatDialog } from '../components/GraphEditor/ChatDialog';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useHistory } from '../hooks/useHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.tsx';
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
  useAIGenerateMutation,
  useAIExpandMutation,
  useAIGenerateCardsMutation,
  useCreateCardsBatchMutation,
  useExportGraphMutation,
  useDocumentToGraphMutation,
  useRecommendConnectionsMutation,
  useDeleteGraphMutation,
  useGraphNodeStatus,
  queryKeys
} from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // useStore kept only for user/token if needed, or if we want to sync global state for other components
  // But for this page, we rely on React Query
  // const { nodes, edges, setNodes, setEdges, addNode, updateNode, removeNode, addEdge } = useStore();
  
  // React Query Hooks
  const { data: graphMeta } = useGraph(id || '');
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || '');
  const { data: nodeStatus } = useGraphNodeStatus(id || '');
  
  const createNodeMutation = useCreateNodeMutation();
  const updateNodeMutation = useUpdateNodeOptimisticMutation();
  const deleteNodeMutation = useDeleteNodeMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const aiGenerateMutation = useAIGenerateMutation();
  const aiExpandMutation = useAIExpandMutation();
  const aiGenerateCardsMutation = useAIGenerateCardsMutation();
  const createCardsBatchMutation = useCreateCardsBatchMutation();
  const documentToGraphMutation = useDocumentToGraphMutation();
  const recommendConnectionsMutation = useRecommendConnectionsMutation();
  const deleteGraphMutation = useDeleteGraphMutation();

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // State
  const graphRef = useRef<Graph3DRef>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isEngineLoading, setIsEngineLoading] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<'none' | 'create' | 'edit' | 'outline' | 'detail'>('none');
  const [showGrid, setShowGrid] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [loading, setLoading] = useState(false); // For non-query loading (e.g. AI)
  // const [graphTitle, setGraphTitle] = useState(''); // Use graphMeta.title

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Layout & Clustering State
  const [layoutMode, setLayoutMode] = useState<'3d-force' | '2d-tree' | '3d-sphere'>('3d-force');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  // Filter nodes based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.title.toLowerCase().includes(query) || 
      (node.content && node.content.toLowerCase().includes(query))
    ).slice(0, 10); // Limit to 10 results
  }, [nodes, searchQuery]);

  const pulsingNodeIds = useMemo(() => {
    return new Set(searchResults.map(n => n.id));
  }, [searchResults]);

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

  // Fetch recommendations when title changes
  useEffect(() => {
    // Don't recommend for default "New Node" title or empty/short titles
    if (!nodeForm.title || 
        nodeForm.title.length < 2 || 
        nodeForm.title === '新节点' || 
        !id) {
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
      } finally {
        setIsRecommending(false);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(recommendTimeoutRef.current);
  }, [nodeForm.title, nodeForm.content, id]);

  // Stabilize history handlers
  const handleCreateNodeHistory = useCallback((data: any) => createNodeMutation.mutateAsync(data), [createNodeMutation]);
  const handleUpdateNodeHistory = useCallback((params: any) => updateNodeMutation.mutateAsync(params), [updateNodeMutation]);
  const handleDeleteNodeHistory = useCallback((params: any) => deleteNodeMutation.mutateAsync(params), [deleteNodeMutation]);

  // History Hook
  const { undo, redo, record, canUndo, canRedo } = useHistory({
    createNode: handleCreateNodeHistory,
    updateNode: handleUpdateNodeHistory,
    deleteNode: handleDeleteNodeHistory
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
      setNodeForm({
        title: selectedNode.title,
        content: selectedNode.content || '',
        color: selectedNode.color || '#3B82F6',
        parentNodeId: '',
        level: getLevel(selectedNode, edges)
      });
    }
  }, [selectedNode, sidebarMode, edges]); // Added edges dependency

  // BFS algorithm for shortest path (unweighted graph)
  // const findShortestPath = ... (Removed, imported from utils)

  const handleStartCreate = () => {
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
      toast.error('此节点尚未解锁！请先学习前置知识点。', { icon: '🔒' });
      return;
    }

    if (isPathfindingMode) {
      if (!pathStartNode) {
        setPathStartNode(node);
        toast('请选择终点节点', { icon: '📍' });
      } else if (!pathEndNode) {
        setPathEndNode(node);
        const path = findShortestPath(nodes, edges, pathStartNode.id, node.id);
        if (path.nodes.size > 0) {
          setHighlightedPath(path);
          toast.success(`找到路径，长度: ${path.nodes.size - 1} 步`);
        } else {
          toast.error('未找到路径');
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
    toast.success(`切换至 ${mode === '2d-tree' ? '2D 树状图' : mode === '3d-sphere' ? '3D 球形布局' : '3D 力导向'}`, {
        icon: '👀',
    });
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
    setSidebarMode('none');
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
          await createEdgeMutation.mutateAsync({
            source_node_id: nodeForm.parentNodeId,
            target_node_id: newNode.id,
            relationship_type: 'related',
            graphId: id
          });
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

        // Update Node
        const updated = await updateNodeMutation.mutateAsync({
          id: selectedNode.id,
          data: updateData,
          graphId: id
        });
        
        // Record history
        record({
          type: 'UPDATE_NODE',
          payload: {
            id: selectedNode.id,
            before: beforeState,
            after: updateData
          }
        });
        
        // Update selected node state to prevent stale history
        setSelectedNode(updated);
        setSidebarMode('edit');
      }
      toast.success(sidebarMode === 'create' ? '节点创建成功' : '节点保存成功');
    } catch (err) {
      console.error(err);
      toast.error('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = (nodeToDelete: Node | null = selectedNode) => {
    if (!nodeToDelete || !id) return;
    
    setConfirmModal({
      isOpen: true,
      title: '删除节点',
      message: `确定要删除节点 "${nodeToDelete.title}" 吗?`,
      onConfirm: () => {
        deleteNodeMutation.mutate({ id: nodeToDelete.id, graphId: id }, {
          onSuccess: () => {
            // If we deleted the currently selected node, clear selection
            if (selectedNode?.id === nodeToDelete.id) {
              handleCloseSidebar();
            }
            toast.success('节点已删除');
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          },
          onError: (err) => {
            console.error(err);
            toast.error('删除失败');
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        });
      }
    });
  };

  const handleBatchDelete = () => {
    if (!id || selectedNodeIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: '批量删除',
      message: `确定要删除选中的 ${selectedNodeIds.size} 个节点吗?`,
      onConfirm: () => {
        setLoading(true);
        const nodeIds = Array.from(selectedNodeIds);
        
        // Execute in parallel and wait for all to complete
        Promise.all(nodeIds.map(nodeId => 
          deleteNodeMutation.mutateAsync({ id: nodeId, graphId: id })
        )).then(() => {
          setSelectedNodeIds(new Set());
          setSelectedNode(null);
          setSidebarMode('none');
          toast.success('批量删除成功');
        }).catch((err) => {
          console.error(err);
          toast.error('批量删除失败');
        }).finally(() => {
          setLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        });
      }
    });
  };

  const handleAIGenerate = async () => {
    if (!nodeForm.title) return;
    setLoading(true);
    // Reset content for streaming
    setNodeForm(prev => ({ ...prev, content: '' }));
    
    try {
      await api.ai.generateContentStream(
        { topic: nodeForm.title, context: aiPrompt },
        (chunk) => {
          setNodeForm(prev => ({ 
            ...prev, 
            content: (prev.content || '') + chunk 
          }));
        }
      );
      setAiPrompt('');
      toast.success('AI 内容生成完成');
    } catch (err) {
      console.error(err);
      toast.error('AI 生成失败');
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

      const res = await aiExpandMutation.mutateAsync({ node_title: selectedNode.title });
      const suggestions = res.suggestions;
      
      for (const s of suggestions) {
        // Generate new nodes closer to parent to avoid large layout shifts
        // Use a smaller radius (2 instead of 10)
        const x = Math.round(selectedNode.x_position + (Math.random() - 0.5) * 2);
        const y = Math.round(selectedNode.y_position + (Math.random() - 0.5) * 2);
        
        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: s.title,
          content: s.content,
          x_position: x,
          y_position: y,
          color: '#10B981', // Green for AI generated
          level: newLevel,
          properties: {}
        });
        
        // Record history
        record({ type: 'CREATE_NODE', payload: newNode });

        await createEdgeMutation.mutateAsync({
          source_node_id: selectedNode.id,
          target_node_id: newNode.id,
          relationship_type: 'related',
          graphId: id
        });
      }
    } catch (err) {
      console.error(err);
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
        toast.error('AI 未能生成有效的卡片');
        return;
      }

      // 2. Save Cards
      await createCardsBatchMutation.mutateAsync(cards);
      toast.success(`成功生成并保存了 ${cards.length} 张复习卡片！`);
      
      // Invalidate status to update mastery
      queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(id) });
    } catch (err) {
      console.error(err);
      toast.error('生成卡片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartLevelTest = () => {
    if (!selectedNode) return;
    navigate(`/study?node_id=${selectedNode.id}`);
  };

  const handleSearchResultClick = (node: Node) => {
    graphRef.current?.focusNode(node.id);
    setSelectedNode(node);
    setSidebarMode('edit');
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleExportJSON = async () => {
    if (!graphMeta) return;
    try {
      const json = generateJSON(graphMeta, nodes, edges);
      downloadFile(json, `${graphMeta.title}_backup.json`, 'application/json');
      toast.success('JSON 导出成功');
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('导出失败');
    }
  };

  const handleExportMarkdown = async () => {
    if (!graphMeta) return;
    try {
      const md = generateMarkdown(graphMeta, nodes, edges);
      downloadFile(md, `${graphMeta.title}.md`, 'text/markdown');
      toast.success('Markdown 导出成功');
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('导出失败');
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
            toast.success('图谱已删除');
            navigate('/dashboard');
            // No need to close modal as we navigate away
          },
          onError: (err: any) => {
            console.error(err);
            toast.error(err.message || '删除失败');
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
      toast.success('图片导出成功');
    } catch (error) {
      console.error('Export image failed:', error);
      toast.error('图片导出失败');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Removed handleFileUpload as it's now integrated into TextToGraphModal

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
            pulsingNodeIds={pulsingNodeIds}
            lockedNodeIds={lockedNodeIds}
            masteredNodeIds={masteredNodeIds}
            onNodeCollapse={handleToggleCollapse}
          />
        </Suspense>

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

      {/* Batch Actions Toolbar */}
      {selectedNodeIds.size > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-xl border border-blue-100 flex items-center space-x-4 z-20 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="font-medium text-gray-700">已选择 {selectedNodeIds.size} 个节点</span>
          <div className="w-px h-4 bg-gray-300"></div>
          <button 
            onClick={handleBatchDelete}
            className="flex items-center space-x-1 text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
          >
            <Trash2 size={18} />
            <span>批量删除</span>
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
      {!isFocusMode && (
      <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-md flex items-center space-x-2 z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="p-1 hover:bg-gray-100 rounded text-gray-600" 
          title="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <h2 className="font-bold px-2 py-1 max-w-[200px] truncate">{graphMeta?.title || 'Loading...'}</h2>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        
        <button 
          onClick={undo} 
          disabled={!canUndo}
          className={`p-1 rounded transition-colors ${canUndo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300'}`} 
          title="撤销 (Ctrl+Z)"
        >
          <Undo size={20} />
        </button>
        <button 
          onClick={redo} 
          disabled={!canRedo}
          className={`p-1 rounded transition-colors ${canRedo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300'}`} 
          title="重做 (Ctrl+Shift+Z)"
        >
          <Redo size={20} />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <button 
          onClick={() => setSidebarMode(sidebarMode === 'outline' ? 'none' : 'outline')} 
          className={`p-1 rounded transition-colors ${sidebarMode === 'outline' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} 
          title="大纲视图"
        >
          <List size={20} />
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-1 rounded transition-colors ${isSearchOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
            title="搜索节点"
          >
            <Search size={20} />
          </button>
          
          {isSearchOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white shadow-xl rounded-lg border border-gray-200 w-64 p-3 z-50">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索节点..."
                className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                autoFocus
              />
              {searchResults.length > 0 ? (
                <ul className="max-h-60 overflow-y-auto custom-scrollbar">
                  {searchResults.map(node => (
                    <li 
                      key={node.id}
                      onClick={() => handleSearchResultClick(node)}
                      className="p-2 hover:bg-gray-50 cursor-pointer text-sm rounded-md flex items-center transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: node.color || '#3B82F6' }}></div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate font-medium text-gray-700">{node.title}</span>
                        {node.content && <span className="truncate text-xs text-gray-400">{node.content}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : searchQuery && (
                <div className="text-gray-400 text-xs text-center py-4">未找到匹配的节点</div>
              )}
            </div>
          )}
        </div>

        <button 
          onClick={() => setIsTextToGraphOpen(true)}
          className="p-1 hover:bg-gray-100 rounded text-purple-600"
          title="AI 文本/文档生成图谱"
        >
          <Sparkles size={20} />
        </button>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`p-1 rounded transition-colors ${isChatOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-purple-600'}`}
          title="图谱助手"
        >
          <MessageSquare size={20} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <button 
          onClick={handleStartCreate} 
          className="p-1 hover:bg-gray-100 rounded text-blue-600" 
          title="添加节点"
        >
          <Plus size={20} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <button 
          onClick={() => {
            setIsDeleteMode(!isDeleteMode);
            // Disable other modes
            if (!isDeleteMode) {
               setIsPathfindingMode(false);
               setIsFocusMode(false);
            }
          }}
          className={`p-1 rounded transition-colors ${isDeleteMode ? 'bg-red-50 text-red-600 ring-2 ring-red-200' : 'hover:bg-gray-100 text-gray-600'}`}
          title={isDeleteMode ? "退出删除模式" : "删除模式 (点击节点直接删除)"}
        >
          <Eraser size={20} />
        </button>

        <button 
          onClick={() => {
            if (selectedNodeIds.size > 1) {
              handleBatchDelete();
            } else if (selectedNodeIds.size === 1) {
              handleDeleteNode();
            }
          }}
          disabled={selectedNodeIds.size === 0}
          className={`p-1 rounded transition-colors ${selectedNodeIds.size > 0 ? 'hover:bg-red-50 text-red-600' : 'text-gray-300 cursor-not-allowed'}`}
          title={selectedNodeIds.size > 1 ? "批量删除" : "删除选中节点"}
        >
          <Trash2 size={20} />
        </button>
        
        <button 
          onClick={() => {
            setIsPathfindingMode(!isPathfindingMode);
            // Reset path state when toggling
            setPathStartNode(null);
            setPathEndNode(null);
            setHighlightedPath(null);
          }} 
          className={`p-1 rounded ${isPathfindingMode ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} 
          title={isPathfindingMode ? "退出路径导航" : "路径导航"}
        >
          <Navigation size={20} />
        </button>

        <button 
          onClick={() => setShowGrid(!showGrid)} 
          className={`p-1 rounded ${showGrid ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} 
          title={showGrid ? "隐藏网格" : "显示网格"}
        >
          <Grid size={20} />
        </button>

        <button 
          onClick={() => setIsSettingsOpen(true)}
          className={`p-1 hover:bg-gray-100 rounded text-gray-600 ${isSettingsOpen ? 'bg-blue-50 text-blue-600' : ''}`}
          title="图谱设置"
        >
          <Settings size={20} />
        </button>

        {/* Layout Switcher */}
        <div className="h-6 w-px bg-gray-300 mx-1"></div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button 
            onClick={() => handleLayoutChange('3d-force')}
            className={`p-1 rounded text-xs font-medium transition-all ${layoutMode === '3d-force' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="3D 力导向"
          >
            3D
          </button>
          <button 
            onClick={() => handleLayoutChange('2d-tree')}
            className={`p-1 rounded text-xs font-medium transition-all ${layoutMode === '2d-tree' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="2D 树状图"
          >
            树
          </button>
          <button 
            onClick={() => handleLayoutChange('3d-sphere')}
            className={`p-1 rounded text-xs font-medium transition-all ${layoutMode === '3d-sphere' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="3D 球形布局"
          >
            球
          </button>
        </div>
        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        <button 
          onClick={() => setIsDark(!isDark)} 
          className="p-1 hover:bg-gray-100 rounded text-gray-600" 
          title={isDark ? "切换亮色模式" : "切换暗色模式"}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <button 
          onClick={() => setIsFocusMode(true)}
          className="p-1 hover:bg-gray-100 rounded text-gray-600" 
          title="专注模式 (F)"
        >
          <Maximize size={20} />
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className={`p-1 rounded transition-colors ${isExportMenuOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} 
            title="导出"
          >
            <Download size={20} />
          </button>

          {isExportMenuOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white shadow-xl rounded-lg border border-gray-200 w-48 py-1 z-50">
              <button
                onClick={handleExportMarkdown}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <FileText size={16} />
                <span>导出 Markdown</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <FileJson size={16} />
                <span>导出 JSON (备份)</span>
              </button>
              <button
                onClick={handleExportImage}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <Image size={16} />
                <span>导出为图片</span>
              </button>
              <div className="h-px bg-gray-100 my-1"></div>
              <button
                onClick={handleDeleteGraph}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <Trash2 size={16} />
                <span>删除此图谱</span>
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Focus Mode Exit Button */}
      {isFocusMode && (
        <div className="absolute top-4 left-4 z-50">
          <button 
            onClick={() => setIsFocusMode(false)}
            className="p-2 bg-white/20 hover:bg-white/90 text-white hover:text-gray-800 rounded-full backdrop-blur-sm transition-all shadow-sm"
            title="退出专注模式 (Esc)"
          >
            <Minimize size={20} />
          </button>
        </div>
      )}

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
      
      {/* Right Sidebar */}
      {sidebarMode !== 'none' && (
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
                 onNodeClick={handleNodeClick} 
                 selectedNodeId={selectedNode?.id}
                 className="h-full"
               />
             </div>
          ) : sidebarMode === 'detail' && selectedNode ? (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-2">
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
                    className={`w-full py-3 rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 ${
                      nodeStatus?.[selectedNode.id]?.mastered 
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                    }`}
                  >
                    <Sparkles size={18} className="mr-2" />
                    {nodeStatus?.[selectedNode.id]?.mastered ? '再次复习关卡' : '进入关卡测验'}
                  </button>
                </section>

                {/* AI Assistant in Detail Mode */}
                <section className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center">
                    <Wand2 size={14} className="mr-1.5" />
                    AI 深度探索
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleAIExpand}
                      disabled={loading}
                      className="bg-white text-purple-600 border border-purple-200 py-2 rounded-lg hover:bg-purple-100 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
                    >
                      {loading ? '扩展中...' : '发现新关联'}
                    </button>
                    <button
                      onClick={handleAIGenerateCards}
                      disabled={loading}
                      className="bg-white text-indigo-600 border border-indigo-200 py-2 rounded-lg hover:bg-indigo-100 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
                    >
                      {loading ? '生成中...' : '生成复习卡片'}
                    </button>
                  </div>
                </section>
              </div>

              <div className="pt-6 border-t border-gray-100 mt-auto flex space-x-2">
                <button
                  onClick={() => setSidebarMode('edit')}
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
                   <div className="w-3 h-3 rounded-full bg-blue-500"></div>
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
            {sidebarMode === 'create' && (
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
                  {nodes.map(node => (
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
                      {loading ? '扩展中...' : '发现新关联'}
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
                              toast.success(`已设为父节点，等级自动调整为: ${nextLevel}`);
                            } else if (selectedNode) {
                              createEdgeMutation.mutate({
                                source_node_id: rec.node_id,
                                target_node_id: selectedNode.id,
                                relationship_type: 'related',
                                graphId: id
                              });
                              toast.success('已建立关联');
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
      )}
    </div>
  );
};

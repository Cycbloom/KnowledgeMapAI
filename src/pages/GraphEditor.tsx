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
import { Save, Plus, Wand2, Download, Trash2, ArrowLeft, Grid, X, Sun, Moon, Search, Navigation, GraduationCap, List, Undo, Redo, Maximize, Minimize, Sparkles, FileText, FileJson, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateMarkdown, generateJSON, downloadFile, downloadImage } from '../utils/exportUtils';
import { GraphOutline } from '../components/GraphEditor/GraphOutline';
import { TextToGraphModal } from '../components/GraphEditor/TextToGraphModal';
import { useHistory } from '../hooks/useHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.tsx';
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
  useExportGraphMutation
} from '../hooks/useQueries';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // useStore kept only for user/token if needed, or if we want to sync global state for other components
  // But for this page, we rely on React Query
  // const { nodes, edges, setNodes, setEdges, addNode, updateNode, removeNode, addEdge } = useStore();
  
  // React Query Hooks
  const { data: graphMeta } = useGraph(id || '');
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || '');
  
  const createNodeMutation = useCreateNodeMutation();
  const updateNodeMutation = useUpdateNodeOptimisticMutation();
  const deleteNodeMutation = useDeleteNodeMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const aiGenerateMutation = useAIGenerateMutation();
  const aiExpandMutation = useAIExpandMutation();
  const aiGenerateCardsMutation = useAIGenerateCardsMutation();
  const createCardsBatchMutation = useCreateCardsBatchMutation();

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // State
  const graphRef = useRef<Graph3DRef>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isEngineLoading, setIsEngineLoading] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<'none' | 'create' | 'edit' | 'outline'>('none');
  const [showGrid, setShowGrid] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [loading, setLoading] = useState(false); // For non-query loading (e.g. AI)
  // const [graphTitle, setGraphTitle] = useState(''); // Use graphMeta.title

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter nodes based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.title.toLowerCase().includes(query) || 
      (node.content && node.content.toLowerCase().includes(query))
    ).slice(0, 10); // Limit to 10 results
  }, [nodes, searchQuery]);

  // Pathfinding State
  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);
  const [exportImageOptions, setExportImageOptions] = useState({
    transparent: false,
    fitView: true,
    hideGrid: true
  });

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
    setSidebarMode('edit');
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
          properties: { level: nodeForm.level }
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
          properties: selectedNode.properties
        };

        const updateData = {
          graph_id: selectedNode.graph_id,
          title: nodeForm.title,
          content: nodeForm.content,
          color: nodeForm.color,
          properties: { ...selectedNode.properties, level: nodeForm.level }
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

  const handleDeleteNode = async () => {
    if (!selectedNode || !id) return;
    if (!confirm('确定要删除这个节点吗?')) return;
    try {
      await deleteNodeMutation.mutateAsync({ id: selectedNode.id, graphId: id });
      handleCloseSidebar();
      toast.success('节点已删除');
    } catch (err) {
      console.error(err);
      toast.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!id || selectedNodeIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedNodeIds.size} 个节点吗?`)) return;
    
    try {
      setLoading(true);
      const nodeIds = Array.from(selectedNodeIds);
      // Execute in parallel
      await Promise.all(nodeIds.map(nodeId => 
        deleteNodeMutation.mutateAsync({ id: nodeId, graphId: id })
      ));
      
      setSelectedNodeIds(new Set());
      setSelectedNode(null);
      setSidebarMode('none');
      toast.success('批量删除成功');
    } catch (err) {
      console.error(err);
      toast.error('批量删除失败');
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
          properties: { level: newLevel }
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
        alert('AI 未能生成有效的卡片');
        return;
      }

      // 2. Save Cards
      await createCardsBatchMutation.mutateAsync(cards);
      toast.success(`成功生成并保存了 ${cards.length} 张复习卡片！可以在“学习模式”中查看。`);
    } catch (err) {
      console.error(err);
      toast.error('生成卡片失败');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="flex h-full relative">
      {/* 3D Canvas */}
      <div className="flex-1 h-full relative">
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
            onBackgroundClick={handleBackgroundClick}
          />
        </Suspense>
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
          title="AI 文本生成图谱"
        >
          <Sparkles size={20} />
        </button>

        <button 
          onClick={handleStartCreate} 
          className="p-1 hover:bg-gray-100 rounded text-blue-600" 
          title="添加节点"
        >
          <Plus size={20} />
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
          ) : (
             <>
               <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-lg">
                   {sidebarMode === 'create' ? '创建新节点' : '编辑节点'}
                 </h3>
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
                    let newLevel = nodeForm.level;
                    
                    // Auto-suggest level based on parent
                    if (parentId) {
                      const parent = nodes.find(n => n.id === parentId);
                      if (parent) {
                        const parentLevel = getLevel(parent, edges);
                        newLevel = getNextLevel(parentLevel);
                      }
                    } else {
                      newLevel = 'root';
                    }

                    setNodeForm({ 
                      ...nodeForm, 
                      parentNodeId: parentId,
                      level: newLevel
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
                onChange={(e) => setNodeForm({ ...nodeForm, level: e.target.value as NodeLevel })}
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
                      {loading ? '扩展中...' : '扩展相关节点'}
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
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
            <button
              onClick={handleSaveNode}
              disabled={loading || !nodeForm.title}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 flex items-center justify-center font-medium shadow-sm disabled:opacity-50"
            >
              <Save size={18} className="mr-2" />
              {sidebarMode === 'create' ? '创建节点' : '保存修改'}
            </button>
            
            {sidebarMode === 'edit' && (
              <button
                onClick={handleDeleteNode}
                className="w-full bg-white text-red-600 border border-red-200 py-2 rounded-md hover:bg-red-50 flex items-center justify-center text-sm"
              >
                <Trash2 size={16} className="mr-2" />
                删除节点
              </button>
            )}
          </div>
          </>
        )}
        </div>
      )}
    </div>
  );
};

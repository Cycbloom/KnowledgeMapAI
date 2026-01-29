import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Graph3D, Graph3DRef } from '../components/Graph3D';
import { Node, Edge } from '../types';
import { getLevel, getNextLevel, findShortestPath, NodeLevel } from '../lib/graphUtils';
import { Save, Plus, Wand2, Download, Trash2, ArrowLeft, Grid, X, Sun, Moon, Search, Navigation, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
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
  const exportGraphMutation = useExportGraphMutation();

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // State
  const graphRef = useRef<Graph3DRef>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'none' | 'create' | 'edit'>('none');
  const [showGrid, setShowGrid] = useState(true);
  const [isDark, setIsDark] = useState(true);
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
    setSidebarMode('edit');
  };

  const handleCloseSidebar = () => {
    setSidebarMode('none');
    setSelectedNode(null);
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

        // Switch to edit mode for the new node
        setSelectedNode(newNode);
        setSidebarMode('edit');
      } else if (sidebarMode === 'edit' && selectedNode) {
        // Update Node
        const updated = await updateNodeMutation.mutateAsync({
          id: selectedNode.id,
          data: {
            title: nodeForm.title,
            content: nodeForm.content,
            color: nodeForm.color,
            properties: { ...selectedNode.properties, level: nodeForm.level }
          },
          graphId: id
        });
        
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

  const handleExport = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const blob = await exportGraphMutation.mutateAsync({ id, format: 'json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${graphMeta?.title || 'graph'}_export.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (err: any) {
      console.error(err);
      toast.error('导出失败: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full relative">
      {/* 3D Canvas */}
      <div className="flex-1 h-full relative">
        {isGraphLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
        <Graph3D 
          ref={graphRef} 
          nodes={nodes} 
          edges={edges} 
          onNodeClick={handleNodeClick} 
          showGrid={showGrid} 
          isDark={isDark}
          selectedNodeId={selectedNode?.id}
          highlightedPath={highlightedPath}
        />
      </div>

      {/* Toolbar */}
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
          onClick={handleExport}
          className="p-1 hover:bg-gray-100 rounded text-gray-600" 
          title="导出"
        >
          <Download size={20} />
        </button>
      </div>

      {/* Pathfinding Instructions */}
      {isPathfindingMode && (
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

      {/* Right Sidebar */}
      {sidebarMode !== 'none' && (
        <div className="w-80 bg-white shadow-lg border-l border-gray-200 p-4 overflow-y-auto absolute right-0 top-0 bottom-0 z-20 flex flex-col">
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
        </div>
      )}
    </div>
  );
};

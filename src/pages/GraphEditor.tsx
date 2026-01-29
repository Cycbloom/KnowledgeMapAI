import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Graph3D, Graph3DRef } from '../components/Graph3D';
import { Node, Edge } from '../types';
import { Save, Plus, Wand2, Download, Trash2, ArrowLeft, Grid, X, Sun, Moon, Search } from 'lucide-react';

// Helper to determine node level based on hierarchy
type NodeLevel = 'root' | 'core' | 'sub' | 'normal' | 'leaf';

// Helper to determine node level based on hierarchy
// Modified to prioritize existing properties over dynamic calculation
const getLevel = (node: Node, edges: Edge[]): NodeLevel => {
  // ALWAYS return the explicit level if it exists
  if (node.properties?.level) return node.properties.level as NodeLevel;
  
  // Fallback ONLY if property is missing
  const degree = edges.filter(e => e.source_node_id === node.id || e.target_node_id === node.id).length;
  if (degree >= 10) return 'root';
  if (degree >= 6) return 'core';
  if (degree >= 4) return 'sub';
  if (degree >= 2) return 'normal';
  return 'leaf';
};

const getNextLevel = (parentLevel: string): NodeLevel => {
  if (parentLevel === 'root') return 'core';
  if (parentLevel === 'core') return 'sub';
  if (parentLevel === 'sub') return 'normal';
  if (parentLevel === 'normal') return 'leaf';
  return 'leaf'; // Leaves produce leaves
};

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { nodes, edges, setNodes, setEdges, addNode, updateNode, removeNode, addEdge } = useStore();
  
  // State
  const graphRef = useRef<Graph3DRef>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'none' | 'create' | 'edit'>('none');
  const [showGrid, setShowGrid] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [loading, setLoading] = useState(false);
  const [graphTitle, setGraphTitle] = useState('');
  
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

  useEffect(() => {
    if (id) loadGraph(id);
  }, [id]);

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
  }, [selectedNode, sidebarMode]);

  const loadGraph = async (graphId: string) => {
    try {
      setLoading(true);
      const graph = await api.graphs.get(graphId);
      setGraphTitle(graph.title);
      const data = await api.graphs.getNodes(graphId);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        const newNode = await api.nodes.create({
          graph_id: id,
          title: nodeForm.title,
          content: nodeForm.content,
          // Ensure integers for DB to prevent syntax errors
          x_position: Math.round((Math.random() - 0.5) * 20),
          y_position: Math.round((Math.random() - 0.5) * 20),
          color: nodeForm.color,
          properties: { level: nodeForm.level }
        });
        addNode(newNode);

        // Create Edge if parent selected
        if (nodeForm.parentNodeId) {
          const newEdge = await api.edges.create({
            source_node_id: nodeForm.parentNodeId,
            target_node_id: newNode.id,
            relationship_type: 'related'
          });
          addEdge(newEdge);
        }

        // Switch to edit mode for the new node
        setSelectedNode(newNode);
        setSidebarMode('edit');
      } else if (sidebarMode === 'edit' && selectedNode) {
        // Update Node
        const updated = await api.nodes.update(selectedNode.id, {
          title: nodeForm.title,
          content: nodeForm.content,
          color: nodeForm.color,
          properties: { ...selectedNode.properties, level: nodeForm.level }
        });
        updateNode(selectedNode.id, updated);
        setSelectedNode(updated);
      }
    } catch (err) {
      console.error(err);
      alert('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (!confirm('确定要删除这个节点吗?')) return;
    try {
      await api.nodes.delete(selectedNode.id);
      removeNode(selectedNode.id);
      handleCloseSidebar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAIGenerate = async () => {
    if (!nodeForm.title) return;
    setLoading(true);
    try {
      const res = await api.ai.generate({ topic: nodeForm.title, context: aiPrompt });
      setNodeForm(prev => ({ ...prev, content: res.content }));
      setAiPrompt('');
    } catch (err) {
      console.error(err);
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

      const res = await api.ai.expand({ node_title: selectedNode.title });
      const suggestions = res.suggestions;
      
      for (const s of suggestions) {
        // Generate new nodes closer to parent to avoid large layout shifts
        // Use a smaller radius (2 instead of 10)
        const x = Math.round(selectedNode.x_position + (Math.random() - 0.5) * 2);
        const y = Math.round(selectedNode.y_position + (Math.random() - 0.5) * 2);
        
        const newNode = await api.nodes.create({
          graph_id: id,
          title: s.title,
          content: s.content,
          x_position: x,
          y_position: y,
          color: '#10B981', // Green for AI generated
          properties: { level: newLevel }
        });
        addNode(newNode);
        
        const newEdge = await api.edges.create({
          source_node_id: selectedNode.id,
          target_node_id: newNode.id,
          relationship_type: 'related'
        });
        addEdge(newEdge);
      }
    } catch (err) {
      console.error(err);
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

  return (
    <div className="flex h-full relative">
      {/* 3D Canvas */}
      <div className="flex-1 h-full">
        <Graph3D ref={graphRef} nodes={nodes} edges={edges} onNodeClick={handleNodeClick} showGrid={showGrid} isDark={isDark} />
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
        <h2 className="font-bold px-2 py-1 max-w-[200px] truncate">{graphTitle}</h2>
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

        <button className="p-1 hover:bg-gray-100 rounded text-gray-600" title="导出">
          <Download size={20} />
        </button>
      </div>

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
                  <button
                    onClick={handleAIExpand}
                    disabled={loading}
                    className="w-full bg-white text-green-600 border border-green-200 py-2 rounded hover:bg-green-50 text-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? '扩展中...' : '扩展相关节点'}
                  </button>
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


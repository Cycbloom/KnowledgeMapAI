import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGraphs, useCreateGraphMutation, useImportGraphMutation, useDeleteGraphMutation, useDashboardStats } from '../hooks/useQueries';
import { Plus, BookOpen, Upload, Trash2, BarChart, Settings2, Search, MoreVertical, Calendar, Share2, Activity, Network, ArrowRight } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';
import { parseMarkdownToGraph } from '../utils/markdownParser';
import { parseOpmlToGraph } from '../utils/opmlParser';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { BlindSpotList } from '../components/BlindSpotList';
import { useTheme } from '../hooks/useTheme';

export const Dashboard = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: graphsData, isLoading, error } = useGraphs();
  const { data: statsData } = useDashboardStats();
  const createGraphMutation = useCreateGraphMutation();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { addMessage } = useMessageStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: ''
  });

  const graphs = Array.isArray(graphsData) ? graphsData : [];
  
  const filteredGraphs = graphs.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      setFormError(null);
      await createGraphMutation.mutateAsync({ 
        title: newTitle,
        description: newDescription 
      });
      setNewTitle('');
      setNewDescription('');
      setIsCreating(false);
      addMessage({ type: 'success', content: '创建成功!' });
    } catch (err: any) {
      console.error(err);
      addMessage({ type: 'error', content: err.message || '创建图谱失败' });
    }
  };

  const handleDeleteGraph = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.id) return;

    deleteGraphMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        addMessage({ type: 'success', content: '图谱删除成功' });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      },
      onError: (err: any) => {
        console.error(err);
        addMessage({ type: 'error', content: err.message || '删除失败' });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let importData;

        if (file.name.endsWith('.md')) {
          const parsed = parseMarkdownToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace('.md', ''),
            nodes: parsed.nodes,
            edges: parsed.edges
          };
        } else if (file.name.endsWith('.opml')) {
          const parsed = parseOpmlToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace('.opml', ''),
            nodes: parsed.nodes,
            edges: parsed.edges
          };
        } else {
          // Assume JSON
          const data = JSON.parse(content);
          importData = {
            graph_title: data.graph?.title || data.graph_title || file.name.replace('.json', ''),
            nodes: data.nodes || [],
            edges: data.edges || []
          };
        }
        
        await importGraphMutation.mutateAsync(importData);
        addMessage({ content: '导入成功!', type: 'success' });
      } catch (err: any) {
        console.error(err);
        addMessage({ content: '导入失败: ' + (err.message || '格式错误'), type: 'error' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) return <div className={`min-h-full flex items-center justify-center p-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>正在加载图谱...</div>;
  if (error) return <div className="p-8 text-red-600">错误: {(error as Error).message || '加载图谱失败'}</div>;

  return (
    <div className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              我的知识图谱
            </h1>
            <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'} text-lg max-w-xl`}>
              构建、可视化并探索您的个性化知识网络。
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={18} />
              <input 
                type="text" 
                placeholder="搜索图谱..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all w-full md:w-64 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white' 
                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm'
                }`}
              />
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".json,.md,.opml"
            />
            
            <button
              onClick={handleImportClick}
              disabled={importGraphMutation.isPending}
              className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 border transition-all font-medium ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' 
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              } disabled:opacity-50`}
            >
              <Upload size={18} />
              <span className="hidden sm:inline">{importGraphMutation.isPending ? '导入中...' : '导入'}</span>
            </button>
            
            <button
              onClick={() => setIsCreating(true)}
              className="px-5 py-2.5 rounded-xl flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-medium active:scale-95"
            >
              <Plus size={20} />
              <span>新建图谱</span>
            </button>
          </div>
        </div>

        {/* Statistics Banner */}
        {statsData && (
          <div className={`relative overflow-hidden rounded-3xl border transition-all ${
            isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
          }`}>
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Activity size={200} />
            </div>
            
            <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start space-x-5">
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <BarChart size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>学习概览</h3>
                  <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'} max-w-lg`}>
                    您已创建 {graphs.length} 个知识图谱，包含 {graphs.reduce((acc, g) => acc + (g.nodes_count || 0), 0)} 个节点。
                    继续保持，完善您的知识体系！
                  </p>
                </div>
              </div>
              
              <Link 
                to="/statistics" 
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  isDark 
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20' 
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                查看详细分析
                <Network size={18} />
              </Link>
            </div>
            
            {/* Blind Spots Preview */}
            {statsData.blindSpots && statsData.blindSpots.length > 0 && (
              <div className={`border-t px-6 py-4 md:px-8 ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-gray-50 bg-gray-50/50'}`}>
                <BlindSpotList data={statsData.blindSpots.slice(0, 3)} />
              </div>
            )}
          </div>
        )}

        {/* Create Graph Modal/Form */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 transform transition-all scale-100 animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
            }`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">创建新图谱</h3>
                <button 
                  onClick={() => setIsCreating(false)}
                  className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${isDark ? 'hover:bg-white text-slate-400' : 'hover:bg-black text-gray-400'}`}
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>图谱名称</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例如：JavaScript 核心概念"
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                        : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>描述（可选）</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="简要描述该图谱的内容..."
                    className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                        : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    rows={4}
                  />
                </div>
                
                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                    <span className="block w-1.5 h-1.5 rounded-full bg-red-500" />
                    {formError}
                  </div>
                )}
                
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                      isDark 
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    取消
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 px-4 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={createGraphMutation.isPending || !newTitle}
                  >
                    {createGraphMutation.isPending ? '创建中...' : '立即创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Graphs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGraphs.length === 0 ? (
            <div className={`col-span-full flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed ${
              isDark ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={`p-6 rounded-full mb-4 ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-white text-gray-300'}`}>
                <Network size={48} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-900'}`}>
                {searchQuery ? '未找到相关图谱' : '开始您的知识之旅'}
              </h3>
              <p className={`text-center max-w-md mb-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                {searchQuery ? '尝试更换搜索关键词' : '创建一个新的知识图谱，或导入现有的 Markdown/JSON/OPML 文件。'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  创建第一个图谱
                </button>
              )}
            </div>
          ) : (
            filteredGraphs.map((graph, index) => (
              <div 
                key={graph.id || index} 
                className={`group relative rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                  isDark 
                    ? 'bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-xl hover:shadow-black/20' 
                    : 'bg-white border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5'
                }`}
              >
                {/* Card Content */}
                <Link to={`/learning?graph_id=${graph.id}`} className="block p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3.5 rounded-xl transition-colors ${
                      isDark 
                        ? 'bg-indigo-900/30 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white' 
                        : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}>
                      <BookOpen size={24} />
                    </div>
                    
                    {/* Hover Actions */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                      <Link
                        to={`/graph/${graph.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark 
                            ? 'text-slate-400 hover:bg-indigo-900/30 hover:text-indigo-400' 
                            : 'text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                        title="打开思维导图"
                      >
                        <Network size={18} />
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteGraph(graph.id, graph.title);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark 
                            ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' 
                            : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                        }`}
                        title="删除图谱"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className={`text-xl font-bold mb-2 line-clamp-1 group-hover:text-blue-500 transition-colors ${
                    isDark ? 'text-slate-100' : 'text-gray-900'
                  }`}>
                    {graph.title}
                  </h3>
                  
                  <p className={`text-sm line-clamp-2 mb-6 flex-grow ${
                    isDark ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                    {graph.description || '暂无描述'}
                  </p>
                  
                  <div className={`pt-4 mt-auto border-t flex items-center justify-between ${
                    isDark ? 'border-slate-700' : 'border-gray-50'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${
                        isDark ? 'text-slate-400' : 'text-gray-500'
                      }`}>
                        <Network size={14} />
                        <span>{graph.nodes_count || 0} 节点</span>
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                      isDark ? 'text-indigo-400 group-hover:text-indigo-300' : 'text-indigo-600 group-hover:text-indigo-700'
                    }`}>
                      <span>进入大纲</span>
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </div>
            ))
          )}
        </div>

        <ConfirmationModal
          isOpen={deleteConfirm.isOpen}
          title="删除图谱"
          message={`确定要删除图谱 "${deleteConfirm.title}" 吗？此操作将永久删除所有相关的节点和关系，无法撤销。`}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGraphs, useCreateGraphMutation, useImportGraphMutation, useDeleteGraphMutation, useDashboardStats, useCreateGraphFromTemplateMutation, useToggleFavoriteMutation, queryKeys } from '../hooks/useQueries';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, BookOpen, Upload, Trash2, BarChart, Search, Network, ArrowRight, Sparkles, Tag, X, Star, AlertCircle, Loader2 } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';
import { parseMarkdownToGraph } from '../utils/markdownParser';
import { parseOpmlToGraph } from '../utils/opmlParser';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TemplateSelector } from '../components/TemplateSelector';
import { AutoGraphGenerator } from '../components/AutoGraph/AutoGraphGenerator';
import { Template } from '../types';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { useTopicCheck } from '../hooks/useTopicCheck';
import { useSearch } from '../hooks/useSearch';
import { SearchResults } from '../components/SearchResults';

export const Dashboard = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { data: graphsData, isLoading, error } = useGraphs();
  const { data: statsData } = useDashboardStats();
  const createGraphMutation = useCreateGraphMutation();
  const createGraphFromTemplateMutation = useCreateGraphFromTemplateMutation();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { addMessage } = useMessageStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: ''
  });
  
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const graphsPerPage = 9;

  const { isChecking, isDuplicate, similarGraphs, checkTopic, reset: resetTopicCheck } = useTopicCheck({ debounceMs: 500 });
  const { 
    query: searchQuery, 
    setQuery: setSearchQuery, 
    mode: searchMode, 
    setMode: setSearchMode, 
    isSearching, 
    results: searchResults
  } = useSearch({ debounceMs: 300 });

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (newTitle.trim().length >= 2) {
      checkTopic(newTitle);
    } else {
      resetTopicCheck();
    }
  }, [newTitle, checkTopic, resetTopicCheck]);

  const graphs = Array.isArray(graphsData) ? graphsData : [];
  
  const filteredGraphs = useMemo(() => {
    let result = graphs;
    
    if (selectedFilterTags.length > 0) {
      result = result.filter(g => {
        const graphTags = g.tags || [];
        return selectedFilterTags.some(tag => graphTags.includes(tag));
      });
    }
    
    return result;
  }, [graphs, selectedFilterTags]);

  const totalPages = Math.ceil(filteredGraphs.length / graphsPerPage);
  const paginatedGraphs = useMemo(() => {
    const start = (currentPage - 1) * graphsPerPage;
    return filteredGraphs.slice(start, start + graphsPerPage);
  }, [filteredGraphs, currentPage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      setFormError(null);
      if (selectedTemplate) {
        await createGraphFromTemplateMutation.mutateAsync({ 
          template_id: selectedTemplate.id,
          title: newTitle,
          description: newDescription 
        });
      } else {
        await createGraphMutation.mutateAsync({ 
          title: newTitle,
          description: newDescription 
        });
      }
      setNewTitle('');
      setNewDescription('');
      setSelectedTemplate(null);
      setIsCreating(false);
      addMessage({ type: 'success', content: '创建成功!' });
    } catch (err: any) {
      console.error(err);
      addMessage({ type: 'error', content: err.message || '创建图谱失败' });
    }
  };

  const handleOpenTemplateSelector = () => {
    setIsTemplateSelectorOpen(true);
  };

  const handleSelectTemplate = (template: Template | null) => {
    setSelectedTemplate(template);
    setIsTemplateSelectorOpen(false);
    setIsCreating(true);
    if (template) {
      setNewTitle(template.name);
      setNewDescription(template.description || '');
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

  const handleToggleFavorite = (id: string, currentFavorite: boolean) => {
    toggleFavoriteMutation.mutate(
      { id, is_favorite: !currentFavorite },
      {
        onSuccess: () => {
          addMessage({ type: 'success', content: currentFavorite ? '已取消收藏' : '收藏成功' });
        },
        onError: (err: any) => {
          console.error(err);
          addMessage({ type: 'error', content: err.message || '操作失败' });
        },
      }
    );
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
        addMessage({ content: `导入失败: ${  err.message || '格式错误'}`, type: 'error' });
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
        <div className="space-y-6">
          {/* Row 1: Title + Stats Overview */}
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="space-y-1 flex-shrink-0">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                我的知识图谱
              </h1>
              <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'} text-sm md:text-base`}>
                构建、可视化并探索您的个性化知识网络。
              </p>
            </div>
            
            {/* Stats Overview - Compact */}
            {statsData && (
              <div className={`flex-1 flex items-center gap-4 px-5 py-3 rounded-xl border ${
                isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
              }`}>
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <BarChart size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    您已创建 <span className="font-semibold">{graphs.length}</span> 个知识图谱，包含 <span className="font-semibold">{graphs.reduce((acc, g) => acc + (g.nodes_count || 0), 0)}</span> 个节点。继续保持，完善您的知识体系！
                  </p>
                </div>
                <Link 
                  to="/learning-stats" 
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                    isDark 
                      ? 'bg-blue-600 text-white hover:bg-blue-500' 
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  统计
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
          
          {/* Row 2: Search + Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={18} />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="搜索图谱和节点..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                className={`w-full pl-10 pr-24 py-2.5 rounded-xl border outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white' 
                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm'
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setSearchMode('keyword')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    searchMode === 'keyword'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  关键词
                </button>
                <button
                  onClick={() => setSearchMode('semantic')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                    searchMode === 'semantic'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Sparkles size={12} />
                  语义
                </button>
              </div>
              
              {showSearchResults && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowSearchResults(false)}
                  />
                  <SearchResults
                    results={searchResults}
                    isSearching={isSearching}
                    query={searchQuery}
                    onClose={() => setShowSearchResults(false)}
                  />
                </>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
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
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm'
                } disabled:opacity-50`}
              >
                <Upload size={16} />
                <span>{importGraphMutation.isPending ? '导入中...' : '导入'}</span>
              </button>
              
              <Link
                to="/graph-map"
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 border transition-all text-sm font-medium ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm'
                }`}
              >
                <Network size={16} />
                <span>图谱地图</span>
              </Link>
              
              <button
                onClick={handleOpenTemplateSelector}
                className="px-4 py-2.5 rounded-xl flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all text-sm font-medium"
              >
                <Plus size={16} />
                <span>新建图谱</span>
              </button>
              
              <button
                onClick={() => setIsAIGeneratorOpen(true)}
                className="px-4 py-2.5 rounded-xl flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-md transition-all text-sm font-medium"
              >
                <Sparkles size={16} />
                <span>AI 生成</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tag Cloud Section */}
        <TagCloudSection 
          isDark={isDark} 
          selectedTags={selectedFilterTags}
          onTagsChange={(tags) => {
            setSelectedFilterTags(tags);
            setCurrentPage(1);
          }}
        />

        {/* Create Graph Modal/Form */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 transform transition-all scale-100 animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
            }`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{selectedTemplate ? '从模板创建图谱' : '创建新图谱'}</h3>
                <button 
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedTemplate(null);
                  }}
                  className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${isDark ? 'hover:bg-white text-slate-400' : 'hover:bg-black text-gray-400'}`}
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              {selectedTemplate && (
                <div className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-blue-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-600 text-white">
                      {selectedTemplate.name}
                    </span>
                    <span className="text-xs text-gray-500">{selectedTemplate.nodes.length} 个节点</span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                    {selectedTemplate.description || '暂无描述'}
                  </p>
                </div>
              )}
              
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-2">
                  <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>图谱名称</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="例如：JavaScript 核心概念"
                      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                        isDuplicate 
                          ? 'border-amber-500 focus:ring-amber-500' 
                          : isDark 
                            ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                            : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                      autoFocus
                    />
                    {isChecking && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  {isDuplicate && similarGraphs.length > 0 && (
                    <div className={`p-3 rounded-lg flex items-start gap-2 ${
                      isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-700'
                    }`}>
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">主题重复</p>
                        <p className="mt-1">
                          与现有图谱「{similarGraphs[0].title}」相似度为 {(similarGraphs[0].similarity * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}
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
                    onClick={() => {
                      setIsCreating(false);
                      setSelectedTemplate(null);
                      resetTopicCheck();
                    }}
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
                    disabled={createGraphMutation.isPending || createGraphFromTemplateMutation.isPending || !newTitle || isChecking || isDuplicate}
                  >
                    {createGraphMutation.isPending || createGraphFromTemplateMutation.isPending ? '创建中...' : '立即创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Template Selector Modal */}
        {isTemplateSelectorOpen && (
          <TemplateSelector
            onSelectTemplate={handleSelectTemplate}
            onCancel={() => setIsTemplateSelectorOpen(false)}
          />
        )}

        {/* AI Graph Generator Modal */}
        {isAIGeneratorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
              <AutoGraphGenerator
                onClose={() => setIsAIGeneratorOpen(false)}
                onGraphGenerated={(nodes, _edges) => {
                  setIsAIGeneratorOpen(false);
                  queryClient.invalidateQueries({ queryKey: queryKeys.graphs });
                  queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
                  addMessage({ type: 'success', content: `成功生成 ${nodes.length} 个节点！` });
                }}
              />
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
            paginatedGraphs.map((graph, index) => (
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
                    
                    <div className="flex items-center gap-2">
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
                        {!graph.is_favorite && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleFavorite(graph.id, false);
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              isDark 
                                ? 'text-slate-400 hover:bg-yellow-900/30 hover:text-yellow-400' 
                                : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-500'
                            }`}
                            title="收藏图谱"
                          >
                            <Star size={18} />
                          </button>
                        )}
                      </div>
                      
                      {/* Favorite Star - Always visible when favorited, positioned at rightmost */}
                      {graph.is_favorite && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite(graph.id, true);
                          }}
                          className="p-2 rounded-lg text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                          title="取消收藏"
                        >
                          <Star size={18} fill="currentColor" />
                        </button>
                      )}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl transition-all ${
                currentPage === 1 
                  ? 'opacity-30 cursor-not-allowed' 
                  : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                          : isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  (page === currentPage - 2 && page > 1) ||
                  (page === currentPage + 2 && page < totalPages)
                ) {
                  return <span key={page} className="px-1 text-slate-400">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-xl transition-all ${
                currentPage === totalPages 
                  ? 'opacity-30 cursor-not-allowed' 
                  : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

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

const TAG_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500'
];

const getTagColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

const TagCloudSection = ({ 
  isDark, 
  selectedTags, 
  onTagsChange 
}: { 
  isDark: boolean;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}) => {
  const [showAll, setShowAll] = useState(false);

  const { data: tagsData } = useQuery({
    queryKey: ['graphTags'],
    queryFn: async () => {
      const res = await api.graphs.getTags();
      return res.tags || [];
    }
  });

  const allTags = useMemo(() => {
    return tagsData || [];
  }, [tagsData]);

  const maxCount = useMemo(() => {
    return Math.max(...allTags.map((t: { name: string; count: number }) => t.count), 1);
  }, [allTags]);

  const displayedTags = useMemo(() => {
    return showAll ? allTags : allTags.slice(0, 20);
  }, [allTags, showAll]);

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearSelection = () => {
    onTagsChange([]);
  };

  if (!allTags || allTags.length === 0) return null;

  return (
    <div className={`rounded-2xl border p-6 ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
            <Tag size={20} />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              标签云
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              共 {allTags.length} 个标签
            </p>
          </div>
        </div>
        
        {selectedTags.length > 0 && (
          <button
            onClick={clearSelection}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isDark 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <X size={14} />
            清除筛选 ({selectedTags.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {displayedTags.map((tag: { name: string; count: number }) => {
          const isSelected = selectedTags.includes(tag.name);
          const size = 0.75 + (tag.count / maxCount) * 0.5;
          
          return (
            <button
              key={tag.name}
              onClick={() => handleTagClick(tag.name)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                transition-all hover:scale-105
                ${isSelected 
                  ? `${getTagColor(tag.name)} text-white shadow-lg` 
                  : isDark 
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
              `}
              style={{ fontSize: `${size}rem` }}
            >
              <span className="font-medium">{tag.name}</span>
              <span className={`text-xs ${isSelected ? 'text-white/80' : isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                {tag.count}
              </span>
            </button>
          );
        })}
      </div>

      {allTags.length > 20 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`mt-4 w-full py-2 rounded-xl text-sm font-medium transition-colors ${
            isDark 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {showAll ? '收起' : `查看全部 ${allTags.length} 个标签`}
        </button>
      )}
    </div>
  );
};

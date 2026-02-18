import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useMessageStore } from '../store/useMessageStore';
import { GraphMapCanvas } from '../components/GraphMap/GraphMapCanvas';
import { GraphMapToolbar } from '../components/GraphMap/GraphMapToolbar';
import { CreateRelationPanel } from '../components/GraphMap/CreateRelationPanel';
import { QuickCreateGraphPanel } from '../components/GraphMap/QuickCreateGraphPanel';
import { MapAnalysisPanel } from '../components/GraphMap/MapAnalysisPanel';
import { AIExpansionPanel } from '../components/GraphMap/AIExpansionPanel';
import { PromptEditor } from '../components/PromptEditor';
import type { Graph, GraphRelation, GraphMapFilterMode, GraphRelationType, QuickCreateGraphRequest, MapAnalysisResult, InfiniteExpansionProgress } from '../types';

export const GraphMap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { addMessage } = useMessageStore();
  
  const fromGraphId = searchParams.get('from');
  
  const [filterMode, setFilterMode] = useState<GraphMapFilterMode>('all');
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(fromGraphId);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [isCreateGraphPanelOpen, setIsCreateGraphPanelOpen] = useState(false);
  const [createGraphRelationType, setCreateGraphRelationType] = useState<GraphRelationType | undefined>(undefined);
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MapAnalysisResult | null>(null);
  const [isAIExpansionOpen, setIsAIExpansionOpen] = useState(false);
  const [expansionProgress, setExpansionProgress] = useState<InfiniteExpansionProgress | null>(null);
  const [isExpansionRunning, setIsExpansionRunning] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [promptContent, setPromptContent] = useState('');
  const [promptEditMode, setPromptEditMode] = useState<'depth' | 'width'>('width');
  const [depthPromptType, setDepthPromptType] = useState<'init' | 'expand'>('init');
  const [showPromptSelector, setShowPromptSelector] = useState(false);

  const { data: mapData, isLoading, refetch } = useQuery({
    queryKey: ['graphMap'],
    queryFn: () => api.graphs.getMap(),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => api.graphs.analyzeMap(),
    onSuccess: (data: MapAnalysisResult) => {
      setAnalysisResult(data);
    },
    onError: (error: any) => {
      addMessage({ type: 'error', content: error.message || '分析失败' });
    },
  });

  const graphs: Graph[] = mapData?.graphs || [];
  const relations: GraphRelation[] = mapData?.relations || [];

  const fromGraph = graphs.find((g: Graph) => g.id === fromGraphId);

  const handleGraphClick = useCallback((graph: Graph) => {
    setSelectedGraphId(graph.id);
  }, []);

  const handleGraphDoubleClick = useCallback((graph: Graph) => {
    navigate(`/graph/${graph.id}`);
  }, [navigate]);

  const handleCreateRelation = useCallback(async (data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: GraphRelationType;
    context?: string;
  }) => {
    try {
      await api.graphs.createRelation(data);
      addMessage({ type: 'success', content: '关系创建成功' });
      queryClient.invalidateQueries({ queryKey: ['graphMap'] });
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '创建关系失败' });
      throw error;
    }
  }, [addMessage, queryClient]);

  const handleDeleteRelation = useCallback(async (relationId: string) => {
    try {
      await api.graphs.deleteRelationById(relationId);
      addMessage({ type: 'success', content: '关系已删除' });
      queryClient.invalidateQueries({ queryKey: ['graphMap'] });
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '删除关系失败' });
    }
  }, [addMessage, queryClient]);

  const handleQuickCreateGraph = useCallback(async (data: QuickCreateGraphRequest) => {
    try {
      const newGraph = await api.graphs.create({
        title: data.title,
        description: data.description,
      });
      
      if (data.relation_to) {
        const sourceId = data.relation_to.type === 'prerequisite' 
          ? newGraph.id 
          : data.relation_to.graph_id;
        const targetId = data.relation_to.type === 'prerequisite' 
          ? data.relation_to.graph_id 
          : newGraph.id;
        
        await api.graphs.createRelation({
          source_graph_id: sourceId,
          target_graph_id: targetId,
          relation_type: data.relation_to.type,
        });
      }
      
      addMessage({ type: 'success', content: '图谱创建成功' });
      queryClient.invalidateQueries({ queryKey: ['graphMap'] });
      
      if (data.auto_generate_content) {
        addMessage({ type: 'info', content: '正在生成初始内容...' });
      }
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '创建图谱失败' });
      throw error;
    }
  }, [addMessage, queryClient]);

  const handleCreateRelatedGraph = useCallback((relationType: GraphRelationType) => {
    setCreateGraphRelationType(relationType);
    setIsCreateGraphPanelOpen(true);
  }, []);

  const handleInfiniteExpand = useCallback(async (config: {
    max_depth: number;
    max_graphs_per_level: number;
    relation_types: GraphRelationType[];
    auto_generate_nodes: boolean;
    node_depth: number;
  }) => {
    if (!selectedGraphId) return;
    
    try {
      const result = await api.graphs.infiniteExpand(selectedGraphId, config);
      addMessage({ type: 'success', content: '无限扩展任务已启动' });
      setIsExpansionRunning(true);
      setExpansionProgress({
        status: 'running',
        current_depth: 0,
        total_graphs_created: 0,
        total_nodes_created: 0,
        created_graphs: [],
        errors: [],
      });
      
      queryClient.invalidateQueries({ queryKey: ['graphMap'] });
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '启动扩展失败' });
      throw error;
    }
  }, [selectedGraphId, addMessage, queryClient]);

  const handleDepthExpand = useCallback(async (config: {
    style: 'academic' | 'practical' | 'beginner' | 'custom';
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
          { title: result.root.title, content: result.root.content, level: 'root' },
          ...result.coreNodes.map((n: any) => ({ title: n.title, content: n.content, level: n.level || 'core' }))
        ];
        
        await api.autoGraph.saveNodes({
          graph_id: selectedGraphId,
          nodes,
        });
        
        queryClient.invalidateQueries({ queryKey: ['graphMap'] });
        
        return { root: result.root, coreNodes: result.coreNodes };
      }
      return null;
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '深度拓展失败' });
      throw error;
    }
  }, [selectedGraphId, graphs, addMessage, queryClient]);

  const handleDepthExpandNode = useCallback(async (config: {
    nodeId: string;
    nodeTitle: string;
    nodeContent?: string;
    nodeLevel?: string;
    style: 'academic' | 'practical' | 'beginner' | 'custom';
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
          level: n.level || 'sub',
          parentId: config.nodeId,
        }));
        
        await api.autoGraph.saveNodes({
          graph_id: selectedGraphId,
          nodes,
        });
        
        queryClient.invalidateQueries({ queryKey: ['graphMap'] });
        
        return result.children;
      }
      return null;
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '展开节点失败' });
      throw error;
    }
  }, [selectedGraphId, addMessage, queryClient]);

  const handleOpenPromptEditor = useCallback(async (mode: 'depth' | 'width') => {
    try {
      const templates = await api.prompts.list();
      
      if (mode === 'depth') {
        setShowPromptSelector(true);
        setPromptEditMode(mode);
        setDepthPromptType('init');
        const systemTemplate = templates.system?.find((t: any) => t.code === 'auto_graph_init');
        const userTemplate = templates.user?.find((t: any) => t.code === 'auto_graph_init');
        const effectiveTemplate = userTemplate || systemTemplate;
        setPromptContent(effectiveTemplate?.template_content || '');
      } else {
        setShowPromptSelector(false);
        const systemTemplate = templates.system?.find((t: any) => t.code === 'infinite_graph_expansion');
        const userTemplate = templates.user?.find((t: any) => t.code === 'infinite_graph_expansion');
        const effectiveTemplate = userTemplate || systemTemplate;
        setPromptContent(effectiveTemplate?.template_content || '');
        setPromptEditMode(mode);
      }
      setIsPromptEditorOpen(true);
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '获取提示词失败' });
    }
  }, [addMessage]);

  const handleSwitchDepthPrompt = useCallback(async (type: 'init' | 'expand') => {
    try {
      const templates = await api.prompts.list();
      const templateCode = type === 'init' ? 'auto_graph_init' : 'auto_graph_expand';
      const systemTemplate = templates.system?.find((t: any) => t.code === templateCode);
      const userTemplate = templates.user?.find((t: any) => t.code === templateCode);
      const effectiveTemplate = userTemplate || systemTemplate;
      setPromptContent(effectiveTemplate?.template_content || '');
      setDepthPromptType(type);
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '获取提示词失败' });
    }
  }, [addMessage]);

  const handleSavePrompt = useCallback(async (content: string) => {
    try {
      let templateCode: string;
      if (promptEditMode === 'depth') {
        templateCode = depthPromptType === 'init' ? 'auto_graph_init' : 'auto_graph_expand';
      } else {
        templateCode = 'infinite_graph_expansion';
      }
      await api.prompts.save({
        code: templateCode,
        scope: 'user',
        template_content: content,
      });
      addMessage({ type: 'success', content: '提示词已保存' });
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '保存提示词失败' });
      throw error;
    }
  }, [promptEditMode, depthPromptType, addMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGraphId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
      <GraphMapToolbar
        onBack={() => navigate('/dashboard')}
        onRefresh={() => refetch()}
        onCreateRelation={() => setIsCreatePanelOpen(true)}
        onCreateGraph={() => {
          setCreateGraphRelationType(undefined);
          setIsCreateGraphPanelOpen(true);
        }}
        onAnalyze={() => {
          setIsAnalysisPanelOpen(true);
          analyzeMutation.mutate();
        }}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        graphCount={graphs.length}
        relationCount={relations.length}
        isLoading={isLoading}
        fromGraphId={fromGraphId}
        fromGraphTitle={fromGraph?.title}
        onReturnToGraph={() => navigate(`/graph/${fromGraphId}`)}
      />

      <div className="flex-1 relative">
        <GraphMapCanvas
          graphs={graphs}
          relations={relations}
          selectedGraphId={selectedGraphId}
          onGraphClick={handleGraphClick}
          filterMode={filterMode}
          fromGraphId={fromGraphId}
          fromGraphTitle={fromGraph?.title}
          onReturnToGraph={() => navigate(`/graph/${fromGraphId}`)}
        />

        {selectedGraphId && (
          <div className="absolute top-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 max-w-xs">
            {(() => {
              const graph = graphs.find((g: Graph) => g.id === selectedGraphId);
              if (!graph) return null;
              
              const graphRelations = relations.filter(
                (r: GraphRelation) => r.source_graph_id === selectedGraphId || r.target_graph_id === selectedGraphId
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
                    {(graph as any).node_count || 0} 个节点 · {graphRelations.length} 个关系
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
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      快速创建关联图谱
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreateRelatedGraph('prerequisite')}
                        className="flex-1 px-2 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        + 前置知识
                      </button>
                      <button
                        onClick={() => handleCreateRelatedGraph('extension')}
                        className="flex-1 px-2 py-1.5 text-xs bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                      >
                        + 扩展知识
                      </button>
                      <button
                        onClick={() => handleCreateRelatedGraph('related')}
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
                  
                  {graphRelations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        相关图谱
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {graphRelations.slice(0, 5).map((relation: GraphRelation) => {
                          const isSource = relation.source_graph_id === selectedGraphId;
                          const otherGraphId = isSource ? relation.target_graph_id : relation.source_graph_id;
                          const otherGraph = graphs.find((g: Graph) => g.id === otherGraphId);
                          
                          if (!otherGraph) return null;
                          
                          const relationColor = {
                            prerequisite: 'bg-blue-500',
                            extension: 'bg-green-500',
                            related: 'bg-amber-500',
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
              );
            })()}
          </div>
        )}

        <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            关系类型图例
          </h4>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">前置知识</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">扩展知识</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">相关知识</span>
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
        relatedGraphTitle={graphs.find(g => g.id === selectedGraphId)?.title}
        defaultRelationType={createGraphRelationType}
      />

      <MapAnalysisPanel
        isOpen={isAnalysisPanelOpen}
        onClose={() => setIsAnalysisPanelOpen(false)}
        analysis={analysisResult}
        isLoading={analyzeMutation.isPending}
        onGraphClick={(graphId) => {
          setSelectedGraphId(graphId);
          setIsAnalysisPanelOpen(false);
        }}
        onCreateRelation={(sourceId, targetId, type) => {
          handleCreateRelation({
            source_graph_id: sourceId,
            target_graph_id: targetId,
            relation_type: type,
          });
        }}
      />

      <AIExpansionPanel
        isOpen={isAIExpansionOpen}
        onClose={() => setIsAIExpansionOpen(false)}
        sourceGraphId={selectedGraphId || ''}
        sourceGraphTitle={graphs.find(g => g.id === selectedGraphId)?.title || ''}
        sourceGraphDescription={graphs.find(g => g.id === selectedGraphId)?.description}
        onDepthExpand={handleDepthExpand}
        onDepthExpandNode={handleDepthExpandNode}
        onWidthExpand={handleInfiniteExpand}
        progress={expansionProgress}
        isRunning={isExpansionRunning}
        onEditPrompt={handleOpenPromptEditor}
        hasNodes={(graphs.find(g => g.id === selectedGraphId) as any)?.node_count > 0}
      />

      {isPromptEditorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 h-[70vh] overflow-hidden flex flex-col">
            {showPromptSelector && promptEditMode === 'depth' && (
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleSwitchDepthPrompt('init')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    depthPromptType === 'init'
                      ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  图谱初始化 (auto_graph_init)
                </button>
                <button
                  onClick={() => handleSwitchDepthPrompt('expand')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    depthPromptType === 'expand'
                      ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  节点展开 (auto_graph_expand)
                </button>
              </div>
            )}
            <PromptEditor
              key={`${promptEditMode}-${depthPromptType}`}
              initialContent={promptContent}
              variables={promptEditMode === 'depth' 
                ? (depthPromptType === 'init' 
                  ? ['topic', 'isCustom', 'customPrompt', 'isAcademic', 'isPractical', 'isBeginner', 'hasSources', 'sources']
                  : ['nodeTitle', 'nodeContent', 'nodeLevel', 'isCustom', 'customPrompt', 'isAcademic', 'isPractical', 'isBeginner', 'existingChildren'])
                : ['domainTitle', 'domainDescription', 'maxGraphsPerLevel']
              }
              onSave={handleSavePrompt}
              onCancel={() => setIsPromptEditorOpen(false)}
              title={promptEditMode === 'depth' 
                ? (depthPromptType === 'init' ? '编辑图谱初始化提示词' : '编辑节点展开提示词')
                : '编辑宽度拓展提示词'
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

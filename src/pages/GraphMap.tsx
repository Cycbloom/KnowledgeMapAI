import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useMessageStore } from '../store/useMessageStore';
import { GraphMapCanvas } from '../components/GraphMap/GraphMapCanvas';
import { GraphMapToolbar } from '../components/GraphMap/GraphMapToolbar';
import { CreateRelationPanel } from '../components/GraphMap/CreateRelationPanel';
import { QuickCreateGraphPanel } from '../components/GraphMap/QuickCreateGraphPanel';
import { MapAnalysisPanel } from '../components/GraphMap/MapAnalysisPanel';
import { InfiniteExpansionPanel } from '../components/GraphMap/InfiniteExpansionPanel';
import type { Graph, GraphRelation, GraphMapFilterMode, GraphRelationType, QuickCreateGraphRequest, MapAnalysisResult, InfiniteExpansionProgress } from '../types';

export const GraphMap: React.FC = () => {
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
  const [isInfiniteExpansionOpen, setIsInfiniteExpansionOpen] = useState(false);
  const [expansionProgress, setExpansionProgress] = useState<InfiniteExpansionProgress | null>(null);
  const [isExpansionRunning, setIsExpansionRunning] = useState(false);

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

  const graphs = mapData?.graphs || [];
  const relations = mapData?.relations || [];

  const fromGraph = graphs.find(g => g.id === fromGraphId);

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
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
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
              const graph = graphs.find(g => g.id === selectedGraphId);
              if (!graph) return null;
              
              const graphRelations = relations.filter(
                r => r.source_graph_id === selectedGraphId || r.target_graph_id === selectedGraphId
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
                      onClick={() => setIsInfiniteExpansionOpen(true)}
                      className="w-full px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                      AI 无限扩展
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                      自动生成相关知识网络
                    </p>
                  </div>
                  
                  {graphRelations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        相关图谱
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {graphRelations.slice(0, 5).map(relation => {
                          const isSource = relation.source_graph_id === selectedGraphId;
                          const otherGraphId = isSource ? relation.target_graph_id : relation.source_graph_id;
                          const otherGraph = graphs.find(g => g.id === otherGraphId);
                          
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

      <InfiniteExpansionPanel
        isOpen={isInfiniteExpansionOpen}
        onClose={() => setIsInfiniteExpansionOpen(false)}
        sourceGraphId={selectedGraphId || ''}
        sourceGraphTitle={graphs.find(g => g.id === selectedGraphId)?.title || ''}
        onSubmit={handleInfiniteExpand}
        progress={expansionProgress}
        isRunning={isExpansionRunning}
      />
    </div>
  );
};

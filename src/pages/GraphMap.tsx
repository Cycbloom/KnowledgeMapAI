import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useMessageStore } from '../store/useMessageStore';
import { GraphMapCanvas } from '../components/GraphMap/GraphMapCanvas';
import { GraphMapToolbar } from '../components/GraphMap/GraphMapToolbar';
import { CreateRelationPanel } from '../components/GraphMap/CreateRelationPanel';
import type { Graph, GraphRelation, GraphMapFilterMode, GraphRelationType } from '../types';

export const GraphMap: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { addMessage } = useMessageStore();
  
  const fromGraphId = searchParams.get('from');
  
  const [filterMode, setFilterMode] = useState<GraphMapFilterMode>('all');
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(fromGraphId);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);

  const { data: mapData, isLoading, refetch } = useQuery({
    queryKey: ['graphMap'],
    queryFn: () => api.graphs.getMap(),
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
    </div>
  );
};

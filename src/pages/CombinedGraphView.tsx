import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { MindMapCanvas } from '../components/GraphEditor/MindMapCanvas';
import type { Graph, GraphRelation, Node, Edge, LayoutNode } from '../types';

const GRAPH_SPACING = 800;

const relationColors: Record<string, { color: string; label: string }> = {
  prerequisite: { color: '#3B82F6', label: '前置知识' },
  extension: { color: '#10B981', label: '扩展知识' },
  related: { color: '#F59E0B', label: '相关知识' },
};

interface GraphDataResponse {
  nodes: Node[];
  edges: Edge[];
}

interface CrossGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  sourceGraphId: string;
  targetGraphId: string;
}

export const CombinedGraphView: React.FC = () => {
  const { id1, id2 } = useParams<{ id1: string; id2: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<any>(null);
  
  const { data: graph1Data, isLoading: isLoading1, error: error1 } = useQuery<GraphDataResponse>({
    queryKey: ['graphData', id1],
    queryFn: async () => {
      const data = await api.graphs.getNodes(id1!);
      return {
        nodes: (data.nodes || []) as Node[],
        edges: (data.edges || []) as Edge[],
      };
    },
    enabled: !!id1,
  });
  
  const { data: graph2Data, isLoading: isLoading2, error: error2 } = useQuery<GraphDataResponse>({
    queryKey: ['graphData', id2],
    queryFn: async () => {
      const data = await api.graphs.getNodes(id2!);
      return {
        nodes: (data.nodes || []) as Node[],
        edges: (data.edges || []) as Edge[],
      };
    },
    enabled: !!id2,
  });
  
  const { data: graph1Meta } = useQuery({
    queryKey: ['graph', id1],
    queryFn: () => api.graphs.get(id1!),
    enabled: !!id1,
  });
  
  const { data: graph2Meta } = useQuery({
    queryKey: ['graph', id2],
    queryFn: () => api.graphs.get(id2!),
    enabled: !!id2,
  });
  
  const { data: mapData } = useQuery({
    queryKey: ['graphMap'],
    queryFn: () => api.graphs.getMap(),
  });
  
  const graphRelations = useMemo(() => {
    if (!mapData?.relations || !id1 || !id2) return [];
    return mapData.relations.filter(
      (r: GraphRelation) => 
        (r.source_graph_id === id1 && r.target_graph_id === id2) ||
        (r.source_graph_id === id2 && r.target_graph_id === id1)
    );
  }, [mapData, id1, id2]);

  const mergedNodes = useMemo(() => {
    const nodes1 = graph1Data?.nodes || [];
    const nodes2 = graph2Data?.nodes || [];
    
    const offsetX1 = -GRAPH_SPACING / 2;
    const offsetX2 = GRAPH_SPACING / 2;
    
    const processedNodes1 = nodes1.map(node => ({
      ...node,
      x_position: (node.x_position || 0) + offsetX1,
      _graphId: id1,
      _graphColor: '#3B82F6',
    }));
    
    const processedNodes2 = nodes2.map(node => ({
      ...node,
      x_position: (node.x_position || 0) + offsetX2,
      _graphId: id2,
      _graphColor: '#10B981',
    }));
    
    return [...processedNodes1, ...processedNodes2] as Node[];
  }, [graph1Data, graph2Data, id1, id2]);

  const mergedEdges = useMemo(() => {
    const edges1 = graph1Data?.edges || [];
    const edges2 = graph2Data?.edges || [];
    
    return [...edges1, ...edges2];
  }, [graph1Data, graph2Data]);

  const crossGraphEdges = useMemo((): CrossGraphEdge[] => {
    if (!graphRelations || !mergedNodes.length) return [];
    
    const result: CrossGraphEdge[] = [];
    
    graphRelations.forEach((relation: GraphRelation) => {
      const isGraph1Source = relation.source_graph_id === id1;
      const sourceNodes = isGraph1Source 
        ? (graph1Data?.nodes || []) 
        : (graph2Data?.nodes || []);
      const targetNodes = isGraph1Source 
        ? (graph2Data?.nodes || []) 
        : (graph1Data?.nodes || []);
      
      const rootSource = sourceNodes.find(n => n.level === 'root');
      const rootTarget = targetNodes.find(n => n.level === 'root');
      
      if (rootSource && rootTarget) {
        result.push({
          id: `cross-${relation.id}`,
          sourceId: rootSource.id,
          targetId: rootTarget.id,
          relationType: relation.relation_type,
          sourceGraphId: relation.source_graph_id,
          targetGraphId: relation.target_graph_id,
        });
      }
    });
    
    return result;
  }, [graphRelations, mergedNodes, graph1Data, graph2Data, id1, id2]);

  const handleBack = useCallback(() => {
    navigate('/graph-map');
  }, [navigate]);

  const handleNodeClick = useCallback((node: Node) => {
    console.log('Node clicked:', node.title, 'from graph:', node.graph_id);
  }, []);

  const isLoading = isLoading1 || isLoading2;
  const hasError = error1 || error2;
  
  if (!id1 || !id2) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">缺少图谱 ID 参数</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            返回图谱地图
          </button>
        </div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">加载图谱数据失败</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            返回图谱地图
          </button>
        </div>
      </div>
    );
  }

  const graph1Color = '#3B82F6';
  const graph2Color = '#10B981';
  
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="h-14 flex items-center justify-between px-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回图谱地图
        </button>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: graph1Color }}
            />
            <span className="px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
              {graph1Meta?.title || '图谱 1'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({graph1Data?.nodes?.length || 0} 节点)
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {graphRelations.length > 0 ? (
              graphRelations.map((r: GraphRelation, i: number) => {
                const config = relationColors[r.relation_type] || relationColors.related;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <svg className="w-4 h-4" style={{ color: config.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span 
                      className="px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{ 
                        backgroundColor: `${config.color}20`,
                        color: config.color 
                      }}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                无直接关系
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: graph2Color }}
            />
            <span className="px-3 py-1 text-sm font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md">
              {graph2Meta?.title || '图谱 2'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({graph2Data?.nodes?.length || 0} 节点)
            </span>
          </div>
        </div>
        
        <div className="w-24" />
      </div>
      
      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-white dark:bg-slate-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">加载中...</p>
            </div>
          </div>
        ) : (
          <>
            <MindMapCanvas
              ref={canvasRef}
              nodes={mergedNodes}
              edges={mergedEdges}
              selectedNodeId={null}
              onNodeClick={handleNodeClick}
              coloringMode="level"
            />
            
            {crossGraphEdges.length > 0 && (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
                <defs>
                  {crossGraphEdges.map(edge => {
                    const config = relationColors[edge.relationType] || relationColors.related;
                    return (
                      <linearGradient 
                        key={`gradient-${edge.id}`}
                        id={`gradient-${edge.id}`}
                        x1="0%" y1="0%" x2="100%" y2="0%"
                      >
                        <stop offset="0%" stopColor={graph1Color} stopOpacity="0.8" />
                        <stop offset="50%" stopColor={config.color} stopOpacity="1" />
                        <stop offset="100%" stopColor={graph2Color} stopOpacity="0.8" />
                      </linearGradient>
                    );
                  })}
                  {crossGraphEdges.map(edge => {
                    const config = relationColors[edge.relationType] || relationColors.related;
                    return (
                      <marker
                        key={`marker-${edge.id}`}
                        id={`marker-${edge.id}`}
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3.5, 0 7" fill={config.color} />
                      </marker>
                    );
                  })}
                </defs>
              </svg>
            )}
            
            <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-lg p-3 backdrop-blur-sm">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: graph1Color }} />
                  <span className="text-gray-600 dark:text-gray-400">{graph1Meta?.title || '图谱 1'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: graph2Color }} />
                  <span className="text-gray-600 dark:text-gray-400">{graph2Meta?.title || '图谱 2'}</span>
                </div>
              </div>
              {crossGraphEdges.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  图谱间关系: {crossGraphEdges.length} 条
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CombinedGraphView;

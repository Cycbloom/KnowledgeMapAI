import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useCombinedGraphAIOperations } from '../hooks/graphAI';
import { useBatchGraphStatus } from '../hooks/queries/useGraphQueries';
import { MindMapCanvas } from '../components/GraphEditor/canvas/MindMapCanvas';
import { CombinedGraphToolbar } from '../components/CombinedView/CombinedGraphToolbar';
import { CombinedGraphSidebar } from '../components/CombinedView/CombinedGraphSidebar';
import type { GraphRelation, Node, Edge, GraphColorMode, CrossGraphNodeConnection, CrossGraphRelationData } from '../types';

const GRAPH_SPACING = 400;

interface GraphDataResponse {
  nodes: Node[];
  edges: Edge[];
}

export const CombinedGraphView: React.FC = () => {
  const { id1, id2 } = useParams<{ id1: string; id2: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [coloringMode, setColoringMode] = useState<GraphColorMode>('level');

  const { data: graphStatusData } = useBatchGraphStatus([id1 || '', id2 || '']);

  const mergedNodeStatus = useMemo(() => {
    const status1 = graphStatusData?.[id1 || ''];
    const status2 = graphStatusData?.[id2 || ''];
    const s1 = (Array.isArray(status1) ? {} : status1) as Record<string, any> | undefined;
    const s2 = (Array.isArray(status2) ? {} : status2) as Record<string, any> | undefined;
    return { ...(s1 || {}), ...(s2 || {}) };
  }, [graphStatusData, id1, id2]);
  
  const { data: graph1Data, isLoading: isLoading1, error: error1 } = useQuery<GraphDataResponse>({
    queryKey: ['graphData', id1],
    queryFn: async () => {
      if (!id1) return { nodes: [], edges: [] };
      const data = await api.graphs.getNodes(id1);
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
      if (!id2) return { nodes: [], edges: [] };
      const data = await api.graphs.getNodes(id2);
      return {
        nodes: (data.nodes || []) as Node[],
        edges: (data.edges || []) as Edge[],
      };
    },
    enabled: !!id2,
  });
  
  const { data: graph1Meta } = useQuery({
    queryKey: ['graph', id1],
    queryFn: () => {
      if (!id1) return null;
      return api.graphs.get(id1);
    },
    enabled: !!id1,
  });
  
  const { data: graph2Meta } = useQuery({
    queryKey: ['graph', id2],
    queryFn: () => {
      if (!id2) return null;
      return api.graphs.get(id2);
    },
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
      graph_id: id1,
    }));
    
    const processedNodes2 = nodes2.map(node => ({
      ...node,
      x_position: (node.x_position || 0) + offsetX2,
      graph_id: id2,
    }));
    
    return [...processedNodes1, ...processedNodes2] as Node[];
  }, [graph1Data, graph2Data, id1, id2]);

  const mergedEdges = useMemo(() => {
    const edges1 = graph1Data?.edges || [];
    const edges2 = graph2Data?.edges || [];
    
    return [...edges1, ...edges2];
  }, [graph1Data, graph2Data]);

  const nodes1 = useMemo(() => graph1Data?.nodes || [], [graph1Data]);
  const nodes2 = useMemo(() => graph2Data?.nodes || [], [graph2Data]);
  const edges1 = useMemo(() => graph1Data?.edges || [], [graph1Data]);
  const edges2 = useMemo(() => graph2Data?.edges || [], [graph2Data]);

  const detectCrossGraphConnections = useCallback((nodes1: Node[], nodes2: Node[], id1: string, id2: string): CrossGraphNodeConnection[] => {
    const connections: CrossGraphNodeConnection[] = [];
    const kpMap1 = new Map<string, Node>();
    const kpMap2 = new Map<string, Node>();
    
    nodes1.forEach(n => {
      if (n.knowledge_point_id) kpMap1.set(n.knowledge_point_id, n);
    });
    nodes2.forEach(n => {
      if (n.knowledge_point_id) kpMap2.set(n.knowledge_point_id, n);
    });
    
    kpMap1.forEach((node1, kpId) => {
      const node2 = kpMap2.get(kpId);
      if (node2) {
        connections.push({
          id: `cross-${kpId}`,
          knowledge_point_id: kpId,
          node1: {
            id: node1.id,
            title: node1.title,
            graph_id: id1,
            x_position: node1.x_position || 0,
            y_position: node1.y_position || 0,
          },
          node2: {
            id: node2.id,
            title: node2.title,
            graph_id: id2,
            x_position: node2.x_position || 0,
            y_position: node2.y_position || 0,
          },
          connection_type: 'same_knowledge_point',
        });
      }
    });
    
    return connections;
  }, []);

  const crossGraphConnections = useMemo(() => {
    if (nodes1.length > 0 && nodes2.length > 0 && id1 && id2) {
      return detectCrossGraphConnections(nodes1, nodes2, id1, id2);
    }
    return [];
  }, [nodes1, nodes2, id1, id2, detectCrossGraphConnections]);

  const aiOps = useCombinedGraphAIOperations({
    graph1Id: id1 || '',
    graph2Id: id2 || '',
    selectedNode,
    nodes1,
    nodes2,
    edges1,
    edges2,
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: ['graphData', id1] });
      queryClient.invalidateQueries({ queryKey: ['graphData', id2] });
    },
  });

  const nodeOps = {
    handleUpdateNode: async (nodeId: string, updates: Partial<Node>) => {
      await api.nodes.update(nodeId, updates);
      queryClient.invalidateQueries({ queryKey: ['graphData', id1] });
      queryClient.invalidateQueries({ queryKey: ['graphData', id2] });
    },
    handleDeleteNode: async (nodeId: string) => {
      await api.nodes.delete(nodeId);
      queryClient.invalidateQueries({ queryKey: ['graphData', id1] });
      queryClient.invalidateQueries({ queryKey: ['graphData', id2] });
    },
  };

  const handleBack = useCallback(() => {
    navigate('/graph-map');
  }, [navigate]);

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
    setIsSidebarOpen(true);
  }, []);

  const handleToggleColoringMode = useCallback(() => {
    const nextMode: Record<GraphColorMode, GraphColorMode> = {
      level: 'status',
      status: 'heatmap',
      heatmap: 'decay',
      decay: 'level',
    };
    setColoringMode(prev => nextMode[prev] || 'level');
  }, []);

  const handleExportImage = useCallback(() => {
  }, []);

  const handleExportJSON = useCallback(() => {
    const data: CrossGraphRelationData = {
      graph1: { 
        id: id1 || '', 
        title: graph1Meta?.title || '图谱 1', 
        node_count: nodes1.length 
      },
      graph2: { 
        id: id2 || '', 
        title: graph2Meta?.title || '图谱 2', 
        node_count: nodes2.length 
      },
      graph_relations: graphRelations,
      cross_graph_connections: crossGraphConnections,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross-graph-relations-${graph1Meta?.title || 'graph1'}-${graph2Meta?.title || 'graph2'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [id1, id2, graph1Meta, graph2Meta, nodes1, nodes2, graphRelations, crossGraphConnections]);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const isLoading = isLoading1 || isLoading2;
  const hasError = error1 || error2;
  
  if (!id1 || !id2) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">缺少图谱 ID 参数</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
          >
            返回图谱地图
          </button>
        </div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">加载图谱数据失败</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
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
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-slate-900 relative">
      <CombinedGraphToolbar
        graph1Title={graph1Meta?.title || '图谱 1'}
        graph2Title={graph2Meta?.title || '图谱 2'}
        onBack={handleBack}
        coloringMode={coloringMode}
        onToggleColoringMode={handleToggleColoringMode}
        onExportImage={handleExportImage}
        onExportJSON={handleExportJSON}
        onToggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        selectedNode={selectedNode}
      />
      
      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-white dark:bg-slate-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">加载中...</p>
            </div>
          </div>
        ) : (
          <>
            <MindMapCanvas
              nodes={mergedNodes}
              edges={mergedEdges}
              selectedNodeId={selectedNode?.id || null}
              onNodeClick={handleNodeClick}
              coloringMode={coloringMode}
              nodeStatus={mergedNodeStatus}
              isRightPanelOpen={isSidebarOpen}
              rightPanelWidth={sidebarWidth}
            />
            
            {crossGraphConnections.length > 0 && (
              <svg 
                className="absolute inset-0 pointer-events-none" 
                style={{ zIndex: 6 }}
              >
                <defs>
                  <linearGradient id="crossGraphGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#EC4899" stopOpacity="1" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                {crossGraphConnections.map((conn) => {
                  const x1 = (conn.node1.x_position || 0) - GRAPH_SPACING / 2;
                  const y1 = conn.node1.y_position || 0;
                  const x2 = (conn.node2.x_position || 0) + GRAPH_SPACING / 2;
                  const y2 = conn.node2.y_position || 0;
                  
                  return (
                    <g key={conn.id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="url(#crossGraphGradient)"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        className="animate-pulse"
                        opacity={0.7}
                      />
                      <circle
                        cx={(x1 + x2) / 2}
                        cy={(y1 + y2) / 2}
                        r={4}
                        fill="#8B5CF6"
                        className="animate-ping"
                      />
                    </g>
                  );
                })}
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
              {graphRelations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  图谱间关系: {graphRelations.length} 条
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <CombinedGraphSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        nodes1={nodes1}
        nodes2={nodes2}
        edges1={edges1}
        edges2={edges2}
        graph1Title={graph1Meta?.title || '图谱 1'}
        graph2Title={graph2Meta?.title || '图谱 2'}
        graph1Color={graph1Color}
        graph2Color={graph2Color}
        graph1Id={id1 || ''}
        graph2Id={id2 || ''}
        selectedNode={selectedNode}
        onNodeClick={handleNodeClick}
        onWidthChange={setSidebarWidth}
        crossGraphConnections={crossGraphConnections}
        aiOps={{
          handleExpandNode: aiOps.handleExpandNode,
          handleGenerateContent: aiOps.handleGenerateContent,
          handleGenerateCards: aiOps.handleGenerateCards,
          handleStartLevelTest: aiOps.handleStartLevelTest,
          handleStartLearningMode: aiOps.handleStartLearningMode,
          handleAnalyzeCrossGraphConnections: aiOps.handleAnalyzeCrossGraphConnections,
        }}
        nodeOps={nodeOps}
      />
    </div>
  );
};

export default CombinedGraphView;

import React, { useEffect, useState, useMemo } from 'react';
import { useCombinedView } from '../hooks';
import { CombinedViewCanvas } from '../components/CombinedView/CombinedViewCanvas';
import { api } from '../services/api';
import type { Graph, CombinedViewLayoutMode, KnowledgePoint, GraphNodeWithKnowledgePoint, Edge } from '../types';

interface GraphSelectorProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
}

const GraphSelector: React.FC<GraphSelectorProps> = ({ selectedIds, onToggle, onConfirm }) => {
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGraphs = async () => {
      try {
        const result = await api.graphs.list();
        setGraphs(result as Graph[]);
      } catch (err) {
        console.error('Failed to load graphs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadGraphs();
  }, []);

  if (isLoading) {
    return <div className="p-4 text-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">选择要联立展示的图谱</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {graphs.map((graph) => (
          <label
            key={graph.id}
            className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(graph.id)}
              onChange={() => onToggle(graph.id)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div className="ml-3">
              <span className="font-medium text-gray-900 dark:text-white">{graph.title}</span>
              {graph.nodes_count !== undefined && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({graph.nodes_count} 个节点)
                </span>
              )}
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button
          onClick={onConfirm}
          disabled={selectedIds.length < 2}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          开始联立视图 ({selectedIds.length} 个图谱)
        </button>
      </div>
    </div>
  );
};

interface MergedNode {
  id: string;
  knowledgePoint: KnowledgePoint;
  graphIds: string[];
  graphNodes: GraphNodeWithKnowledgePoint[];
  isShared: boolean;
  primaryColor: string;
  colors: string[];
}

interface MergedEdge extends Edge {
  graphId: string;
  color: string;
}

interface CombinedViewPageProps {
  initialGraphIds?: string[];
}

export const CombinedViewPage: React.FC<CombinedViewPageProps> = ({ initialGraphIds }) => {
  const [showSelector, setShowSelector] = useState(!initialGraphIds || initialGraphIds.length === 0);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(initialGraphIds || []);
  const [selectedNode, setSelectedNode] = useState<MergedNode | null>(null);
  
  const {
    graphIds,
    mergedNodes: hookMergedNodes,
    mergedEdges: hookMergedEdges,
    isLoading,
    error,
    layoutMode,
    setLayoutMode,
    highlightedGraphId,
    setHighlightedGraphId,
    hiddenGraphIds,
    graphColors,
    loadData,
    addGraph,
    removeGraph,
    toggleGraphVisibility,
    getGraphColor,
  } = useCombinedView({ initialGraphIds });

  useEffect(() => {
    if (graphIds.length > 0) {
      loadData();
    }
  }, [graphIds, loadData]);

  const handleToggleTemp = (id: string) => {
    setTempSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirmSelection = () => {
    tempSelectedIds.forEach(id => {
      if (!graphIds.includes(id)) {
        addGraph(id);
      }
    });
    graphIds.forEach(id => {
      if (!tempSelectedIds.includes(id)) {
        removeGraph(id);
      }
    });
    setShowSelector(false);
  };

  const mergedNodes: MergedNode[] = useMemo(() => {
    return hookMergedNodes.map(node => ({
      id: node.id,
      knowledgePoint: {
        id: node.id,
        title: node.title,
        content: node.content,
        learning_material: node.learning_material,
        properties: node.properties,
        visibility: node.visibility,
        owner_id: node.owner_id,
        created_at: node.created_at,
        updated_at: node.updated_at,
      },
      graphIds: node.graphIds,
      graphNodes: node.graphNodes,
      isShared: node.isShared,
      primaryColor: node.colors[0] || '#6B7280',
      colors: node.colors,
    }));
  }, [hookMergedNodes]);

  const mergedEdges: MergedEdge[] = useMemo(() => {
    return hookMergedEdges.map(edge => ({
      ...edge,
      graphId: (edge as any).graphId || '',
      color: getGraphColor((edge as any).graphId || ''),
    }));
  }, [hookMergedEdges, getGraphColor]);

  const handleNodeClick = (node: MergedNode) => {
    setSelectedNode(node);
  };

  const stats = useMemo(() => {
    const totalNodes = mergedNodes.length;
    const sharedNodes = mergedNodes.filter(n => n.isShared).length;
    const totalEdges = mergedEdges.length;
    const visibleNodes = mergedNodes.filter(n => !n.graphIds.every(gid => hiddenGraphIds.has(gid))).length;
    
    return { totalNodes, sharedNodes, totalEdges, visibleNodes };
  }, [mergedNodes, mergedEdges, hiddenGraphIds]);

  if (showSelector) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow">
          <GraphSelector
            selectedIds={tempSelectedIds}
            onToggle={handleToggleTemp}
            onConfirm={handleConfirmSelection}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">加载联立视图...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => setShowSelector(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            重新选择图谱
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">联立视图</h1>
            <span className="text-sm text-gray-400">
              {graphIds.length} 个图谱 | {stats.visibleNodes} / {stats.totalNodes} 个知识点
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as CombinedViewLayoutMode)}
              className="px-3 py-1.5 text-sm border border-gray-600 rounded-md bg-gray-700 text-white"
            >
              <option value="grouped">分组布局</option>
              <option value="merged">融合布局</option>
              <option value="network">网络布局</option>
            </select>
            
            <button
              onClick={() => setShowSelector(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600"
            >
              添加/移除图谱
            </button>
          </div>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-2">
          {graphIds.map((id) => {
            const color = graphColors[id];
            const isHidden = hiddenGraphIds.has(id);
            const isHighlighted = highlightedGraphId === id;
            
            return (
              <button
                key={id}
                onClick={() => toggleGraphVisibility(id)}
                onMouseEnter={() => setHighlightedGraphId(id)}
                onMouseLeave={() => setHighlightedGraphId(null)}
                className={`px-3 py-1 text-sm rounded-full border-2 transition-all ${
                  isHidden 
                    ? 'opacity-50 border-gray-600' 
                    : isHighlighted
                      ? 'border-opacity-100 scale-105'
                      : 'border-opacity-60'
                }`}
                style={{ 
                  borderColor: color,
                  backgroundColor: isHidden ? 'transparent' : `${color}20`
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  图谱 {id.slice(0, 4)}
                  {isHidden && ' (隐藏)'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 relative">
        <CombinedViewCanvas
          nodes={mergedNodes}
          edges={mergedEdges}
          graphColors={graphColors}
          layoutMode={layoutMode}
          highlightedGraphId={highlightedGraphId}
          hiddenGraphIds={hiddenGraphIds}
          onNodeClick={handleNodeClick}
        />
        
        <div className="absolute top-4 left-4 bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 text-sm">
          <div className="text-gray-300 space-y-1">
            <p>总知识点: <span className="text-white font-medium">{stats.totalNodes}</span></p>
            <p>共享知识点: <span className="text-blue-400 font-medium">{stats.sharedNodes}</span></p>
            <p>边数量: <span className="text-white font-medium">{stats.totalEdges}</span></p>
          </div>
        </div>
        
        {selectedNode && (
          <div className="absolute top-4 right-4 w-72 bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 text-sm">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-white">{selectedNode.knowledgePoint.title}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {selectedNode.knowledgePoint.content && (
              <p className="mt-2 text-gray-300 text-xs line-clamp-3">
                {selectedNode.knowledgePoint.content}
              </p>
            )}
            
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-gray-400 text-xs mb-2">所属图谱:</p>
              <div className="flex flex-wrap gap-1">
                {selectedNode.graphIds.map(gid => (
                  <span
                    key={gid}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ 
                      backgroundColor: `${graphColors[gid]}30`,
                      color: graphColors[gid]
                    }}
                  >
                    {gid.slice(0, 4)}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                selectedNode.isShared 
                  ? 'bg-blue-900/50 text-blue-300' 
                  : 'bg-gray-700 text-gray-300'
              }`}>
                {selectedNode.isShared ? '共享知识点' : '独立知识点'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

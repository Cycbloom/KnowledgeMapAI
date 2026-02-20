import React, { useEffect, useState } from 'react';
import { useCombinedView } from '../hooks/useCombinedView';
import { api } from '../services/api';
import type { Graph, CombinedViewLayoutMode } from '../types';

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

interface CombinedViewPageProps {
  initialGraphIds?: string[];
}

export const CombinedViewPage: React.FC<CombinedViewPageProps> = ({ initialGraphIds }) => {
  const [showSelector, setShowSelector] = useState(!initialGraphIds || initialGraphIds.length === 0);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(initialGraphIds || []);
  
  const {
    graphIds,
    mergedNodes,
    mergedEdges,
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
    getNodeColors
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">联立视图</h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {graphIds.length} 个图谱
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as CombinedViewLayoutMode)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="grouped">分组布局</option>
              <option value="merged">融合布局</option>
              <option value="network">网络布局</option>
            </select>
            
            <button
              onClick={() => setShowSelector(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
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
                    ? 'opacity-50 border-gray-300 dark:border-gray-600' 
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
      
      <div className="flex-1 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full min-h-[600px] relative">
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="mb-2">联立视图渲染区域</p>
              <p className="text-sm">
                {mergedNodes.length} 个知识点，{mergedEdges.length} 条边
              </p>
              <p className="text-sm mt-1">
                其中 {mergedNodes.filter(n => n.isShared).length} 个知识点在多个图谱中共享
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

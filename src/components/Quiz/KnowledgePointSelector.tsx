import React, { useState, useMemo, useEffect } from 'react';
import { Search, Check, ChevronDown, ChevronRight, Layers, Loader2, Network } from 'lucide-react';
import { useTheme } from "../../hooks";
import { useGraphs, useGraphData } from '../../hooks/queries';
import type { Node, Graph } from '../../types';

interface KnowledgePointSelectorProps {
  graphId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onGraphChange?: (graphId: string) => void;
}

interface TreeNode {
  id: string;
  title: string;
  level: string;
  children: TreeNode[];
  parentId?: string;
}

const levelColors: Record<string, string> = {
  root: 'bg-primary-500',
  core: 'bg-red-500',
  sub: 'bg-orange-500',
  normal: 'bg-primary-500',
  leaf: 'bg-green-500',
};

const levelLabels: Record<string, string> = {
  root: '核心主题',
  core: '主要概念',
  sub: '细分知识',
  normal: '具体内容',
  leaf: '实例细节',
};

export const KnowledgePointSelector: React.FC<KnowledgePointSelectorProps> = ({
  graphId: initialGraphId,
  selectedIds,
  onChange,
  onGraphChange,
}) => {
  const { isDark } = useTheme();
  const [selectedGraphId, setSelectedGraphId] = useState<string>(initialGraphId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: graphs } = useGraphs();
  const { data: graphData, isLoading: nodesLoading } = useGraphData(selectedGraphId);

  const treeData = useMemo(() => {
    if (!graphData?.nodes) return [];

    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    graphData.nodes.forEach((node: Node) => {
      nodeMap.set(node.knowledge_point_id, {
        id: node.knowledge_point_id,
        title: node.title || '未命名节点',
        level: node.level || 'leaf',
        children: [],
      });
    });

    graphData.edges?.forEach((edge) => {
      const parent = nodeMap.get(edge.source_knowledge_point_id);
      const child = nodeMap.get(edge.target_knowledge_point_id);
      if (parent && child) {
        child.parentId = parent.id;
        parent.children.push(child);
      }
    });

    nodeMap.forEach((node) => {
      if (!node.parentId) {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }, [graphData]);

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return null;

    const results: Node[] = [];
    const term = searchTerm.toLowerCase();

    graphData?.nodes?.forEach((node: Node) => {
      if (
        node.title?.toLowerCase().includes(term) ||
        node.content?.toLowerCase().includes(term)
      ) {
        results.push(node);
      }
    });

    return results;
  }, [graphData, searchTerm]);

  useEffect(() => {
    if (initialGraphId) {
      setSelectedGraphId(initialGraphId);
    }
  }, [initialGraphId]);

  useEffect(() => {
    if (treeData.length > 0 && expandedIds.size === 0) {
      const allIds = new Set<string>();
      const collectIds = (nodes: TreeNode[]) => {
        nodes.forEach((n) => {
          allIds.add(n.id);
          if (n.children.length > 0) collectIds(n.children);
        });
      };
      collectIds(treeData);
      setExpandedIds(allIds);
    }
  }, [treeData]);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const toggleSelect = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    onChange(newIds);
  };

  const toggleSelectAll = () => {
    if (!graphData?.nodes) return;

    const allIds = graphData.nodes.map((n: Node) => n.knowledge_point_id);
    if (selectedIds.length === allIds.length) {
      onChange([]);
    } else {
      onChange(allIds);
    }
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIds.includes(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? isDark
                ? 'bg-primary-900/30'
                : 'bg-primary-50'
              : isDark
                ? 'hover:bg-slate-700/50'
                : 'hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
            >
              {isExpanded ? (
                <ChevronDown size={14} className={isDark ? 'text-slate-400' : 'text-gray-500'} />
              ) : (
                <ChevronRight size={14} className={isDark ? 'text-slate-400' : 'text-gray-500'} />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <button
            onClick={() => toggleSelect(node.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
              isSelected
                ? 'bg-primary-600 border-primary-600 text-white'
                : isDark
                  ? 'border-slate-600'
                  : 'border-gray-300'
            }`}
          >
            {isSelected && <Check size={12} />}
          </button>

          <div
            className={`w-2 h-2 rounded-full ${levelColors[node.level] || 'bg-gray-400'}`}
            title={levelLabels[node.level] || node.level}
          />

          <span
            onClick={() => toggleSelect(node.id)}
            className={`flex-1 text-sm truncate ${
              isDark ? 'text-slate-200' : 'text-gray-700'
            }`}
          >
            {node.title}
          </span>

          {hasChildren && (
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              {node.children.length}
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>{node.children.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const renderSearchResults = () => {
    if (!filteredNodes) return null;

    if (filteredNodes.length === 0) {
      return (
        <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          没有找到匹配的知识点
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filteredNodes.map((node: Node) => {
          const isSelected = selectedIds.includes(node.knowledge_point_id);
          return (
            <div
              key={node.knowledge_point_id}
              onClick={() => toggleSelect(node.knowledge_point_id)}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                isSelected
                  ? isDark
                    ? 'bg-primary-900/30'
                    : 'bg-primary-50'
                  : isDark
                    ? 'hover:bg-slate-700/50'
                    : 'hover:bg-gray-100'
              }`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : isDark
                      ? 'border-slate-600'
                      : 'border-gray-300'
                }`}
              >
                {isSelected && <Check size={12} />}
              </div>

              <div
                className={`w-2 h-2 rounded-full ${levelColors[node.level || 'leaf']}`}
                title={levelLabels[node.level || 'leaf']}
              />

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                  {node.title}
                </div>
                {node.content && (
                  <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {node.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          选择图谱
        </label>
        <select
          value={selectedGraphId}
          onChange={(e) => {
            const newGraphId = e.target.value;
            setSelectedGraphId(newGraphId);
            onChange([]);
            if (onGraphChange) {
              onGraphChange(newGraphId);
            }
          }}
          className={`w-full px-3 py-2 rounded-lg border text-sm ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          <option value="">请选择图谱</option>
          {graphs?.map((graph: Graph) => (
            <option key={graph.id} value={graph.id}>
              {graph.title}
            </option>
          ))}
        </select>
      </div>

      {selectedGraphId && (
        <>
          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
              size={16}
            />
            <input
              type="text"
              placeholder="搜索知识点..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              已选择 <span className="font-bold text-primary-600">{selectedIds.length}</span> 个知识点
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {selectedIds.length === graphData?.nodes?.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div
            className={`rounded-xl border overflow-hidden ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="max-h-[300px] overflow-y-auto p-2">
              {nodesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary-600" />
                </div>
              ) : searchTerm ? (
                renderSearchResults()
              ) : treeData.length > 0 ? (
                <div className="space-y-0.5">{treeData.map((node) => renderTreeNode(node))}</div>
              ) : (
                <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  <Network size={32} className="mx-auto mb-2 opacity-50" />
                  <p>该图谱暂无知识点</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedGraphId && !initialGraphId && (
        <div
          className={`rounded-xl border p-8 text-center ${
            isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <Layers size={32} className={`mx-auto mb-2 opacity-50 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
          <p className={isDark ? 'text-slate-500' : 'text-gray-500'}>请先选择一个图谱</p>
        </div>
      )}
    </div>
  );
};

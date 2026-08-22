import React, { useState, useMemo, useEffect, useId } from 'react';
import { Search, Check, ChevronDown, ChevronRight, Layers, Loader2, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../hooks";
import { EmptyState } from '../common/EmptyState';
import { useGraphs, useGraphData } from '../../hooks/queries';
import type { Node, Graph } from '../../types';

interface KnowledgePointSelectorProps {
  graphId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onGraphChange?: (graphId: string) => void;
  /** 填满父容器高度：树区域自动伸展并内部滚动（用于创建流程整页双栏） */
  fillHeight?: boolean;
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

export const KnowledgePointSelector: React.FC<KnowledgePointSelectorProps> = ({
  graphId: initialGraphId,
  selectedIds,
  onChange,
  onGraphChange,
  fillHeight = false,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [selectedGraphId, setSelectedGraphId] = useState<string>(initialGraphId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const componentId = useId();

  // 预构建已选 id 集合，避免渲染树/列表时对每个节点线性 includes（原为 O(nodes*selectedIds)）
  const selectedIdSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const { data: graphs } = useGraphs();
  const { data: graphData, isLoading: nodesLoading } = useGraphData(selectedGraphId);

  const getLevelLabel = (level: string): string => {
    return t(`quiz.knowledgePointSelector.levelLabels.${level}`, { defaultValue: level });
  };

  const treeData = useMemo(() => {
    if (!graphData?.nodes) return [];

    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    graphData.nodes.forEach((node: Node) => {
      nodeMap.set(node.knowledge_point_id, {
        id: node.knowledge_point_id,
        title: node.title || t('quiz.knowledgePointSelector.unnamedNode'),
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
  }, [graphData, t]);

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

  const renderTreeNode = (node: TreeNode, depth: number = 0, setSize?: number, posInSet?: number) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIdSet.has(node.id);
    const hasChildren = node.children.length > 0;
    const childrenId = `${componentId}-children-${node.id}`;
    const childCount = hasChildren ? node.children.length : 0;

    return (
      <div key={node.id}>
        <div
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-setsize={setSize}
          aria-posinset={posInSet}
          aria-selected={isSelected}
          tabIndex={isSelected ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              if (hasChildren && !isExpanded) {
                e.preventDefault();
                toggleExpand(node.id);
              }
            } else if (e.key === 'ArrowLeft') {
              if (hasChildren && isExpanded) {
                e.preventDefault();
                toggleExpand(node.id);
              }
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSelect(node.id);
            }
          }}
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 ${
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
              aria-expanded={isExpanded}
              aria-controls={childrenId}
              aria-label={
                isExpanded
                  ? t('common.collapse', { defaultValue: '折叠' })
                  : t('common.expand', { defaultValue: '展开' })
              }
              tabIndex={-1}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
            >
              {isExpanded ? (
                <ChevronDown size={14} className={isDark ? 'text-slate-400' : 'text-gray-500'} aria-hidden="true" />
              ) : (
                <ChevronRight size={14} className={isDark ? 'text-slate-400' : 'text-gray-500'} aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className="w-5" aria-hidden="true" />
          )}

          <button
            role="checkbox"
            aria-checked={isSelected}
            aria-label={[node.title, getLevelLabel(node.level)].filter(Boolean).join('，')}
            onClick={() => toggleSelect(node.id)}
            tabIndex={-1}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : isDark
                    ? 'border-slate-600'
                    : 'border-gray-300'
              }`}
              aria-hidden="true"
            >
              {isSelected && <Check size={12} aria-hidden="true" />}
            </span>

            <div
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${levelColors[node.level] || 'bg-gray-400'}`}
              title={getLevelLabel(node.level)}
            />

            <span
              className={`flex-1 text-sm truncate ${
                isDark ? 'text-slate-200' : 'text-gray-700'
              }`}
            >
              {node.title}
            </span>
          </button>

          {hasChildren && (
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`} aria-hidden="true">
              {node.children.length}
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div id={childrenId} role="group">
            {node.children.map((child, index) => renderTreeNode(child, depth + 1, childCount, index + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderSearchResults = () => {
    if (!filteredNodes) return null;

    if (filteredNodes.length === 0) {
      return (
        <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          {t('quiz.knowledgePointSelector.noMatchingNodes')}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filteredNodes.map((node: Node) => {
          const isSelected = selectedIdSet.has(node.knowledge_point_id);
          return (
            <div
              key={node.knowledge_point_id}
              role="checkbox"
              tabIndex={0}
              aria-checked={isSelected}
              aria-label={node.title || node.knowledge_point_id}
              onClick={() => toggleSelect(node.knowledge_point_id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggleSelect(node.knowledge_point_id);
                }
              }}
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
                title={getLevelLabel(node.level || 'leaf')}
              />

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                  {node.title}
                </div>
                {(node.summary || node.content) && (
                  <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {node.summary || node.content}
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
    <div className={`${fillHeight ? 'h-full flex flex-col' : ''} space-y-4`}>
      <div className="space-y-2">
        <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          {t('quiz.knowledgePointSelector.selectGraph')}
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
          <option value="">{t('quiz.knowledgePointSelector.selectGraphPlaceholder')}</option>
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
              placeholder={t('quiz.knowledgePointSelector.searchPlaceholder')}
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
              {t('quiz.knowledgePointSelector.selectedCount', { count: selectedIds.length })}
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {selectedIds.length === graphData?.nodes?.length
                ? t('quiz.knowledgePointSelector.deselectAll')
                : t('quiz.knowledgePointSelector.selectAll')}
            </button>
          </div>

          <div
            className={`rounded-xl border overflow-hidden ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
            } ${fillHeight ? 'flex-1 min-h-0 flex flex-col' : ''}`}
          >
            <div className={`${fillHeight ? 'flex-1 min-h-0' : 'max-h-[300px]'} overflow-y-auto p-2`}>
              {nodesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary-600" />
                </div>
              ) : searchTerm ? (
                renderSearchResults()
              ) : treeData.length > 0 ? (
                <div
                  className="space-y-0.5"
                  role="tree"
                  aria-label={t('quiz.knowledgePointSelector.treeLabel')}
                >
                  {treeData.map((node, index) =>
                    renderTreeNode(node, 0, treeData.length, index + 1),
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={<Network size={32} />}
                  title={t('quiz.empty.noKnowledgePoints')}
                />
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
          <p className={isDark ? 'text-slate-500' : 'text-gray-500'}>
            {t('quiz.knowledgePointSelector.pleaseSelectGraph')}
          </p>
        </div>
      )}
    </div>
  );
};

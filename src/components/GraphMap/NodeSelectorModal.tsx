import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Check, ChevronDown, ChevronRight, Loader2, Network, BookOpen } from 'lucide-react';
import { useTheme } from '../../hooks';
import { useGraphData } from '../../hooks/queries';
import type { Node } from '../../types';

interface NodeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (nodeIds: string[]) => void;
  graphId: string;
  graphTitle: string;
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

export const NodeSelectorModal: React.FC<NodeSelectorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  graphId,
  graphTitle,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: graphData, isLoading: nodesLoading } = useGraphData(graphId);

  const treeData = useMemo(() => {
    if (!graphData?.nodes) return [];

    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    graphData.nodes.forEach((node: Node) => {
      nodeMap.set(node.knowledge_point_id, {
        id: node.knowledge_point_id,
        title: node.title || t('nodeSelector.unnamedNode'),
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

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds([]);
      setSearchTerm('');
    }
  }, [isOpen]);

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
    setSelectedIds(newIds);
  };

  const toggleSelectAll = () => {
    if (!graphData?.nodes) return;

    const allIds = graphData.nodes.map((n: Node) => n.knowledge_point_id);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      onConfirm(selectedIds);
    }
  };

  const getLevelLabel = (level: string) => {
    return t(`nodeSelector.levelLabels.${level}`, { defaultValue: level });
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
            title={getLevelLabel(node.level)}
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
          {t('nodeSelector.noResults')}
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
                title={getLevelLabel(node.level || 'leaf')}
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

  if (!isOpen) return null;

  const nodeCount = graphData?.nodes?.length || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
              <BookOpen size={24} />
              <h3 className="text-xl font-bold">{t('nodeSelector.title')}</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {t('nodeSelector.selectFrom', { title: graphTitle })}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {nodesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary-600" />
            </div>
          ) : nodeCount === 0 ? (
            <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
              <Network size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">{t('nodeSelector.noNodes')}</p>
              <p className="text-sm mt-1">{t('nodeSelector.noNodesHint')}</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
                  size={16}
                />
                <input
                  type="text"
                  placeholder={t('nodeSelector.searchPlaceholder')}
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
                  {t('nodeSelector.selected', { count: selectedIds.length })}
                </div>
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  {selectedIds.length === nodeCount ? t('nodeSelector.deselectAll') : t('nodeSelector.selectAll')}
                </button>
              </div>

              <div
                className={`rounded-xl border overflow-hidden ${
                  isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="max-h-[280px] overflow-y-auto p-2">
                  {searchTerm ? (
                    renderSearchResults()
                  ) : treeData.length > 0 ? (
                    <div className="space-y-0.5">{treeData.map((node) => renderTreeNode(node))}</div>
                  ) : (
                    <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      <Network size={32} className="mx-auto mb-2 opacity-50" />
                      <p>{t('nodeSelector.noNodes')}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {nodeCount > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
            >
              {t('nodeSelector.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="px-8 py-2.5 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('nodeSelector.confirm')}
              {selectedIds.length > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {selectedIds.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

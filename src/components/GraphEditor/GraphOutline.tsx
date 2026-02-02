import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, Circle, Hash, CheckSquare, Square, Trash2, Wand2, MousePointer2, Sparkles } from 'lucide-react';
import { Node, Edge } from '../../types';
import { BatchGenerateDialog } from './BatchGenerateDialog';

interface GraphOutlineProps {
  nodes: Node[];
  edges?: Edge[];
  onNodeClick: (node: Node) => void;
  selectedNodeId: string | null;
  selectedNodeIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onBatchAction?: (action: 'expand_graph' | 'delete' | 'batch_generate_questions', data?: any) => void;
  className?: string;
}

export const GraphOutline: React.FC<GraphOutlineProps> = ({
  nodes,
  edges = [],
  onNodeClick,
  selectedNodeId,
  selectedNodeIds = new Set(),
  onSelectionChange,
  onBatchAction,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBatchGenerateOpen, setIsBatchGenerateOpen] = useState(false);

  // Filter nodes for search mode
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.title.toLowerCase().includes(query) || 
      (node.content && node.content.toLowerCase().includes(query))
    );
  }, [nodes, searchQuery]);

  // Build Tree Structure
  const { rootNodes, childrenMap, parentMap } = useMemo(() => {
    const cMap = new Map<string, Node[]>();
    const pMap = new Map<string, string>(); // childId -> parentId
    const hasParent = new Set<string>();
    
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Helper to get level value
    const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
    const getLevelVal = (n?: Node) => levelOrder[n?.level || 'leaf'] ?? 4;

    // Sort edges to prioritize better parent-child relationships for the tree view
    // We want to avoid "upward" links becoming the primary parent-child relationship in the outline
    const sortedEdges = [...edges].sort((a, b) => {
      const sA = nodeMap.get(a.source_node_id);
      const tA = nodeMap.get(a.target_node_id);
      const sB = nodeMap.get(b.source_node_id);
      const tB = nodeMap.get(b.target_node_id);

      if (!sA || !tA) return 0;
      if (!sB || !tB) return 0;

      const lA_source = getLevelVal(sA);
      const lA_target = getLevelVal(tA);
      const lB_source = getLevelVal(sB);
      const lB_target = getLevelVal(tB);

      // 1. Prefer "Top-Down" relationships (Source Level < Target Level)
      // Difference: (Target - Source). Positive means correct direction (e.g. Root(0) -> Core(1) = 1)
      // Negative means incorrect direction (e.g. Leaf(4) -> Root(0) = -4)
      const diffA = lA_target - lA_source;
      const diffB = lB_target - lB_source;

      const isPosA = diffA > 0;
      const isPosB = diffB > 0;

      // Positive differences (Top-Down) come first
      if (isPosA && !isPosB) return -1;
      if (!isPosA && isPosB) return 1;

      if (isPosA && isPosB) {
        // Both positive: prefer SMALLER difference (tighter parent-child relationship)
        // e.g. Core->Sub (diff=1) is better than Root->Sub (diff=2)
        if (diffA !== diffB) return diffA - diffB;
      } else {
        // Both negative or zero: prefer LARGER difference (closer to 0)
        // e.g. Peer (0) is better than Backlink (-1)
        if (diffA !== diffB) return diffB - diffA;
      }

      // 2. Prefer higher level sources (Root < Core < Sub)
      if (lA_source !== lB_source) return lA_source - lB_source;

      return 0;
    });

    sortedEdges.forEach(edge => {
      const source = nodeMap.get(edge.source_node_id);
      const target = nodeMap.get(edge.target_node_id);
      
      if (source && target) {
        // STRICT TREE CONSTRUCTION:
        // Only add as child if the node doesn't have a parent yet in our tree representation.
        // This prevents cycles and duplicate nodes in the outline view.
        if (!hasParent.has(edge.target_node_id)) {
          if (!cMap.has(edge.source_node_id)) cMap.set(edge.source_node_id, []);
          cMap.get(edge.source_node_id)!.push(target);
          
          hasParent.add(edge.target_node_id);
          pMap.set(edge.target_node_id, edge.source_node_id);
        }
      }
    });

    // Sort children
    cMap.forEach(list => {
      list.sort((a, b) => {
        const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
        const la = levelOrder[a.level || 'leaf'] ?? 4;
        const lb = levelOrder[b.level || 'leaf'] ?? 4;
        if (la !== lb) return la - lb;
        return a.title.localeCompare(b.title);
      });
    });

    // Find roots
    let roots = nodes.filter(n => !hasParent.has(n.id));
    
    // Fallback for cycles/loops where everyone has a parent
    if (roots.length === 0 && nodes.length > 0) {
      roots = nodes.filter(n => n.level === 'root');
      if (roots.length === 0) roots = [nodes[0]];
    }

    // Sort roots
    roots.sort((a, b) => {
      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const la = levelOrder[a.level || 'leaf'] ?? 4;
      const lb = levelOrder[b.level || 'leaf'] ?? 4;
      if (la !== lb) return la - lb;
      return a.title.localeCompare(b.title);
    });

    return { rootNodes: roots, childrenMap: cMap, parentMap: pMap };
  }, [nodes, edges]);

  // Auto-expand path to selected node
  useEffect(() => {
    if (selectedNodeId && !searchQuery) {
      const toExpand = new Set<string>();
      let currentId = parentMap.get(selectedNodeId);
      while (currentId) {
        toExpand.add(currentId);
        currentId = parentMap.get(currentId);
      }
      
      if (toExpand.size > 0) {
        setExpandedNodeIds(prev => {
          const next = new Set(prev);
          toExpand.forEach(id => next.add(id));
          return next;
        });
      }
    }
  }, [selectedNodeId, parentMap, searchQuery]);

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleToggleSelection = (nodeId: string) => {
    if (!onSelectionChange) return;
    const newSet = new Set(selectedNodeIds);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    onSelectionChange(newSet);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedNodeIds.size === nodes.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(nodes.map(n => n.id)));
    }
  };

  const handleBatchGenerateSuccess = () => {
    onSelectionChange?.(new Set());
    setIsMultiSelectMode(false);
    // Notify parent to show success message
    onBatchAction?.('batch_generate_questions'); 
  };

  // Search Mode: Flat List with Hierarchy Sorting (Previous Implementation)
  const renderSearchList = () => {
    // Sort by level then title
    const sortedNodes = [...filteredNodes].sort((a, b) => {
      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const la = levelOrder[a.level || 'leaf'] ?? 4;
      const lb = levelOrder[b.level || 'leaf'] ?? 4;
      if (la !== lb) return la - lb;
      return a.title.localeCompare(b.title);
    });

    if (sortedNodes.length === 0) {
      return <div className="text-center py-8 text-slate-500 text-sm">无匹配节点</div>;
    }

    return sortedNodes.map(node => {
      const level = node.level || 'leaf';
      const isSelected = selectedNodeIds.has(node.id);

      return (
        <div
          key={node.id}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left group
            ${(selectedNodeId === node.id && !isMultiSelectMode)
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          onClick={() => {
            if (isMultiSelectMode) {
              handleToggleSelection(node.id);
            } else {
              onNodeClick(node);
            }
          }}
        >
          {isMultiSelectMode && (
            <div onClick={(e) => { e.stopPropagation(); handleToggleSelection(node.id); }} className="cursor-pointer text-slate-400 hover:text-blue-500">
              {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
            </div>
          )}

          <div 
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: node.color || '#3B82F6' }}
          />
          <span className="truncate flex-1 font-medium">
            {node.title || '未命名节点'}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded uppercase">
            {level}
          </span>
        </div>
      );
    });
  };

  // Tree Mode: Recursive Render
  const renderTree = (node: Node, depth: number, visited: Set<string>) => {
    if (visited.has(node.id)) return null;
    const newVisited = new Set(visited).add(node.id);
    
    const children = childrenMap.get(node.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = selectedNodeIds.has(node.id);
    
    // Indentation handled by paddingLeft
    // Base padding 12px, plus depth * 16px
    const paddingLeft = 12 + depth * 16;

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`w-full flex items-center pr-2 py-1.5 cursor-pointer text-sm transition-colors group
            ${(selectedNodeId === node.id && !isMultiSelectMode)
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            if (isMultiSelectMode) {
              handleToggleSelection(node.id);
            } else {
              onNodeClick(node);
            }
          }}
        >
          {/* Expand Toggle */}
          <div 
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 mr-1 transition-colors ${hasChildren ? 'visible' : 'invisible'}`}
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          
          {isMultiSelectMode && (
            <div onClick={(e) => { e.stopPropagation(); handleToggleSelection(node.id); }} className="mr-2 cursor-pointer text-slate-400 hover:text-blue-500">
              {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
            </div>
          )}

          {/* Node Dot */}
          <div 
            className="w-2 h-2 rounded-full shrink-0 mr-2"
            style={{ backgroundColor: node.color || '#3B82F6' }}
          />
          
          {/* Title */}
          <span className="truncate flex-1 font-medium">
            {node.title || '未命名节点'}
          </span>
          
          {/* Level Badge (Only show on hover or selected to keep clean) */}
          {node.level && (
            <span className={`text-[10px] uppercase ml-2 px-1 rounded hidden group-hover:inline-block
               ${selectedNodeId === node.id ? 'bg-blue-100 dark:bg-blue-800 text-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {node.level}
            </span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderTree(child, depth + 1, newVisited))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 ${className}`}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-3 pr-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            大纲视图 ({nodes.length})
          </h2>
          <button 
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              if (isMultiSelectMode && onSelectionChange) {
                onSelectionChange(new Set()); // Clear selection when exiting
              }
            }}
            className={`p-1.5 rounded transition-colors ${isMultiSelectMode ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title={isMultiSelectMode ? "退出多选" : "多选模式"}
          >
            <MousePointer2 size={16} />
          </button>
        </div>
        
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索节点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>

        {/* Batch Actions Toolbar */}
        {isMultiSelectMode && (
          <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
             <div className="flex items-center gap-2">
                <button 
                  onClick={handleSelectAll}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="全选/取消全选"
                >
                  {selectedNodeIds.size === nodes.length && nodes.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <span className="text-xs text-slate-500 font-medium">{selectedNodeIds.size} 已选</span>
             </div>
             <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsBatchGenerateOpen(true)}
                  disabled={selectedNodeIds.size === 0}
                  className="p-1.5 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="批量生成题目"
                >
                  <Sparkles size={16} />
                </button>
                <button
                  onClick={() => onBatchAction?.('expand_graph')}
                  disabled={selectedNodeIds.size === 0}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="后台拓展"
                >
                  <Wand2 size={16} />
                </button>
                <button
                  onClick={() => onBatchAction?.('delete')}
                  disabled={selectedNodeIds.size === 0}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="批量删除"
                >
                  <Trash2 size={16} />
                </button>
             </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {searchQuery.trim() ? (
          <div className="space-y-0.5 px-2">
            {renderSearchList()}
          </div>
        ) : (
          <div className="space-y-0.5">
             {rootNodes.length === 0 && nodes.length > 0 ? (
                // Fallback if something went wrong with root detection
                nodes.map(node => renderTree(node, 0, new Set()))
             ) : (
                rootNodes.map(node => renderTree(node, 0, new Set()))
             )}
             {nodes.length === 0 && (
               <div className="text-center py-8 text-slate-500 text-sm">
                 暂无节点
               </div>
             )}
          </div>
        )}
      </div>
      
      <BatchGenerateDialog 
        isOpen={isBatchGenerateOpen}
        onClose={() => setIsBatchGenerateOpen(false)}
        selectedNodeIds={Array.from(selectedNodeIds)}
        onSuccess={handleBatchGenerateSuccess}
      />
    </div>
  );
};

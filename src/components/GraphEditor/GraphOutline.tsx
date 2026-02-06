import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, Circle, Hash, CheckSquare, Square, Trash2, Wand2, MousePointer2, Sparkles, List, Layers, ArrowDownAZ, ArrowUpAZ, Filter, ListChecks, Eraser } from 'lucide-react';
import { Node, Edge } from '../../types';
import { BatchGenerateDialog } from './BatchGenerateDialog';
import { GraphStatsSummary } from './GraphStatsSummary';

interface GraphOutlineProps {
  nodes: Node[];
  edges?: Edge[];
  nodeStatus?: Record<string, any>;
  onNodeClick: (node: Node) => void;
  selectedNodeId: string | null;
  selectedNodeIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onBatchAction?: (action: 'expand_graph' | 'delete' | 'batch_generate_questions', data?: any) => void;
  className?: string;
  // Optional stats for the summary dashboard
  stats?: {
    masteredCount: number;
    dueTodayCount: number;
  };
}

export const GraphOutline: React.FC<GraphOutlineProps> = ({
  nodes,
  edges = [],
  nodeStatus,
  onNodeClick,
  selectedNodeId,
  selectedNodeIds = new Set(),
  onSelectionChange,
  onBatchAction,
  className = '',
  stats
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isBatchGenerateOpen, setIsBatchGenerateOpen] = useState(false);
  
  // View Control State
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [sortMode, setSortMode] = useState<'default' | 'title' | 'level'>('default');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  // Log node count for debugging
  useEffect(() => {
    console.log(`[GraphOutline] Received ${nodes.length} nodes and ${edges.length} edges`);
  }, [nodes.length, edges.length]);

  // Process nodes (Search -> Filter -> Sort)
  const processedNodes = useMemo(() => {
    let result = nodes;
    
    // 1. Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(node => 
        node.title.toLowerCase().includes(query) || 
        (node.content && node.content.toLowerCase().includes(query))
      );
    }

    // 2. Filter Level
    if (filterLevel !== 'all') {
      result = result.filter(node => (node.level || 'leaf') === filterLevel);
    }
    
    // 3. Sort (Applies to List Mode mainly, but we prepare it anyway)
    if (viewMode === 'list' || searchQuery.trim() || filterLevel !== 'all') {
       result = [...result].sort((a, b) => {
          if (sortMode === 'title') return a.title.localeCompare(b.title);
          if (sortMode === 'level') {
              const levelOrder: any = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
              return (levelOrder[a.level || 'leaf'] || 4) - (levelOrder[b.level || 'leaf'] || 4);
          }
          // Default: Level then Title (as per original logic)
          const levelOrder: any = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
          const la = levelOrder[a.level || 'leaf'] ?? 4;
          const lb = levelOrder[b.level || 'leaf'] ?? 4;
          if (la !== lb) return la - lb;
          return a.title.localeCompare(b.title);
       });
    }
    
    return result;
  }, [nodes, searchQuery, filterLevel, sortMode, viewMode]);

  // Calculate isolated nodes count
  const isolatedCount = useMemo(() => {
    const connectedNodeIds = new Set<string>();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source_node_id);
      connectedNodeIds.add(edge.target_node_id);
    });
    return nodes.filter(node => !connectedNodeIds.has(node.id)).length;
  }, [nodes, edges]);

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

  // List Mode: Flat List (Used for Search, Filter, or explicit List View)
  const renderList = () => {
    // processedNodes is already sorted and filtered
    if (processedNodes.length === 0) {
      return <div className="text-center py-8 text-slate-500 text-sm">无匹配节点</div>;
    }

    return processedNodes.map(node => {
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

  // Helper to select all direct children of a node
  const handleSelectChildren = (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    
    const children = childrenMap.get(parentId) || [];
    if (children.length === 0) return;
    
    const newSet = new Set(selectedNodeIds);
    // Add all children
    children.forEach(child => newSet.add(child.id));
    
    onSelectionChange(newSet);
    if (!isMultiSelectMode) setIsMultiSelectMode(true);
  };

  // Helper to select isolated nodes (nodes with no edges)
  const handleSelectIsolated = () => {
    if (!onSelectionChange) return;

    const connectedNodeIds = new Set<string>();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source_node_id);
      connectedNodeIds.add(edge.target_node_id);
    });

    const isolatedNodes = nodes.filter(node => !connectedNodeIds.has(node.id));
    
    if (isolatedNodes.length === 0) {
      // toast.success('没有发现孤立节点'); // Assume toast is not available or handled by parent
      return;
    }

    const newSet = new Set(selectedNodeIds);
    isolatedNodes.forEach(node => newSet.add(node.id));
    
    onSelectionChange(newSet);
    if (!isMultiSelectMode) setIsMultiSelectMode(true);
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

          {/* Select Children Button */}
          {hasChildren && (
            <button
              onClick={(e) => handleSelectChildren(node.id, e)}
              className="ml-2 p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded hidden group-hover:flex items-center justify-center transition-colors"
              title="全选子节点"
            >
              <ListChecks size={14} />
            </button>
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
        {stats && (
          <GraphStatsSummary 
            nodes={nodes}
            masteredCount={stats.masteredCount}
            dueTodayCount={stats.dueTodayCount}
            isolatedCount={isolatedCount}
          />
        )}
        <div className="flex justify-between items-center mb-3 pr-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            大纲视图 ({nodes.length})
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSelectIsolated}
              className="p-1.5 rounded transition-colors text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-500"
              title="选中所有孤立节点 (无连线)"
            >
              <Eraser size={16} />
            </button>
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

        {/* View & Filter Controls */}
        <div className="flex items-center gap-2 mb-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`p-1.5 rounded ${viewMode === 'tree' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
              title="树状视图"
            >
              <Layers size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
              title="列表视图"
            >
              <List size={14} />
            </button>
          </div>

          {/* Filter Dropdown */}
          <div className="relative flex-1">
             <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
               <Filter size={12} className="text-slate-400" />
             </div>
             <select
               value={filterLevel}
               onChange={(e) => setFilterLevel(e.target.value)}
               className="w-full pl-7 pr-2 py-1 bg-slate-100 dark:bg-slate-800 border-none rounded text-xs text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
             >
               <option value="all">全部分级</option>
               <option value="root">Root</option>
               <option value="core">Core</option>
               <option value="sub">Sub</option>
               <option value="normal">Normal</option>
               <option value="leaf">Leaf</option>
             </select>
          </div>

          {/* Sort Toggle (List Mode Only) */}
          {(viewMode === 'list' || searchQuery || filterLevel !== 'all') && (
            <button
              onClick={() => setSortMode(prev => prev === 'title' ? 'level' : 'title')}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 hover:text-blue-600"
              title={sortMode === 'title' ? "当前：按标题排序" : "当前：按层级排序"}
            >
              {sortMode === 'title' ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
            </button>
          )}
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
        {(viewMode === 'list' || searchQuery.trim() || filterLevel !== 'all') ? (
          <div className="space-y-0.5 px-2">
            {renderList()}
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

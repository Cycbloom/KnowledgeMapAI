import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Node, Edge } from '../../types';

interface GraphOutlineProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
  selectedNodeId: string | null;
  className?: string;
}

export const GraphOutline: React.FC<GraphOutlineProps> = ({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

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

    edges.forEach(edge => {
      const source = nodeMap.get(edge.source_node_id);
      const target = nodeMap.get(edge.target_node_id);
      
      if (source && target) {
        if (!cMap.has(edge.source_node_id)) cMap.set(edge.source_node_id, []);
        cMap.get(edge.source_node_id)!.push(target);
        
        // We only track one parent for tree view to avoid duplicates in tree
        // If a node has multiple parents, it will appear under the first one processed (or we could show it multiple times)
        // For simplicity in UI state, let's just mark it as having a parent.
        if (!hasParent.has(edge.target_node_id)) {
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
      return (
        <button
          key={node.id}
          onClick={() => onNodeClick(node)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left group
            ${selectedNodeId === node.id 
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
        >
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
        </button>
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
    
    // Indentation handled by paddingLeft
    // Base padding 12px, plus depth * 12px
    const paddingLeft = 12 + depth * 16;

    return (
      <div key={node.id} className="select-none">
        <div 
          onClick={() => onNodeClick(node)}
          className={`w-full flex items-center pr-2 py-1.5 cursor-pointer text-sm transition-colors group
            ${selectedNodeId === node.id 
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {/* Expand Toggle */}
          <div 
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 mr-1 transition-colors ${hasChildren ? 'visible' : 'invisible'}`}
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          
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
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          大纲视图 ({nodes.length})
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索节点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>
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
    </div>
  );
};

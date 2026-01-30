import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, Circle, Hash } from 'lucide-react';
import { Node } from '../../types';

interface GraphOutlineProps {
  nodes: Node[];
  onNodeClick: (node: Node) => void;
  selectedNodeId: string | null;
  className?: string;
}

export const GraphOutline: React.FC<GraphOutlineProps> = ({
  nodes,
  onNodeClick,
  selectedNodeId,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => 
      node.title.toLowerCase().includes(query) || 
      (node.content && node.content.toLowerCase().includes(query))
    );
  }, [nodes, searchQuery]);

  // Group nodes by hierarchy if possible, but flat list with sorting is safer for now
  // Let's sort by level property if exists, or just alphabetical
  const sortedNodes = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      // Prioritize matches that start with query
      if (searchQuery) {
        const aStarts = a.title.toLowerCase().startsWith(searchQuery.toLowerCase());
        const bStarts = b.title.toLowerCase().startsWith(searchQuery.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }
      return a.title.localeCompare(b.title);
    });
  }, [filteredNodes, searchQuery]);

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

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedNodes.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            无匹配节点
          </div>
        ) : (
          sortedNodes.map(node => (
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
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: node.color || '#3B82F6' }}
              />
              <span className="truncate flex-1 font-medium">
                {node.title || '未命名节点'}
              </span>
              {(node.level || node.properties?.level) && (
                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {String(node.level || node.properties?.level).toUpperCase()}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

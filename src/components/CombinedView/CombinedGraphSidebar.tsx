import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronRight, ChevronDown, X, FileText, Tag, Layers, List } from 'lucide-react';
import type { Node, Edge } from '../../types';
import { getLevelColors } from '../../config/learningStatusColors';

interface CombinedGraphSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  nodes1: Node[];
  nodes2: Node[];
  edges1: Edge[];
  edges2: Edge[];
  graph1Title: string;
  graph2Title: string;
  graph1Color: string;
  graph2Color: string;
  selectedNode: Node | null;
  onNodeClick: (node: Node) => void;
  onWidthChange?: (width: number) => void;
}

export const CombinedGraphSidebar: React.FC<CombinedGraphSidebarProps> = ({
  isOpen,
  onClose,
  nodes1,
  nodes2,
  edges1,
  edges2,
  graph1Title,
  graph2Title,
  graph1Color,
  graph2Color,
  selectedNode,
  onNodeClick,
  onWidthChange
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'outline' | 'detail'>('outline');
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth >= 280 && newWidth <= 500) {
        setSidebarWidth(newWidth);
        onWidthChange?.(newWidth);
      }
    }
  }, [isResizing, onWidthChange]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const buildTreeStructure = useCallback((nodes: Node[], edges: Edge[]) => {
    const childrenMap = new Map<string, Node[]>();
    const hasParent = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    edges.forEach(edge => {
      const source = nodeMap.get(edge.source_knowledge_point_id);
      const target = nodeMap.get(edge.target_knowledge_point_id);
      
      if (source && target) {
        if (!hasParent.has(edge.target_knowledge_point_id)) {
          if (!childrenMap.has(edge.source_knowledge_point_id)) {
            childrenMap.set(edge.source_knowledge_point_id, []);
          }
          childrenMap.get(edge.source_knowledge_point_id)!.push(target);
          hasParent.add(edge.target_knowledge_point_id);
        }
      }
    });

    childrenMap.forEach(list => {
      list.sort((a, b) => {
        const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
        const la = levelOrder[a.level || 'leaf'] ?? 4;
        const lb = levelOrder[b.level || 'leaf'] ?? 4;
        if (la !== lb) return la - lb;
        return a.title.localeCompare(b.title);
      });
    });

    let roots = nodes.filter(n => !hasParent.has(n.id));
    
    if (roots.length === 0 && nodes.length > 0) {
      roots = nodes.filter(n => n.level === 'root');
      if (roots.length === 0) roots = [nodes[0]];
    }

    roots.sort((a, b) => {
      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const la = levelOrder[a.level || 'leaf'] ?? 4;
      const lb = levelOrder[b.level || 'leaf'] ?? 4;
      if (la !== lb) return la - lb;
      return a.title.localeCompare(b.title);
    });

    return { rootNodes: roots, childrenMap };
  }, []);

  const tree1 = useMemo(() => buildTreeStructure(nodes1, edges1), [nodes1, edges1, buildTreeStructure]);
  const tree2 = useMemo(() => buildTreeStructure(nodes2, edges2), [nodes2, edges2, buildTreeStructure]);

  const filteredNodes1 = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return nodes1.filter(n => 
      n.title.toLowerCase().includes(query) || 
      (n.content && n.content.toLowerCase().includes(query))
    );
  }, [nodes1, searchQuery]);

  const filteredNodes2 = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return nodes2.filter(n => 
      n.title.toLowerCase().includes(query) || 
      (n.content && n.content.toLowerCase().includes(query))
    );
  }, [nodes2, searchQuery]);

  const toggleExpand = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const TreeNode = ({ 
    node, 
    depth, 
    childrenMap, 
    graphColor,
    visited 
  }: { 
    node: Node; 
    depth: number; 
    childrenMap: Map<string, Node[]>; 
    graphColor: string;
    visited: Set<string>;
  }) => {
    if (visited.has(node.id)) return null;
    const newVisited = new Set(visited).add(node.id);
    
    const children = childrenMap.get(node.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const paddingLeft = 12 + depth * 16;

    return (
      <div className="select-none">
        <div 
          className={`w-full flex items-center pr-2 py-1.5 cursor-pointer text-sm transition-colors group
            ${isSelected
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onNodeClick(node)}
        >
          <div 
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 mr-1 transition-colors ${hasChildren ? 'visible' : 'invisible'}`}
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          
          <div 
            className="w-2 h-2 rounded-full shrink-0 mr-2"
            style={{ backgroundColor: graphColor }}
          />
          
          <span className="truncate flex-1 font-medium">
            {node.title || '未命名节点'}
          </span>
          
          {node.level && (
            <span className={`text-[10px] uppercase ml-2 px-1 rounded hidden group-hover:inline-block
               ${isSelected ? 'bg-blue-100 dark:bg-blue-800 text-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {node.level}
            </span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => (
              <TreeNode 
                key={child.id} 
                node={child} 
                depth={depth + 1} 
                childrenMap={childrenMap}
                graphColor={graphColor}
                visited={newVisited}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderListNode = (node: Node, graphColor: string) => {
    const isSelected = selectedNode?.id === node.id;
    
    return (
      <div
        key={node.id}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left group cursor-pointer
          ${isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        onClick={() => onNodeClick(node)}
      >
        <div 
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: graphColor }}
        />
        <span className="truncate flex-1 font-medium">
          {node.title || '未命名节点'}
        </span>
        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded uppercase">
          {node.level || 'leaf'}
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      ref={sidebarRef}
      className="bg-white dark:bg-slate-900 shadow-lg border-l border-slate-200 dark:border-slate-800 absolute right-0 top-0 bottom-0 z-20 flex flex-col"
      style={{ width: sidebarWidth }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
        onMouseDown={startResizing}
      />
      
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('outline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'outline'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <List size={14} />
            大纲
          </button>
          <button
            onClick={() => setActiveTab('detail')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'detail'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText size={14} />
            详情
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-400"
        >
          <X size={16} />
        </button>
      </div>
      
      {activeTab === 'outline' && (
        <>
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
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
          
          <div className="flex-1 overflow-y-auto">
            {searchQuery.trim() ? (
              <div className="py-2">
                {filteredNodes1 && filteredNodes1.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: graph1Color }} />
                      {graph1Title} ({filteredNodes1.length})
                    </div>
                    <div className="space-y-0.5 px-2">
                      {filteredNodes1.map(n => renderListNode(n, graph1Color))}
                    </div>
                  </div>
                )}
                {filteredNodes2 && filteredNodes2.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: graph2Color }} />
                      {graph2Title} ({filteredNodes2.length})
                    </div>
                    <div className="space-y-0.5 px-2">
                      {filteredNodes2.map(n => renderListNode(n, graph2Color))}
                    </div>
                  </div>
                )}
                {(!filteredNodes1?.length && !filteredNodes2?.length) && (
                  <div className="text-center py-8 text-slate-500 text-sm">无匹配节点</div>
                )}
              </div>
            ) : (
              <div className="py-2">
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: graph1Color }} />
                    {graph1Title} ({nodes1.length})
                  </div>
                  <div className="space-y-0.5">
                    {tree1.rootNodes.map(node => (
                      <TreeNode 
                        key={node.id} 
                        node={node} 
                        depth={0} 
                        childrenMap={tree1.childrenMap}
                        graphColor={graph1Color}
                        visited={new Set()}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: graph2Color }} />
                    {graph2Title} ({nodes2.length})
                  </div>
                  <div className="space-y-0.5">
                    {tree2.rootNodes.map(node => (
                      <TreeNode 
                        key={node.id} 
                        node={node} 
                        depth={0} 
                        childrenMap={tree2.childrenMap}
                        graphColor={graph2Color}
                        visited={new Set()}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'detail' && (
        <div className="flex-1 overflow-y-auto p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedNode.graph_id === nodes1[0]?.graph_id ? graph1Color : graph2Color }}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedNode.graph_id === nodes1[0]?.graph_id ? graph1Title : graph2Title}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedNode.title}
                </h3>
              </div>
              
              {selectedNode.content && (
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">内容</label>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    {selectedNode.content}
                  </p>
                </div>
              )}
              
              <div className="flex gap-4">
                {selectedNode.level && (
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Layers size={10} />
                      等级
                    </label>
                    <span className="text-sm font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                      {selectedNode.level}
                    </span>
                  </div>
                )}
              </div>
              
              {selectedNode.tags && selectedNode.tags.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <Tag size={10} />
                    标签
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((tag, i) => (
                      <span 
                        key={i}
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
              点击节点查看详情
            </div>
          )}
        </div>
      )}
    </div>
  );
};

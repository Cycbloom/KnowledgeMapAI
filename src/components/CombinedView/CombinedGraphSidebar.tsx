import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight, ChevronDown, X, List, Link, Sparkles } from 'lucide-react';
import type { Node, Edge, CrossGraphNodeConnection, NodeLevel } from '../../types';
import { CombinedNodeDetailSidebar } from './CombinedNodeDetailSidebar';
import { CombinedNodeEditSidebar } from './CombinedNodeEditSidebar';
import { EmptyState } from '../common/EmptyState';

type SidebarMode = 'outline' | 'detail' | 'edit' | 'connections';

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
  graph1Id: string;
  graph2Id: string;
  selectedNode: Node | null;
  onNodeClick: (node: Node) => void;
  onWidthChange?: (width: number) => void;
  crossGraphConnections: CrossGraphNodeConnection[];
  aiOps?: {
    handleExpandNode: (prompt?: string) => Promise<{ newNodesCount: number; newEdgesCount: number } | null>;
    handleGenerateContent: (prompt?: string) => Promise<string | null>;
    handleGenerateCards: () => Promise<number | null>;
    handleStartLevelTest: () => void;
    handleStartLearningMode: () => void;
    handleAnalyzeCrossGraphConnections: () => Promise<unknown>;
  };
  nodeOps?: {
    handleUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
    handleDeleteNode: (nodeId: string) => void;
  };
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
  graph1Id,
  selectedNode,
  onNodeClick,
  onWidthChange,
  crossGraphConnections,
  aiOps,
  nodeOps
}) => {
  const { t } = useTranslation();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('outline');
  const [prevSidebarMode, setPrevSidebarMode] = useState<SidebarMode>('outline');
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [nodeForm, setNodeForm] = useState<{
    title: string;
    content: string;
    summary: string;
    level: string;
    tags: string[];
  }>({
    title: '',
    content: '',
    summary: '',
    level: 'normal',
    tags: []
  });

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

  useEffect(() => {
    if (selectedNode && sidebarMode === 'outline') {
      setPrevSidebarMode(sidebarMode);
      setSidebarMode('detail');
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode && sidebarMode === 'edit') {
      setNodeForm({
        title: selectedNode.title || '',
        content: selectedNode.content || '',
        summary: selectedNode.summary || '',
        level: selectedNode.level || 'normal',
        tags: selectedNode.tags || selectedNode.properties?.tags || []
      });
    }
  }, [selectedNode, sidebarMode]);

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
          childrenMap.get(edge.source_knowledge_point_id)?.push(target);
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

  const handleBackToOutline = useCallback(() => {
    setSidebarMode('outline');
    setPrevSidebarMode('outline');
  }, []);

  const handleSwitchToEdit = useCallback(() => {
    if (selectedNode) {
      setNodeForm({
        title: selectedNode.title || '',
        content: selectedNode.content || '',
        summary: selectedNode.summary || '',
        level: selectedNode.level || 'normal',
        tags: selectedNode.tags || selectedNode.properties?.tags || []
      });
    }
    setPrevSidebarMode(sidebarMode);
    setSidebarMode('edit');
  }, [selectedNode, sidebarMode]);

  const handleSwitchToConnections = useCallback(() => {
    setPrevSidebarMode(sidebarMode);
    setSidebarMode('connections');
  }, [sidebarMode]);

  const handleSaveNode = useCallback(() => {
    if (selectedNode && nodeOps?.handleUpdateNode) {
      nodeOps.handleUpdateNode(selectedNode.id, {
        title: nodeForm.title,
        content: nodeForm.content,
        summary: nodeForm.summary,
        level: nodeForm.level as NodeLevel,
        tags: nodeForm.tags
      });
      setSidebarMode('detail');
    }
  }, [selectedNode, nodeForm, nodeOps]);

  const handleDeleteNode = useCallback(() => {
    if (selectedNode && nodeOps?.handleDeleteNode) {
      nodeOps.handleDeleteNode(selectedNode.id);
      setSidebarMode('outline');
    }
  }, [selectedNode, nodeOps]);

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
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => onNodeClick(node)}
        >
          <div 
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 mr-1 transition-colors ${hasChildren ? 'visible' : 'invisible'}`}
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
          >
            {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </div>
          
          <div 
            className="w-2 h-2 rounded-full shrink-0 mr-2"
            style={{ backgroundColor: graphColor }}
          />
          
          <span className="truncate flex-1 font-medium">
            {node.title || t('combinedViewPage.graphSidebar.untitledNode')}
          </span>
          
          {node.level && (
            <span className={`text-[10px] uppercase ml-2 px-1 rounded hidden group-hover:inline-block
               ${isSelected ? 'bg-primary-100 dark:bg-primary-800 text-primary-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
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
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        onClick={() => onNodeClick(node)}
      >
        <div 
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: graphColor }}
        />
        <span className="truncate flex-1 font-medium">
          {node.title || t('combinedViewPage.graphSidebar.untitledNode')}
        </span>
        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded uppercase">
          {node.level || 'leaf'}
        </span>
      </div>
    );
  };

  const getGraphNodeColor = (node: Node | null) => {
    if (!node) return graph1Color;
    return node.graph_id === graph1Id ? graph1Color : graph2Color;
  };

  const getGraphNodeTitle = (node: Node | null) => {
    if (!node) return graph1Title;
    return node.graph_id === graph1Id ? graph1Title : graph2Title;
  };

  const getGraphEdges = (node: Node | null) => {
    if (!node) return edges1;
    return node.graph_id === graph1Id ? edges1 : edges2;
  };

  const getGraphNodes = (node: Node | null) => {
    if (!node) return nodes1;
    return node.graph_id === graph1Id ? nodes1 : nodes2;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={sidebarRef}
      className="bg-white dark:bg-slate-900 shadow-lg border-l border-slate-200 dark:border-slate-800 absolute right-0 top-0 bottom-0 z-20 flex flex-col"
      style={{ width: sidebarWidth }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary-500 transition-colors"
        onMouseDown={startResizing}
      />
      
      {sidebarMode === 'outline' || sidebarMode === 'connections' ? (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarMode('outline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sidebarMode === 'outline'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <List size={14} aria-hidden="true" />
                {t('combinedViewPage.graphSidebar.outline')}
              </button>
              <button
                onClick={handleSwitchToConnections}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sidebarMode === 'connections'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Link size={14} aria-hidden="true" />
                {t('combinedViewPage.graphSidebar.connections')}
                {crossGraphConnections.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                    {crossGraphConnections.length}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.aria.close')}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          
          {sidebarMode === 'outline' && (
            <>
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div
                  role="search"
                  aria-label={t('common.aria.search')}
                  className="relative"
                >
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    aria-label={t('common.aria.search')}
                    placeholder={t('combinedViewPage.graphSidebar.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-md text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
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
                      <div className="text-center py-8 text-slate-500 text-sm">{t('combinedViewPage.graphSidebar.noMatchNodes')}</div>
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
          
          {sidebarMode === 'connections' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                <button
                  onClick={() => aiOps?.handleAnalyzeCrossGraphConnections?.()}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {t('combinedViewPage.graphSidebar.aiAnalyzeConnections')}
                </button>
              </div>
              {crossGraphConnections.length > 0 ? (
                <div className="p-3 space-y-2">
                  {crossGraphConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-primary-500" />
                        <span className="text-sm font-medium truncate flex-1">{conn.node1.title}</span>
                      </div>
                      <div className="flex items-center justify-center my-1">
                        <svg className="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M7 17L17 7M17 7H7M17 7V17" />
                        </svg>
                        <span className="text-xs text-primary-600 dark:text-primary-400 ml-1">{t('combinedViewPage.graphSidebar.sameKnowledge')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium truncate flex-1">{conn.node2.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <EmptyState
                    icon={<Link className="w-12 h-12 text-gray-400 dark:text-slate-400" aria-hidden="true" />}
                    title={t('combinedViewPage.empty.sameKnowledgePoints')}
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : sidebarMode === 'detail' && selectedNode ? (
        <CombinedNodeDetailSidebar
          node={selectedNode}
          graphColor={getGraphNodeColor(selectedNode)}
          graphTitle={getGraphNodeTitle(selectedNode)}
          edges={getGraphEdges(selectedNode)}
          nodes={getGraphNodes(selectedNode)}
          prevSidebarMode={prevSidebarMode}
          onClose={onClose}
          onBack={handleBackToOutline}
          onEdit={handleSwitchToEdit}
          onDelete={handleDeleteNode}
          aiOps={aiOps}
          onNodeClick={onNodeClick}
        />
      ) : sidebarMode === 'edit' && selectedNode ? (
        <CombinedNodeEditSidebar
          node={selectedNode}
          graphColor={getGraphNodeColor(selectedNode)}
          graphTitle={getGraphNodeTitle(selectedNode)}
          nodeForm={nodeForm}
          setNodeForm={setNodeForm}
          onSave={handleSaveNode}
          onClose={onClose}
          onBack={() => setSidebarMode('detail')}
          prevSidebarMode={prevSidebarMode}
        />
      ) : null}
    </div>
  );
};

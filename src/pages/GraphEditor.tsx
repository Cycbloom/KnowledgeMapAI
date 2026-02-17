import React, { useRef, useMemo, lazy, Suspense, useCallback, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { GraphToolbar } from '../components/GraphEditor/GraphToolbar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MindMapCanvas } from '../components/GraphEditor/MindMapCanvas';
import { ExplorationTimeline } from '../components/GraphEditor/ExplorationTimeline';
import { GraphStyleSettings } from '../components/GraphEditor/GraphStyleSettings';

// New Managers and Hooks
import { GraphModalManager } from '../components/GraphEditor/GraphModalManager';
import { GraphSidebarManager } from '../components/GraphEditor/GraphSidebarManager';
import { GraphAnalysisPanel } from '../components/GraphEditor/GraphAnalysisPanel';
import { useGraphEffects } from '../hooks/useGraphEffects';

import { useTheme } from '../hooks/useTheme';
import { useIsMobile } from '../hooks/useIsMobile';
import { useGraph, 
  useGraphData, 
  useGraphNodeStatus, 
  useAIStatus, 
} from '../hooks/useQueries';

// Custom Hooks
import { useGraphEditorState } from '../hooks/useGraphEditorState';
import { useGraphMutations } from '../hooks/useGraphMutations';
import { useGraphHistoryHandlers } from '../hooks/useGraphHistoryHandlers';
import { useGraphNodeOperations } from '../hooks/useGraphNodeOperations';
import { useGraphAIOperations } from '../hooks/useGraphAIOperations';
import { useTutorOperations } from '../hooks/useTutorOperations';
import { useGraphExportOperations } from '../hooks/useGraphExportOperations';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.tsx';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useExplorationPath } from '../hooks/useExplorationPath';
import { getFocusedNodes, getFocusedLinks, getDirectChildren } from '../lib/graphUtils';
import type { Node as GraphNode, ColorScheme, GraphColorMode, LinkStyle, LinkAnimation, GraphViewMode, NodeSizeMode, EdgeWidthMode, BranchSuggestion } from '../types';
import { TimelineView } from '../components/GraphEditor/views/TimelineView';
import { TreeView } from '../components/GraphEditor/views/TreeView';
import { PlanetView } from '../three/PlanetView';
import { ViewModeSelector } from '../components/GraphEditor/ViewModeSelector';
import { useFocusStore } from '../store/useFocusStore';
import { PresentationControls } from '../components/GraphEditor/PresentationControls';
import { ActionResultModal } from '../components/GraphEditor/ActionResultModal';
import { NodeContextMenu } from '../components/GraphEditor/NodeContextMenu';
import { CommandPalette, CommandItem } from '../components/GraphEditor/CommandPalette';
import { ShortcutHelpPanel } from '../components/ShortcutHelpPanel';
import { RAGChatButton } from '../components/GraphEditor/RAGChatPanel';
import { 
  Home, ListChecks, Network, GitBranch, Clock, 
  Sun, Moon, Layout, Focus, LayoutList, Plus, Trash2 
} from 'lucide-react';
import { api, AIAction } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useStore();
  const { addMessage } = useMessageStore();
  const { isDark, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  
  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
  const [actionResult, setActionResult] = useState<{ title: string; content: string } | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [linkStyle, setLinkStyle] = useState<LinkStyle>('curved');
  const [linkAnimation, setLinkAnimation] = useState<LinkAnimation>('none');
  const [nodeSizeMode, setNodeSizeMode] = useState<NodeSizeMode>('fixed');
  const [edgeWidthMode, setEdgeWidthMode] = useState<EdgeWidthMode>('fixed');
  const [coloringMode, setColoringMode] = useState<GraphColorMode>('level'); // Default to level (structure) as requested
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isRAGChatOpen, setIsRAGChatOpen] = useState(false);
  const [ragChatWidth, setRagChatWidth] = useState(420);
  const [isSelectingParent, setIsSelectingParent] = useState(false);

  const handleStartSelectingParent = useCallback(() => {
    setIsSelectingParent(true);
  }, []);

  const handleCancelSelectingParent = useCallback(() => {
    setIsSelectingParent(false);
  }, []);

  // Command Palette Logic
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);



  const { data: graphMeta } = useGraph(id || '');
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || '');
  const { data: nodeStatus } = useGraphNodeStatus(id || '');
  const { data: aiStatus } = useAIStatus(!!token);
  const aiEnabled = aiStatus?.enabled ?? true;
  
  const templateLayout = graphMeta?.settings?.layout;

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // State Hook
  const state = useGraphEditorState();
  const { 
    graphRef, selectedNode, setSelectedNode, selectedNodeIds, setSelectedNodeIds,
    sidebarMode, setSidebarMode, prevSidebarMode, setPrevSidebarMode,
    isDeleteMode, setIsDeleteMode, isPathfindingMode, setIsPathfindingMode,
    showGrid, setShowGrid,
    isFocusMode, setIsFocusMode,
    viewMode, setViewMode,
    focusedNodeId, setFocusedNodeId,
    focusedNodeIds, setFocusedNodeIds,
    focusedLinkIds, setFocusedLinkIds,
    forceShowTextIds, setForceShowTextIds,
    isExplorationMode, setIsExplorationMode,
    branchSuggestions, setBranchSuggestions,
    isTimelineVisible, setIsTimelineVisible,
    historicalAlternativeBranches, setHistoricalAlternativeBranches,
    isAnalysisPanelOpen, setIsAnalysisPanelOpen
  } = state;

  const handleSelectParentFromGraph = useCallback((nodeId: string) => {
    if (selectedNode?.id === nodeId) return;
    state.setNodeForm(prev => {
      const currentIds = prev.parentNodeIds;
      if (currentIds.includes(nodeId)) {
        return { ...prev, parentNodeIds: currentIds.filter(id => id !== nodeId) };
      } else {
        return { ...prev, parentNodeIds: [...currentIds, nodeId] };
      }
    });
  }, [selectedNode, state]);

  useEffect(() => {
    if (sidebarMode === 'none' || (sidebarMode !== 'create' && sidebarMode !== 'edit')) {
      setIsSelectingParent(false);
    }
  }, [sidebarMode]);

  // Presentation Mode Logic
  const presentationPath = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];
    
    // Simple DFS
    const root = nodes.find(n => n.level === 'root') || nodes[0];
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      
      const node = nodes.find(n => n.id === nodeId);
      // Visibility check based on mode
      if (!node) return;
      if (!state.isExplorationMode && node.is_accepted === false) return;

      visited.add(nodeId);
      path.push(nodeId);
      
      const children = edges
        .filter(e => e.source_node_id === nodeId)
        .map(e => e.target_node_id);
      
      children.forEach(childId => dfs(childId));
    };

    if (root) dfs(root.id);
    return path;
  }, [nodes, edges, state.isExplorationMode]);

  // Sync focused node when step changes
  React.useEffect(() => {
    if (state.isPresentationMode && presentationPath.length > 0) {
      const nodeId = presentationPath[state.presentationStep];
      if (nodeId) {
        setFocusedNodeId(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          // Sync sidebar selection
          setSelectedNodeIds(new Set([nodeId]));
          
          // Calculate and sync focused nodes/links for highlighting
          const focusedNodes = getFocusedNodes(nodeId, nodes, edges);
          setFocusedNodeIds(focusedNodes);
          const focusedLinks = getFocusedLinks(focusedNodes, edges);
          setFocusedLinkIds(focusedLinks);
        }
      }
    }
  }, [state.isPresentationMode, state.presentationStep, presentationPath, nodes, edges, setFocusedNodeId, setSelectedNode, setSelectedNodeIds, setFocusedNodeIds, setFocusedLinkIds]);

  // Mutations Hook
  const mutations = useGraphMutations();

  // History Hook
  const { undo, redo, record, canUndo, canRedo } = useGraphHistoryHandlers({ mutations });

  // Operations Hooks
  const nodeOps = useGraphNodeOperations({
    id: id || '',
    nodes,
    edges,
    state,
    mutations,
    record,
    addMessage
  });

  const aiOps = useGraphAIOperations({
    id: id || '',
    nodes,
    edges,
    state,
    mutations,
    record,
    navigate,
    token
  });

  const tutorOps = useTutorOperations({
    id: id || '',
    nodes,
    edges,
    state,
    mutations,
    record
  });

  const exportOps = useGraphExportOperations({
    id: id || '',
    graphMeta,
    nodes,
    edges,
    state,
    mutations,
    navigate
  });

  const interactionOps = useGraphInteraction({
    nodes,
    edges,
    nodeStatus,
    state,
    handleDeleteNode: nodeOps.handleDeleteNode
  });

  // Effects Hook
  useGraphEffects({
    state,
    nodes,
    undo,
    redo,
    canUndo,
    canRedo,
    aiEnabled,
    addMessage,
    isGraphLoading
  });

  // Auto-show timeline when entering exploration mode
  useEffect(() => {
    if (isExplorationMode) {
      setIsTimelineVisible(true);
    }
  }, [isExplorationMode, setIsTimelineVisible]);

  // Exploration Path Hook
  const explorationPathOps = useExplorationPath({ graphId: id });

  // Computed Values
  const lockedNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const result = new Set<string>();
    Object.entries(nodeStatus).forEach(([id, status]: [string, any]) => {
      if (status.locked) result.add(id);
    });
    return result;
  }, [nodeStatus]);

  const masteredNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const result = new Set<string>();
    Object.entries(nodeStatus).forEach(([id, status]: [string, any]) => {
      if (status.mastered) result.add(id);
    });
    return result;
  }, [nodeStatus]);

  const dueTodayNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    const result = new Set<string>();
    Object.entries(nodeStatus).forEach(([id, status]: [string, any]) => {
      if (status.due_today || status.due) result.add(id);
    });
    return result;
  }, [nodeStatus]);

  const graphStats = useMemo(() => {
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      masteredCount: masteredNodeIds.size,
      lockedCount: lockedNodeIds.size,
      dueTodayCount: dueTodayNodeIds.size
    };
  }, [nodes.length, edges.length, masteredNodeIds.size, lockedNodeIds.size, dueTodayNodeIds.size]);

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    undo,
    redo,
    canUndo,
    canRedo,
    deleteNode: nodeOps.handleDeleteNode,
    toggleDeleteMode: () => setIsDeleteMode(prev => !prev),
    togglePathfindingMode: () => setIsPathfindingMode(prev => !prev),
    toggleExplorationMode: () => setIsExplorationMode(prev => !prev),
    toggleGrid: () => setShowGrid(prev => !prev),
    toggleFocusMode: () => setIsFocusMode(prev => !prev),
    toggleSidebar: () => {
      if (sidebarMode === 'none') setSidebarMode('outline');
      else setSidebarMode('none');
    },
    saveNode: nodeOps.handleSaveNode,
    sidebarMode,
    selectedNode,
    viewMode,
    setViewMode
  });

  // Global Shortcuts (new system)
  useGlobalShortcuts({
    handlers: {
      'showHelp': () => setIsShortcutHelpOpen(true),
      'openCommandPalette': () => setIsCommandPaletteOpen(prev => !prev),
      'toggleTheme': toggleTheme,
      'setViewMode:mindmap': () => setViewMode('mindmap'),
      'setViewMode:timeline': () => setViewMode('timeline'),
      'setViewMode:tree': () => setViewMode('tree'),
      'setViewMode:planet': () => setViewMode('planet'),
      'goHome': () => navigate('/'),
      presentationNext: () => {
        if (state.isPresentationMode) {
          state.setPresentationStep(p => Math.min(p + 1, presentationPath.length - 1));
        }
      },
      presentationPrev: () => {
        if (state.isPresentationMode) {
          state.setPresentationStep(p => Math.max(p - 1, 0));
        }
      },
    },
    context: {
      presentationMode: state.isPresentationMode
    }
  });

  const handleCloseSidebar = useCallback(() => {
    if (prevSidebarMode === 'outline') {
      setSidebarMode('outline');
      setPrevSidebarMode('none');
    } else {
      setSidebarMode('none');
    }
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  }, [prevSidebarMode, setSidebarMode, setPrevSidebarMode, setSelectedNode, setSelectedNodeIds]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSelectedNodeIds(new Set([node.id]));
    setSidebarMode('detail');
    
    const focusedNodes = getFocusedNodes(node.id, nodes, edges);
    const focusedLinks = getFocusedLinks(focusedNodes, edges);
    const directChildren = getDirectChildren(node.id, nodes, edges);
    
    setFocusedNodeId(node.id);
    setFocusedNodeIds(focusedNodes);
    setFocusedLinkIds(focusedLinks);
    state.setForceShowTextIds(new Set([node.id, ...directChildren]));
  }, [setSelectedNode, setSelectedNodeIds, setSidebarMode, nodes, edges, setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds, state]);

  const handleGetBranchSuggestions = useCallback(async () => {
    if (!selectedNode || !id) return;
    const suggestions = await aiOps.handleGetBranchSuggestions();
    state.setBranchSuggestions(suggestions);
  }, [selectedNode, id, aiOps, state]);

  const handleCanvasClick = useCallback(() => {
    setFocusedNodeId(null);
    setFocusedNodeIds(new Set());
    setFocusedLinkIds(new Set());
    state.setForceShowTextIds(new Set());
  }, [setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds, state]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const handleExecuteAction = async (action: AIAction, nodeId: string) => {
    try {
        addMessage({ type: 'info', content: `正在执行动作: ${action.name}...` });
        const res = await api.aiActions.execute({
            action_id: action.id,
            node_id: nodeId,
            graph_id: id
        });
        
        // Handle show_result or fallback if data is string
        if (action.target_mode === 'show_result' || typeof res.data === 'string') {
            setActionResult({
                title: action.name,
                content: typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)
            });
            addMessage({ type: 'success', content: `动作执行成功` });
        } else {
            // Invalidate graphData to trigger refetch of nodes/edges
            await queryClient.invalidateQueries({ queryKey: ['graphData', id] });
            // Also invalidate graph stats
            await queryClient.invalidateQueries({ queryKey: ['graphNodeStatus', id] });
            
            let feedback = `动作执行成功: ${action.name}`;
            if (res.message) feedback += ` (${res.message})`;
            
            if (action.target_mode === 'update_node' && res.data?.updatedFields) {
                feedback += `。已更新: ${res.data.updatedFields.join(', ')}`;
            } else if (action.target_mode === 'spawn_children' && res.data?.createdCount) {
                feedback += `。已生成 ${res.data.createdCount} 个子节点`;
            }
            
            addMessage({ type: 'success', content: feedback });
        }
    } catch (err: any) {
        console.error(err);
        addMessage({ type: 'error', content: `执行失败: ${err.message}` });
    }
  };

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-home',
      label: '返回首页',
      icon: <Home size={18} />,
      category: 'navigation',
      action: () => navigate('/'),
      keywords: ['home', 'index', 'back']
    },
    {
      id: 'nav-graphs',
      label: '图谱列表',
      icon: <LayoutList size={18} />,
      category: 'navigation',
      action: () => navigate('/graphs'),
      keywords: ['list', 'graphs', 'all']
    },
    // View Modes
    {
      id: 'view-mindmap',
      label: '思维导图视图',
      icon: <Network size={18} />,
      category: 'view',
      action: () => setViewMode('mindmap'),
      keywords: ['mindmap', 'graph', 'canvas']
    },
    {
      id: 'view-timeline',
      label: '时间轴视图',
      icon: <Clock size={18} />,
      category: 'view',
      action: () => setViewMode('timeline'),
      keywords: ['timeline', 'chronology', 'history']
    },
    {
      id: 'view-tree',
      label: '树形视图',
      icon: <GitBranch size={18} />,
      category: 'view',
      action: () => setViewMode('tree'),
      keywords: ['tree', 'structure']
    },
    // Toggles
    {
      id: 'toggle-sidebar',
      label: sidebarMode === 'none' ? '打开侧边栏' : '关闭侧边栏',
      icon: <Layout size={18} />,
      category: 'view',
      shortcut: 'Space',
      action: () => {
         if (sidebarMode === 'none') setSidebarMode('outline');
         else setSidebarMode('none');
      },
      keywords: ['sidebar', 'panel', 'drawer']
    },
    {
      id: 'toggle-theme',
      label: isDark ? '切换亮色模式' : '切换暗色模式',
      icon: isDark ? <Sun size={18} /> : <Moon size={18} />,
      category: 'view',
      action: toggleTheme,
      keywords: ['theme', 'dark', 'light', 'mode']
    },
    {
      id: 'toggle-focus',
      label: isFocusMode ? '退出专注模式' : '进入专注模式',
      icon: <Focus size={18} />,
      category: 'view',
      action: () => setIsFocusMode(prev => !prev),
      keywords: ['focus', 'zen', 'mode']
    },
    // Actions
    {
        id: 'create-node',
        label: '新建子节点',
        icon: <Plus size={18} />,
        category: 'action',
        shortcut: 'Tab',
        action: () => {
            if (selectedNode) {
                 addMessage({ type: 'info', content: '请使用 Tab 键创建子节点' });
            } else {
                addMessage({ type: 'warning', content: '请先选择一个节点' });
            }
        }
    },
    {
        id: 'delete-node',
        label: '删除节点',
        icon: <Trash2 size={18} />,
        category: 'action',
        shortcut: 'Del',
        action: () => {
             if (selectedNode) {
                 nodeOps.handleDeleteNode(selectedNode);
             } else {
                addMessage({ type: 'warning', content: '请先选择一个节点' });
             }
        }
    }
  ], [navigate, setViewMode, sidebarMode, setSidebarMode, isDark, toggleTheme, isFocusMode, setIsFocusMode, selectedNode, nodeOps, addMessage]);

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${isDark ? 'dark' : ''}`}>
      {/* Main Canvas Area */}
      <div className={`flex-1 h-full relative ${isDeleteMode ? 'cursor-not-allowed' : ''}`}>
        {isGraphLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-white/50 backdrop-blur-sm">
             <div className="text-center">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
               <p className="text-gray-600 font-medium">正在加载数据...</p>
             </div>
          </div>
        )}

        {contextMenu && id && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            graphId={id}
            nodeContent={nodes.find(n => n.id === contextMenu.nodeId)?.content || ''}
            onClose={() => setContextMenu(null)}
            onExecuteAction={handleExecuteAction}
            onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['graph', id] });
                queryClient.invalidateQueries({ queryKey: ['graphNodes', id] });
            }}
          />
        )}
        
        <div className="h-full w-full bg-white relative">
          {viewMode === 'mindmap' && (
            <MindMapCanvas
                ref={graphRef}
                nodes={nodes}
                edges={edges}
                nodeStatus={nodeStatus}
                selectedNodeId={selectedNode?.id}
                onNodeClick={handleNodeClick}
                sidebarMode={sidebarMode}
                focusedNodeIds={focusedNodeIds}
                focusedLinkIds={focusedLinkIds}
                onCanvasClick={handleCanvasClick}
                forceShowTextIds={forceShowTextIds}
                focusedNodeId={focusedNodeId}
                branchSuggestions={branchSuggestions}
                selectedNodeForBranch={selectedNode}
                historicalAlternativeBranches={historicalAlternativeBranches}
                onSelectBranch={async (selectedSuggestion) => {
                  if (!selectedNode || !id) return;
                  
                  const suggestionsToCreate = [...branchSuggestions];
                  setBranchSuggestions([]);
                  
                  const createdNodes: any[] = [];
                  
                  for (const suggestion of suggestionsToCreate) {
                    const isAccepted = suggestion.id === selectedSuggestion.id;
                    const newNode = await aiOps.handleCreateBranch(suggestion, isAccepted);
                    if (newNode) {
                      createdNodes.push({ node: newNode, suggestion, isAccepted });
                    }
                  }
                  
                  if (createdNodes.length > 0) {
                    const selectedNodeData = createdNodes.find(n => n.isAccepted);
                    if (selectedNodeData) {
                      explorationPathOps.addToPath({
                        nodeId: selectedNodeData.node.id,
                        nodeTitle: selectedNodeData.node.title,
                        branchChoice: selectedNodeData.suggestion.title,
                        parentNodeId: selectedNode?.id,
                        branchSuggestionId: selectedNodeData.suggestion.id,
                      alternativeBranches: suggestionsToCreate
                    });
                    setSelectedNode(selectedNodeData.node);
                    setFocusedNodeId(selectedNodeData.node.id);
                    const focusedNodes = getFocusedNodes(selectedNodeData.node.id, nodes, edges);
                    const focusedLinks = getFocusedLinks(focusedNodes, edges);
                    setFocusedNodeIds(focusedNodes);
                    setFocusedLinkIds(focusedLinks);
                    const directChildren = getDirectChildren(selectedNodeData.node.id, nodes, edges);
                    setForceShowTextIds(new Set([selectedNodeData.node.id, ...directChildren]));
                  }
                }
              }}
              isExplorationMode={isExplorationMode}
              colorScheme={colorScheme}
              linkStyle={linkStyle}
              linkAnimation={linkAnimation}
              templateLayout={templateLayout}
              nodeSizeMode={nodeSizeMode}
              edgeWidthMode={edgeWidthMode}
              coloringMode={coloringMode}
              onNodeContextMenu={handleNodeContextMenu}
              isRightPanelOpen={sidebarMode !== 'none'}
              rightPanelWidth={sidebarMode !== 'none' ? state.sidebarWidth : 0}
              graphId={id}
              onLayoutUpdate={(positions) => {
                queryClient.invalidateQueries({ queryKey: ['graphData', id] });
              }}
              isSelectingParent={isSelectingParent}
              onSelectParent={handleSelectParentFromGraph}
              currentNodeId={selectedNode?.id}
              selectedParentIds={state.nodeForm.parentNodeIds}
              leftPanelWidth={isRAGChatOpen ? ragChatWidth : 0}
              onNavigateToGraphMap={() => navigate(`/graph-map?from=${id}`)}
            />
          )}
          {viewMode === 'timeline' && (
            <TimelineView
              nodes={nodes}
              edges={edges}
              nodeStatus={nodeStatus}
              selectedNodeId={selectedNode?.id || null}
              onNodeClick={handleNodeClick}
              colorScheme={colorScheme}
              linkStyle={linkStyle}
              linkAnimation={linkAnimation}
              nodeSizeMode={nodeSizeMode}
              edgeWidthMode={edgeWidthMode}
              coloringMode={coloringMode}
              isRightPanelOpen={sidebarMode !== 'none'}
              rightPanelWidth={sidebarMode !== 'none' ? state.sidebarWidth : 0}
            />
          )}
          {viewMode === 'tree' && (
            <TreeView
              nodes={nodes}
              edges={edges}
              nodeStatus={nodeStatus}
              selectedNodeId={selectedNode?.id || null}
              onNodeClick={handleNodeClick}
              colorScheme={colorScheme}
              linkStyle={linkStyle}
              linkAnimation={linkAnimation}
              nodeSizeMode={nodeSizeMode}
              edgeWidthMode={edgeWidthMode}
              coloringMode={coloringMode}
              focusedNodeIds={focusedNodeIds}
              focusedLinkIds={focusedLinkIds}
              isExplorationMode={isExplorationMode}
              branchSuggestions={branchSuggestions}
              selectedNodeForBranch={selectedNode}
              onSelectBranch={async (selectedSuggestion) => {
                if (!selectedNode || !id) return;
                
                const suggestionsToCreate = [...branchSuggestions];
                setBranchSuggestions([]);
                
                const createdNodes: any[] = [];
                
                for (const suggestion of suggestionsToCreate) {
                  const isAccepted = suggestion.id === selectedSuggestion.id;
                  const newNode = await aiOps.handleCreateBranch(suggestion, isAccepted);
                  if (newNode) {
                    createdNodes.push({ node: newNode, suggestion, isAccepted });
                  }
                }
                
                if (createdNodes.length > 0) {
                  const selectedNodeData = createdNodes.find(n => n.isAccepted);
                  if (selectedNodeData) {
                    explorationPathOps.addToPath({
                      nodeId: selectedNodeData.node.id,
                      nodeTitle: selectedNodeData.node.title,
                      branchChoice: selectedNodeData.suggestion.title,
                      parentNodeId: selectedNode?.id,
                      branchSuggestionId: selectedNodeData.suggestion.id,
                      alternativeBranches: suggestionsToCreate
                    });
                    setSelectedNode(selectedNodeData.node);
                    setFocusedNodeId(selectedNodeData.node.id);
                    const focusedNodes = getFocusedNodes(selectedNodeData.node.id, nodes, edges);
                    const focusedLinks = getFocusedLinks(focusedNodes, edges);
                    setFocusedNodeIds(focusedNodes);
                    setFocusedLinkIds(focusedLinks);
                    const directChildren = getDirectChildren(selectedNodeData.node.id, nodes, edges);
                    setForceShowTextIds(new Set([selectedNodeData.node.id, ...directChildren]));
                  }
                }
              }}
              onSwitchBranch={async (pathItem, selectedSuggestion) => {
                const parentNode = nodes.find(n => n.id === pathItem.parentNodeId);
                if (!parentNode) return;
                
                const branches = pathItem.alternativeBranches || [];
                const createdNodes: any[] = [];
                
                for (const suggestion of branches) {
                  const isAccepted = suggestion.id === selectedSuggestion.id;
                  const newNode = await aiOps.handleCreateBranch(suggestion, isAccepted);
                  if (newNode) {
                    createdNodes.push({ node: newNode, suggestion, isAccepted });
                  }
                }
                
                if (createdNodes.length > 0) {
                  const selectedNodeData = createdNodes.find(n => n.isAccepted);
                  if (selectedNodeData) {
                    explorationPathOps.addToPath({
                      nodeId: selectedNodeData.node.id,
                      nodeTitle: selectedNodeData.node.title,
                      branchChoice: selectedNodeData.suggestion.title,
                      parentNodeId: parentNode.id,
                      branchSuggestionId: selectedNodeData.suggestion.id,
                      alternativeBranches: branches
                    });
                    setHistoricalAlternativeBranches(prev => [
                      ...prev.filter(item => item.nodeId !== parentNode.id),
                      {
                        nodeId: parentNode.id,
                        branches: branches,
                        selectedBranchId: selectedSuggestion.id
                      }
                    ]);
                    setSelectedNode(selectedNodeData.node);
                    setFocusedNodeId(selectedNodeData.node.id);
                    const focusedNodes = getFocusedNodes(selectedNodeData.node.id, nodes, edges);
                    const focusedLinks = getFocusedLinks(focusedNodes, edges);
                    setFocusedNodeIds(focusedNodes);
                    setFocusedLinkIds(focusedLinks);
                    const directChildren = getDirectChildren(selectedNodeData.node.id, nodes, edges);
                    state.setForceShowTextIds(new Set([selectedNodeData.node.id, ...directChildren]));
                  }
                }
              }}
              historicalAlternativeBranches={historicalAlternativeBranches}
            />
          )}
          {viewMode === 'planet' && (
            <PlanetView
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNode?.id || null}
              onNodeClick={handleNodeClick}
              colorScheme={colorScheme}
              coloringMode={coloringMode}
            />
          )}
        </div>
      </div>

      <GraphToolbar 
        onBack={() => navigate('/dashboard')}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        title={graphMeta?.title || '未命名图谱'}
        sidebarMode={sidebarMode}
        setSidebarMode={setSidebarMode}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
        aiEnabled={aiEnabled}
        onTextToGraph={() => state.setIsTextToGraphOpen(true)}
        onAIExpand={aiOps.handleAIExpand}
        onBranchExplore={handleGetBranchSuggestions}
        onBackgroundTask={aiOps.handleBackgroundTask}
        isChatOpen={isRAGChatOpen}
        setIsChatOpen={setIsRAGChatOpen}
        isTutorMode={state.isTutorMode}
        onToggleTutorMode={tutorOps.handleToggleTutorMode}
        isPathfindingMode={isPathfindingMode}
        setIsPathfindingMode={setIsPathfindingMode}
        pathfindingState={{
          startNode: state.pathStartNode,
          endNode: state.pathEndNode,
          pathLength: state.highlightedPath?.nodes.size || 0,
          reset: () => {
            state.setPathStartNode(null);
            state.setPathEndNode(null);
            state.setHighlightedPath(null);
          }
        }}
        onAddNode={nodeOps.handleStartCreate}
        isDeleteMode={isDeleteMode}
        setIsDeleteMode={setIsDeleteMode}
        selectedNodeIds={selectedNodeIds}
        onDeleteSelected={nodeOps.handleDeleteNode}
        onBatchDelete={nodeOps.handleBatchDelete}
        onBatchLevelUpdate={nodeOps.handleBatchLevelUpdate}
        isStyleSettingsOpen={isStyleSettingsOpen}
        setIsStyleSettingsOpen={setIsStyleSettingsOpen}
        colorScheme={colorScheme}
        setColorScheme={setColorScheme}
        linkStyle={linkStyle}
        setLinkStyle={setLinkStyle}
        linkAnimation={linkAnimation}
        setLinkAnimation={setLinkAnimation}
        onOpenSettings={() => state.setIsSettingsOpen(true)}
        isExportMenuOpen={state.isExportMenuOpen}
        setIsExportMenuOpen={state.setIsExportMenuOpen}
        exportActions={{
          onMarkdown: exportOps.handleExportMarkdown,
          onPDF: exportOps.handleExportPDF,
          onJSON: exportOps.handleExportJSON,
          onImage: () => state.setIsExportImageModalOpen(true),
          onAnki: exportOps.handleExportAnki,
          onDeleteGraph: exportOps.handleDeleteGraph
        }}
        onRefresh={() => window.location.reload()}
        onOpenHelp={() => state.setIsHelpOpen(true)}
        onOpenShortcutSettings={() => setIsShortcutHelpOpen(true)}
        onShare={() => state.setIsShareModalOpen(true)}
        onOpenAnalysis={() => setIsAnalysisPanelOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isExplorationMode={isExplorationMode}
        setIsExplorationMode={setIsExplorationMode}
        coloringMode={coloringMode}
        setColoringMode={setColoringMode}
        isTimelineVisible={isTimelineVisible}
        setIsTimelineVisible={setIsTimelineVisible}
        onTogglePresentation={() => {
          if (state.isPresentationMode) {
            state.setIsPresentationMode(false);
            // Reset focus state when exiting presentation mode
            state.setFocusedNodeId(null);
            state.setFocusedNodeIds(new Set());
            state.setFocusedLinkIds(new Set());
          } else {
            state.setIsPresentationMode(true);
            state.setPresentationStep(0);
          }
        }}
        onTogglePodcast={() => state.setIsPodcastModalOpen(true)}
        isRAGChatOpen={isRAGChatOpen}
        ragChatWidth={ragChatWidth}
      />

      {state.isPresentationMode && (
        <PresentationControls
          currentStep={state.presentationStep}
          totalSteps={presentationPath.length}
          onNext={() => state.setPresentationStep(p => Math.min(p + 1, presentationPath.length - 1))}
          onPrev={() => state.setPresentationStep(p => Math.max(p - 1, 0))}
          onExit={() => {
            state.setIsPresentationMode(false);
            // Reset focus state when exiting presentation mode
            state.setFocusedNodeId(null);
            state.setFocusedNodeIds(new Set());
            state.setFocusedLinkIds(new Set());
          }}
        />
      )}

      {isTimelineVisible && isExplorationMode && (
        <ExplorationTimeline
          explorationPath={explorationPathOps.explorationPath}
          currentPathIndex={explorationPathOps.currentPathIndex}
          sidebarMode={sidebarMode}
          onGoToIndex={(index) => {
            explorationPathOps.goToPathIndex(index);
            const pathItem = explorationPathOps.explorationPath[index];
            if (pathItem) {
              const node = nodes.find(n => n.id === pathItem.nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                const focusedNodes = getFocusedNodes(node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(node.id, nodes, edges);
                state.setForceShowTextIds(new Set([node.id, ...directChildren]));
              }
            }
          }}
          onGoBack={() => {
            explorationPathOps.goBack();
            const pathItem = explorationPathOps.getCurrentPathItem();
            if (pathItem) {
              const node = nodes.find(n => n.id === pathItem.nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                const focusedNodes = getFocusedNodes(node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(node.id, nodes, edges);
                state.setForceShowTextIds(new Set([node.id, ...directChildren]));
              }
            }
          }}
          onGoForward={() => {
            explorationPathOps.goForward();
            const pathItem = explorationPathOps.getCurrentPathItem();
            if (pathItem) {
              const node = nodes.find(n => n.id === pathItem.nodeId);
              if (node) {
                setSelectedNode(node);
                setFocusedNodeId(node.id);
                const focusedNodes = getFocusedNodes(node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(node.id, nodes, edges);
                state.setForceShowTextIds(new Set([node.id, ...directChildren]));
              }
            }
          }}
          onSwitchBranch={async (pathItem, selectedSuggestion) => {
            const parentNode = nodes.find(n => n.id === pathItem.parentNodeId);
            if (!parentNode) return;
            
            const branches = pathItem.alternativeBranches || [];
            const createdNodes: any[] = [];
            
            for (const suggestion of branches) {
              const isAccepted = suggestion.id === selectedSuggestion.id;
              const newNode = await aiOps.handleCreateBranch(suggestion, isAccepted);
              if (newNode) {
                createdNodes.push({ node: newNode, suggestion, isAccepted });
              }
            }
            
            if (createdNodes.length > 0) {
              const selectedNodeData = createdNodes.find(n => n.isAccepted);
              if (selectedNodeData) {
                explorationPathOps.addToPath({
                  nodeId: selectedNodeData.node.id,
                  nodeTitle: selectedNodeData.node.title,
                  branchChoice: selectedNodeData.suggestion.title,
                  parentNodeId: parentNode.id,
                  branchSuggestionId: selectedNodeData.suggestion.id,
                  alternativeBranches: branches
                });
                setHistoricalAlternativeBranches(prev => [
                  ...prev.filter(item => item.nodeId !== parentNode.id),
                  {
                    nodeId: parentNode.id,
                    branches: branches,
                    selectedBranchId: selectedSuggestion.id
                  }
                ]);
                setSelectedNode(selectedNodeData.node);
                setFocusedNodeId(selectedNodeData.node.id);
                const focusedNodes = getFocusedNodes(selectedNodeData.node.id, nodes, edges);
                const focusedLinks = getFocusedLinks(focusedNodes, edges);
                setFocusedNodeIds(focusedNodes);
                setFocusedLinkIds(focusedLinks);
                const directChildren = getDirectChildren(selectedNodeData.node.id, nodes, edges);
                state.setForceShowTextIds(new Set([selectedNodeData.node.id, ...directChildren]));
              }
            }
          }}
          canGoBack={explorationPathOps.canGoBack()}
          canGoForward={explorationPathOps.canGoForward()}
          isDark={isDark}
          isCollapsed={!isTimelineVisible}
          onToggleCollapse={() => state.setIsTimelineVisible(!isTimelineVisible)}
        />
      )}

      {sidebarMode === 'none' && !isMobile && (
        <button 
          onClick={() => setSidebarMode('outline')}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white dark:bg-slate-800 p-2 rounded-l-xl shadow-lg border-y border-l border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 transition-all hover:pr-4"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      
      <ActionResultModal
        isOpen={!!actionResult}
        onClose={() => setActionResult(null)}
        title={actionResult?.title || ''}
        content={actionResult?.content || ''}
      />

      <GraphModalManager 
        id={id || ''}
        state={state}
        graphMeta={graphMeta}
        aiEnabled={aiEnabled}
        tutorOps={tutorOps}
        nodes={nodes}
      />

      <GraphStyleSettings
        isOpen={isStyleSettingsOpen}
        onClose={() => setIsStyleSettingsOpen(false)}
        currentColorScheme={colorScheme}
        currentLinkStyle={linkStyle}
        currentLinkAnimation={linkAnimation}
        onColorSchemeChange={setColorScheme}
        onLinkStyleChange={setLinkStyle}
        onLinkAnimationChange={setLinkAnimation}
        nodeSizeMode={nodeSizeMode}
        onNodeSizeModeChange={setNodeSizeMode}
        edgeWidthMode={edgeWidthMode}
        onEdgeWidthModeChange={setEdgeWidthMode}
        coloringMode={coloringMode}
      />
      
      <GraphSidebarManager 
        state={state}
        nodes={nodes}
        edges={edges}
        nodeStatus={nodeStatus}
        graphStats={graphStats}
        nodeOps={nodeOps}
        aiOps={aiOps}
        interactionOps={interactionOps}
        handleCloseSidebar={handleCloseSidebar}
        isExplorationMode={isExplorationMode}
        isSelectingParent={isSelectingParent}
        onStartSelectingParent={handleStartSelectingParent}
        onCancelSelectingParent={handleCancelSelectingParent}
        onSelectParentFromGraph={handleSelectParentFromGraph}
      />
      
      <GraphAnalysisPanel
        graphId={id || ''}
        isOpen={isAnalysisPanelOpen}
        onClose={() => setIsAnalysisPanelOpen(false)}
        nodes={nodes}
        onNodeClick={(nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) handleNodeClick(node);
        }}
        onCreateConnection={async (sourceId, targetId) => {
          try {
            await mutations.createEdgeMutation.mutateAsync({
              source_node_id: sourceId,
              target_node_id: targetId,
              graphId: id || '',
              relationship_type: 'related'
            });
            addMessage({ content: '连接已创建', type: 'success' });
          } catch (error: any) {
            addMessage({ content: '创建连接失败: ' + (error.message || '未知错误'), type: 'error' });
          }
        }}
      />
      
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
        nodes={nodes}
        onNodeSelect={(nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) {
            handleNodeClick(node);
            if (viewMode !== 'mindmap') {
               setViewMode('mindmap');
            }
          }
        }}
      />
      
      <ShortcutHelpPanel
        isOpen={isShortcutHelpOpen}
        onClose={() => setIsShortcutHelpOpen(false)}
      />

      <RAGChatButton
        graphId={id}
        currentNodeId={selectedNode?.id}
        currentNodeTitle={selectedNode?.title}
        onNodeClick={(nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) handleNodeClick(node);
        }}
        isOpen={isRAGChatOpen}
        onOpenChange={setIsRAGChatOpen}
        selectedNodeIds={Array.from(selectedNodeIds)}
        aiEnabled={aiEnabled}
        isTutorMode={state.isTutorMode}
        tutorMode={state.tutorMode}
        extractedConcepts={state.extractedConcepts}
        onToggleTutorMode={tutorOps.handleToggleTutorMode}
        onSwitchTutorMode={state.setTutorMode}
        onExtractConcepts={tutorOps.handleExtractConcepts}
        onAddConceptToGraph={tutorOps.handleAddConceptToGraph}
        onAddAllConcepts={tutorOps.handleAddAllConcepts}
        onSuggestNextTopics={tutorOps.handleSuggestNextTopics}
        suggestedNextTopics={state.suggestedNextTopics}
        onTutorChat={tutorOps.handleTutorChat}
        width={ragChatWidth}
        onWidthChange={setRagChatWidth}
      />
    </div>
  );
};
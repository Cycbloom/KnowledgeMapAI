import React, { useRef, useMemo, lazy, Suspense, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { ArrowLeft, LayoutList, Network, Loader2 } from 'lucide-react';

import { GraphToolbar } from '../components/GraphEditor/GraphToolbar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MindMapCanvas } from '../components/GraphEditor/MindMapCanvas';
import { ExplorationTimeline } from '../components/GraphEditor/ExplorationTimeline';
import { GraphStyleSettings } from '../components/GraphEditor/GraphStyleSettings';

// New Managers and Hooks
import { GraphModalManager } from '../components/GraphEditor/GraphModalManager';
import { GraphSidebarManager } from '../components/GraphEditor/GraphSidebarManager';
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
import { useExplorationPath } from '../hooks/useExplorationPath';
import { getFocusedNodes, getFocusedLinks, getDirectChildren } from '../lib/graphUtils';
import type { Node as GraphNode, ColorScheme, LinkStyle, LinkAnimation } from '../types';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useStore();
  const { addMessage } = useMessageStore();
  const { isDark, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  
  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [linkStyle, setLinkStyle] = useState<LinkStyle>('curved');
  const [linkAnimation, setLinkAnimation] = useState<LinkAnimation>('none');
  
  // React Query Hooks
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
    collapsedNodeIds,
    highlightedPath,
    viewMode, setViewMode,
    focusedNodeId, setFocusedNodeId,
    focusedNodeIds, setFocusedNodeIds,
    focusedLinkIds, setFocusedLinkIds,
    forceShowTextIds, setForceShowTextIds,
    isExplorationMode, setIsExplorationMode,
    branchSuggestions, setBranchSuggestions,
    explorationPath, setExplorationPath,
    currentPathIndex, setCurrentPathIndex,
    isTimelineVisible, setIsTimelineVisible,
    historicalAlternativeBranches, setHistoricalAlternativeBranches
  } = state;

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

  // Exploration Path Hook
  const explorationPathOps = useExplorationPath();

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
    selectedNode
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

  return (
    <div className="flex h-full relative">
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
        
        <div className="h-full w-full bg-white relative">
          <MindMapCanvas
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
            />
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
        isChatOpen={state.isChatOpen}
        setIsChatOpen={state.setIsChatOpen}
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
        onBatchColorUpdate={nodeOps.handleBatchColorUpdate}
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
          onDeleteGraph: exportOps.handleDeleteGraph
        }}
        onRefresh={() => window.location.reload()}
        onOpenHelp={() => state.setIsHelpOpen(true)}
        onShare={() => state.setIsShareModalOpen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isExplorationMode={isExplorationMode}
        setIsExplorationMode={setIsExplorationMode}
        isTimelineVisible={isTimelineVisible}
        setIsTimelineVisible={setIsTimelineVisible}
      />

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
      
      <GraphModalManager 
        id={id || ''}
        state={state}
        graphMeta={graphMeta}
        aiEnabled={aiEnabled}
        tutorOps={tutorOps}
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
      />
      
      {!isDeleteMode && !isPathfindingMode && selectedNodeIds.size === 0 && (
        <div className="absolute bottom-4 left-4 text-[10px] text-gray-400 dark:text-gray-500 bg-white/50 dark:bg-slate-900/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
          按住 Shift 键并拖动鼠标进行框选
        </div>
      )}
      
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
      />
    </div>
  );
};
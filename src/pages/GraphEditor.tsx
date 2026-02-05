import React, { useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { ArrowLeft, LayoutList, Network, Loader2 } from 'lucide-react';

import { GraphToolbar } from '../components/GraphEditor/GraphToolbar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GraphOutline } from '../components/GraphEditor/GraphOutline';
import { MindMapCanvas } from '../components/GraphEditor/MindMapCanvas';

// New Managers and Hooks
import { GraphModalManager } from '../components/GraphEditor/GraphModalManager';
import { GraphSidebarManager } from '../components/GraphEditor/GraphSidebarManager';
import { useGraphEffects } from '../hooks/useGraphEffects';

import { useTheme } from '../hooks/useTheme';
import { useIsMobile } from '../hooks/useIsMobile';
import { 
  useGraph, 
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
import { useGraphExportOperations } from '../hooks/useGraphExportOperations';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.tsx';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useStore();
  const { addMessage } = useMessageStore();
  const { isDark, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  
  // React Query Hooks
  const { data: graphMeta } = useGraph(id || '');
  const { data: graphData, isLoading: isGraphLoading } = useGraphData(id || '');
  const { data: nodeStatus } = useGraphNodeStatus(id || '');
  const { data: aiStatus } = useAIStatus(!!token);
  const aiEnabled = aiStatus?.enabled ?? true;

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
    viewMode, setViewMode
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

  // Computed Values
  const lockedNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    return new Set(
      Object.entries(nodeStatus)
        .filter(([_, status]: [string, any]) => status.locked)
        .map(([id]) => id)
    );
  }, [nodeStatus]);

  const masteredNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    return new Set(
      Object.entries(nodeStatus)
        .filter(([_, status]: [string, any]) => status.mastered)
        .map(([id]) => id)
    );
  }, [nodeStatus]);

  const dueTodayNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    return new Set(
      Object.entries(nodeStatus)
        .filter(([_, status]: [string, any]) => status.due_today || status.due)
        .map(([id]) => id)
    );
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

  const handleCloseSidebar = () => {
    if (prevSidebarMode === 'outline') {
      setSidebarMode('outline');
      setPrevSidebarMode('none');
    } else {
      setSidebarMode('none');
    }
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  };

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
        
        {viewMode === 'outline' ? (
          <div className="h-full w-full bg-white relative pt-14">
            <GraphOutline 
              nodes={nodes} 
              edges={edges}
              nodeStatus={nodeStatus}
              onNodeClick={(node) => {
                setSelectedNode(node);
                setSidebarMode('detail'); 
              }}
              selectedNodeId={selectedNode?.id}
              selectedNodeIds={selectedNodeIds}
              onSelectionChange={setSelectedNodeIds}
              onBatchAction={(action) => {
                if (action === 'expand_graph') aiOps.handleBackgroundTask('expand_graph');
                else if (action === 'delete') nodeOps.handleBatchDelete();
                else if (action === 'batch_generate_questions') aiOps.handleBackgroundTask('batch_generate_questions');
              }}
              stats={graphStats}
              className="h-full border-none"
            />
          </div>
        ) : (
          <div className="h-full w-full bg-white relative pt-14">
            <MindMapCanvas
              nodes={nodes}
              edges={edges}
              nodeStatus={nodeStatus}
              selectedNodeId={selectedNode?.id}
              onNodeClick={(node) => {
                setSelectedNode(node);
                setSidebarMode('detail');
              }}
              sidebarMode={sidebarMode}
            />
          </div>
        )}
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
        onBackgroundTask={aiOps.handleBackgroundTask}
        isChatOpen={state.isChatOpen}
        setIsChatOpen={state.setIsChatOpen}
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
      />

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
        exportOps={exportOps}
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
      />
    </div>
  );
};
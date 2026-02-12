import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Node, Edge } from '../../types';
import { GraphEditorState } from '../../hooks/useGraphEditorState';
import { NodeDetailSidebar } from './NodeDetailSidebar';
import { NodeEditSidebar } from './NodeEditSidebar';
import { GraphOutline } from './GraphOutline';
import { ErrorBoundary } from '../ErrorBoundary';
import { X, GripVertical } from 'lucide-react';

interface GraphSidebarManagerProps {
  state: GraphEditorState;
  nodes: Node[];
  edges: Edge[];
  nodeStatus: any;
  graphStats: any;
  nodeOps: any;
  aiOps: any;
  interactionOps: any;
  handleCloseSidebar: () => void;
  isExplorationMode?: boolean;
}

export const GraphSidebarManager: React.FC<GraphSidebarManagerProps> = ({
  state,
  nodes,
  edges,
  nodeStatus,
  graphStats,
  nodeOps,
  aiOps,
  interactionOps,
  handleCloseSidebar,
  isExplorationMode = false
}) => {
  const {
    sidebarMode, setSidebarMode,
    prevSidebarMode, setPrevSidebarMode,
    selectedNode, setSelectedNode,
    selectedNodeIds, setSelectedNodeIds,
    nodeForm, setNodeForm,
    loading,
    showRelatedSection, isRelatedLoading, relatedNodes,
    sidebarWidth, setSidebarWidth,
  } = state;

  // Sidebar Resizing Logic
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing, setSidebarWidth]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  if (sidebarMode === 'none') return null;

  return (
    <ErrorBoundary fallback={
      <div className="w-80 bg-white shadow-lg border-l border-gray-200 absolute right-0 top-0 bottom-0 z-20 flex flex-col p-4 items-center justify-center">
        <div className="text-red-500 font-bold mb-2">侧边栏组件出错</div>
        <button onClick={handleCloseSidebar} className="text-blue-600 hover:underline">关闭侧边栏</button>
      </div>
    }>
      <div 
        ref={sidebarRef}
        className={`bg-white shadow-lg border-l border-gray-200 absolute right-0 top-0 bottom-0 z-20 flex flex-col ${sidebarMode !== 'outline' ? 'p-4 overflow-y-auto' : ''}`}
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50 flex items-center justify-center group transition-colors"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-blue-500 transition-colors" />
        </div>

        {sidebarMode === 'outline' ? (
           <div className="h-full relative flex flex-col">
             <div className="absolute right-2 top-2 z-10">
               <button onClick={handleCloseSidebar} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                 <X size={20} />
               </button>
             </div>
             <GraphOutline 
              nodes={nodes} 
              edges={edges}
              onNodeClick={interactionOps.handleNodeClick} 
              selectedNodeId={selectedNode?.id}
              selectedNodeIds={selectedNodeIds}
              onSelectionChange={setSelectedNodeIds}
              onBatchAction={(action: string, data?: any) => {
                if (action === 'expand_graph') aiOps.handleBackgroundTask('expand_graph');
                else if (action === 'delete') nodeOps.handleBatchDelete();
                else if (action === 'batch_generate_questions') aiOps.handleBackgroundTask('batch_generate_questions', data);
              }}
              className="h-full"
              stats={graphStats}
            />
           </div>
        ) : sidebarMode === 'detail' && selectedNode ? (
          <NodeDetailSidebar
            node={nodes.find(n => n.id === selectedNode.id) || selectedNode}
            nodes={nodes}
            edges={edges}
            prevSidebarMode={prevSidebarMode}
            nodeStatus={nodeStatus}
            onClose={handleCloseSidebar}
            onBack={() => {
              setSidebarMode('outline');
              setPrevSidebarMode('none');
            }}
            onEdit={() => {
            if (selectedNode) {
              const parentEdge = edges.find(e => e.target_node_id === selectedNode.id);
              setNodeForm({
                title: selectedNode.title,
                content: selectedNode.content || '',
                color: selectedNode.color || '#3B82F6',
                parentNodeId: parentEdge ? parentEdge.source_node_id : '',
                level: selectedNode.level || 'normal',
                tags: selectedNode.tags || selectedNode.properties?.tags || []
              });
            }
            setPrevSidebarMode(sidebarMode);
            setSidebarMode('edit');
          }}
            onDelete={() => nodeOps.handleDeleteNode()}
            onStartLevelTest={aiOps.handleStartLevelTest}
            onStartLearningMode={aiOps.handleStartLearningMode}
            onGenerateCards={aiOps.handleAIGenerateCards}
            onFetchRelatedNodes={aiOps.handleFetchRelatedNodes}
            showRelatedSection={showRelatedSection}
            isRelatedLoading={isRelatedLoading}
            relatedNodes={relatedNodes}
            onRelatedNodeClick={(node) => {
              setSelectedNode(node);
            }}
            onUpdateNode={(nodeId, updates) => {
              nodeOps.handleUpdateNode(nodeId, updates);
            }}
            isExplorationMode={isExplorationMode}
            onGenerateNodeContent={aiOps.handleGenerateNodeContent}
            onDeepAnalysis={() => aiOps.handleBackgroundTask('deep_analysis')}
            onGenerateQuiz={() => aiOps.handleBackgroundTask('generate_questions')}
            onBackgroundGenerate={() => aiOps.handleBackgroundTask('expand_graph')}
          />
        ) : (sidebarMode === 'create' || sidebarMode === 'edit') ? (
          <NodeEditSidebar
            mode={sidebarMode as 'create' | 'edit'}
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
            onSave={nodeOps.handleSaveNode}
            onClose={handleCloseSidebar}
            onBack={() => {
              setSidebarMode('outline');
              setPrevSidebarMode('none');
            }}
            prevSidebarMode={prevSidebarMode}
            loading={loading}
            nodes={nodes}
          />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

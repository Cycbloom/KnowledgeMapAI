import React from 'react';
import { Node, Edge } from '../../types';
import { GraphEditorState } from '../../hooks/useGraphEditorState';
import { NodeDetailSidebar } from './NodeDetailSidebar';
import { NodeEditSidebar } from './NodeEditSidebar';
import { GraphOutline } from './GraphOutline';
import { ErrorBoundary } from '../ErrorBoundary';
import { X } from 'lucide-react';

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
  } = state;

  if (sidebarMode === 'none') return null;

  return (
    <ErrorBoundary fallback={
      <div className="w-80 bg-white shadow-lg border-l border-gray-200 absolute right-0 top-0 bottom-0 z-20 flex flex-col p-4 items-center justify-center">
        <div className="text-red-500 font-bold mb-2">侧边栏组件出错</div>
        <button onClick={handleCloseSidebar} className="text-blue-600 hover:underline">关闭侧边栏</button>
      </div>
    }>
      <div className={`w-80 bg-white shadow-lg border-l border-gray-200 absolute right-0 top-0 bottom-0 z-20 flex flex-col ${sidebarMode !== 'outline' ? 'p-4 overflow-y-auto' : ''}`}>
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
              onBatchAction={(action: string) => {
                if (action === 'expand_graph') aiOps.handleBackgroundTask('expand_graph');
                else if (action === 'delete') nodeOps.handleBatchDelete();
                else if (action === 'batch_generate_questions') aiOps.handleBackgroundTask('batch_generate_questions');
              }}
              className="h-full"
              stats={graphStats}
            />
           </div>
        ) : sidebarMode === 'detail' && selectedNode ? (
          <NodeDetailSidebar
            node={selectedNode}
            edges={edges}
            prevSidebarMode={prevSidebarMode}
            nodeStatus={nodeStatus}
            onClose={handleCloseSidebar}
            onBack={() => {
              setSidebarMode('outline');
              setPrevSidebarMode('none');
            }}
            onEdit={() => {
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

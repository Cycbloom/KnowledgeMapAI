import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Node, Edge } from "../../../types";
import { GraphEditorState } from "../../../hooks";
import { useIsMobile } from "../../../hooks";
import {
  getFocusedNodes,
  getFocusedLinks,
  getDirectChildren,
} from "../../../lib/graphUtils";
import { NodeDetailSidebar } from "./NodeDetailSidebar";
import { NodeEditSidebar } from "./NodeEditSidebar";
import { GraphOutline } from "../panels/GraphOutline";
import { ErrorBoundary } from "../../common";
import { X, GripHorizontal } from "lucide-react";
import { VersionHistoryModal } from "../modals/VersionHistoryModal";
import { CreateRegionDialog } from "../modals/CreateRegionDialog";
import type { CustomRegion } from "@shared/types/graph";

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
  isSelectingParent?: boolean;
  onStartSelectingParent?: () => void;
  onCancelSelectingParent?: () => void;
  onSelectParentFromGraph?: (nodeId: string) => void;
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  isReadOnly?: boolean;
  customRegions?: CustomRegion[];
  onCreateRegion?: (
    region: Omit<CustomRegion, "id" | "createdAt" | "updatedAt">,
  ) => void;
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
  isExplorationMode = false,
  isSelectingParent = false,
  onStartSelectingParent,
  onCancelSelectingParent,
  onConnectNodes,
  isReadOnly = false,
  customRegions: _customRegions = [],
  onCreateRegion,
}) => {
  const {
    sidebarMode,
    setSidebarMode,
    prevSidebarMode,
    setPrevSidebarMode,
    selectedNode,
    setSelectedNode,
    selectedNodeIds,
    setSelectedNodeIds,
    nodeForm,
    setNodeForm,
    loading,
    showRelatedSection,
    isRelatedLoading,
    relatedNodes,
    sidebarWidth,
    setSidebarWidth,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    setForceShowTextIds,
  } = state;

  const { isMobile } = useIsMobile();
  const [isResizing, setIsResizing] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isCreateRegionOpen, setIsCreateRegionOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile) return;
      setIsResizing(true);
      e.preventDefault();
    },
    [isMobile],
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && !isMobile) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 300 && newWidth <= 800) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing, setSidebarWidth, isMobile],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return;
      touchStartY.current = e.touches[0].clientY;
      touchCurrentY.current = e.touches[0].clientY;
      setIsDragging(true);
    },
    [isMobile],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || !isDragging) return;
      touchCurrentY.current = e.touches[0].clientY;
    },
    [isMobile, isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging) return;
    const deltaY = touchCurrentY.current - touchStartY.current;
    if (deltaY > 100) {
      handleCloseSidebar();
    }
    setIsDragging(false);
  }, [isMobile, isDragging, handleCloseSidebar]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  if (sidebarMode === "none") return null;

  const versionHistoryModal = isVersionHistoryOpen && selectedNode && (
    <VersionHistoryModal
      isOpen={isVersionHistoryOpen}
      onClose={() => setIsVersionHistoryOpen(false)}
      knowledgePointId={selectedNode.knowledge_point_id || selectedNode.id}
      knowledgePointTitle={selectedNode.title || "未命名知识点"}
      onRollback={() => {
        if (nodeOps?.handleRefreshNode) {
          nodeOps.handleRefreshNode();
        }
      }}
    />
  );

  const renderSidebarContent = () => (
    <>
      {sidebarMode === "outline" ? (
        <div className="h-full relative flex flex-col">
          <div className="absolute right-2 top-2 z-10">
            <button
              onClick={handleCloseSidebar}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>
          </div>
          <GraphOutline
            nodes={nodes}
            edges={edges}
            onNodeClick={interactionOps.handleNodeClick}
            selectedNodeId={selectedNode?.id ?? null}
            selectedNodeIds={selectedNodeIds}
            onSelectionChange={setSelectedNodeIds}
            onBatchAction={(action: string, data?: any) => {
              if (action === "expand_graph")
                aiOps.handleBackgroundTask("expand_graph");
              else if (action === "delete") nodeOps.handleBatchDelete();
              else if (action === "batch_generate_questions")
                aiOps.handleBackgroundTask("batch_generate_questions", data);
              else if (action === "create_region") setIsCreateRegionOpen(true);
            }}
            onConnectNodes={onConnectNodes}
            className="h-full"
            stats={graphStats}
            isReadOnly={isReadOnly}
          />
        </div>
      ) : sidebarMode === "detail" && selectedNode ? (
        <NodeDetailSidebar
          node={nodes.find((n) => n.id === selectedNode.id) || selectedNode}
          nodes={nodes}
          edges={edges}
          prevSidebarMode={prevSidebarMode}
          nodeStatus={nodeStatus}
          onClose={handleCloseSidebar}
          onBack={() => {
            setSidebarMode("outline");
            setPrevSidebarMode("none");
          }}
          onEdit={() => {
            if (selectedNode) {
              const parentEdges = edges.filter(
                (e) =>
                  e.target_knowledge_point_id ===
                  selectedNode.knowledge_point_id,
              );
              setNodeForm({
                title: selectedNode.title || "",
                content: selectedNode.content || "",
                parentNodeIds: parentEdges.map(
                  (e) => e.source_knowledge_point_id,
                ),
                level: selectedNode.level || "normal",
                tags: selectedNode.properties?.tags || [],
              });
            }
            setPrevSidebarMode(sidebarMode);
            setSidebarMode("edit");
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
            const focusedNodes = getFocusedNodes(node.id, nodes, edges);
            const focusedLinks = getFocusedLinks(focusedNodes, edges);
            const directChildren = getDirectChildren(node.id, nodes, edges);

            setSelectedNode(node);
            setSelectedNodeIds(new Set([node.id]));
            setFocusedNodeId(node.id);
            setFocusedNodeIds(focusedNodes);
            setFocusedLinkIds(focusedLinks);
            setForceShowTextIds(new Set([node.id, ...directChildren]));
          }}
          onUpdateNode={(nodeId, updates) => {
            nodeOps.handleUpdateNode(nodeId, updates);
          }}
          isExplorationMode={isExplorationMode}
          onGenerateNodeContent={aiOps.handleGenerateNodeContent}
          onDeepAnalysis={() => aiOps.handleBackgroundTask("deep_analysis")}
          onGenerateQuiz={() =>
            aiOps.handleBackgroundTask("generate_questions")
          }
          onBackgroundGenerate={() =>
            aiOps.handleBackgroundTask("expand_graph")
          }
          isReadOnly={isReadOnly}
          onShowVersionHistory={() => setIsVersionHistoryOpen(true)}
          isGeneratingContent={loading}
        />
      ) : sidebarMode === "create" || sidebarMode === "edit" ? (
        <NodeEditSidebar
          mode={sidebarMode as "create" | "edit"}
          nodeForm={nodeForm}
          setNodeForm={setNodeForm}
          onSave={nodeOps.handleSaveNode}
          onClose={handleCloseSidebar}
          onBack={() => {
            setSidebarMode("outline");
            setPrevSidebarMode("none");
          }}
          prevSidebarMode={prevSidebarMode}
          loading={loading}
          nodes={nodes}
          currentNodeId={selectedNode?.id}
          isSelectingParent={isSelectingParent}
          onStartSelectingParent={onStartSelectingParent}
          onCancelSelectingParent={onCancelSelectingParent}
        />
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <>
        <AnimatePresence>
          <motion.div
            ref={sidebarRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-center py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <GripHorizontal
                className="text-gray-400 dark:text-gray-500"
                size={24}
              />
              <button
                onClick={handleCloseSidebar}
                className="absolute right-4 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div
              className={`flex-1 overflow-y-auto ${sidebarMode !== "outline" ? "p-4" : ""}`}
            >
              {renderSidebarContent()}
            </div>
          </motion.div>
        </AnimatePresence>
        {versionHistoryModal}
        <CreateRegionDialog
          isOpen={isCreateRegionOpen}
          onClose={() => setIsCreateRegionOpen(false)}
          onCreate={(region) => {
            onCreateRegion?.(region);
            setIsCreateRegionOpen(false);
            setSelectedNodeIds(new Set());
          }}
          selectedNodeIds={selectedNodeIds}
          nodes={nodes}
        />
      </>
    );
  }

  return (
    <>
      <ErrorBoundary
        fallback={
          <div className="w-80 bg-white dark:bg-gray-900 shadow-lg border-l border-gray-200 dark:border-gray-700 absolute right-0 top-0 bottom-0 z-20 flex flex-col p-4 items-center justify-center">
            <div className="text-red-500 font-bold mb-2">侧边栏组件出错</div>
            <button
              onClick={handleCloseSidebar}
              className="text-primary-600 hover:underline"
            >
              关闭侧边栏
            </button>
          </div>
        }
      >
        <div
          ref={sidebarRef}
          className={`bg-white dark:bg-gray-900 shadow-lg border-l border-gray-200 dark:border-gray-700 absolute right-0 top-0 bottom-0 z-20 flex flex-col ${sidebarMode !== "outline" ? "p-4 overflow-y-auto" : ""}`}
          style={{ width: sidebarWidth }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 z-50 flex items-center justify-center group transition-colors"
            onMouseDown={startResizing}
          >
            <div className="h-8 w-1 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-primary-500 transition-colors" />
          </div>
          {renderSidebarContent()}
        </div>
      </ErrorBoundary>
      {versionHistoryModal}
      <CreateRegionDialog
        isOpen={isCreateRegionOpen}
        onClose={() => setIsCreateRegionOpen(false)}
        onCreate={(region) => {
          onCreateRegion?.(region);
          setIsCreateRegionOpen(false);
          setSelectedNodeIds(new Set());
        }}
        selectedNodeIds={selectedNodeIds}
        nodes={nodes}
      />
    </>
  );
};

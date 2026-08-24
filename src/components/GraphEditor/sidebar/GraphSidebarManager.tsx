import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Node, Edge, GraphColorMode, NodeStatus } from "../../../types";
import { GraphEditorState, useIsMobile } from "../../../hooks";
import {
  getFocusedNodes,
  getFocusedLinks,
  getDirectChildren,
} from "../../../utils/graph/graphUtils";
import { NodeDetailSidebar } from "./NodeDetailSidebar";
import { NodeEditSidebar } from "./NodeEditSidebar";
import { GraphOutline } from "../panels/GraphOutline";
import { ErrorBoundary } from "../../common";
import { X, GripHorizontal } from "lucide-react";
import { VersionHistoryModal } from "../modals/VersionHistoryModal";
import { CreateRegionDialog } from "../modals/CreateRegionDialog";
import type { CustomRegion } from "@shared/types/graph";

interface GraphStats {
  masteredCount: number;
  dueTodayCount: number;
}

interface NodeOperations {
  handleSaveNode: (options?: { exitToDetail?: boolean }) => void;
  handleDeleteNode: () => void;
  handleBatchDelete: () => void;
  handleUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
  handleRefreshNode?: () => void;
}

interface AIOperations {
  handleBackgroundTask: (type: "generate_questions" | "expand_graph" | "batch_generate_questions" | "deep_analysis", data?: Record<string, unknown>) => void | Promise<void>;
  handleStartLevelTest: () => void;
  handleStartLearningMode: () => void;
  handleAIGenerateCards: () => void;
  handleFetchRelatedNodes: () => void;
  handleGenerateNodeContent: () => void;
}

interface InteractionOperations {
  handleNodeClick: (node: Node) => void;
}

interface GraphSidebarManagerProps {
  state: GraphEditorState;
  nodes: Node[];
  edges: Edge[];
  nodeStatus: Record<string, NodeStatus>;
  graphStats: GraphStats;
  nodeOps: NodeOperations;
  aiOps: AIOperations;
  interactionOps: InteractionOperations;
  handleCloseSidebar: () => void;
  isExplorationMode?: boolean;
  isSelectingParent?: boolean;
  onStartSelectingParent?: () => void;
  onCancelSelectingParent?: () => void;
  onSelectParentFromGraph?: (nodeId: string) => void;
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  isReadOnly?: boolean;
  customRegions?: CustomRegion[];
  coloringMode?: GraphColorMode;
  onCreateRegion?: (
    region: Omit<CustomRegion, "id" | "createdAt" | "updatedAt">,
  ) => void;
  graphId?: string;
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
  coloringMode = "status",
  onCreateRegion,
  graphId,
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isResizing, setIsResizing] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isCreateRegionOpen, setIsCreateRegionOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // 预构建 nodeById 索引，将渲染路径的节点查找由 O(nodes) 降为 O(1)
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

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
      knowledgePointTitle={selectedNode.title || t('graphEditor.sidebar.unnamedKnowledgePoint')}
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
            onBatchAction={(action: string, data?: Record<string, unknown>) => {
              if (action === "expand_graph")
                {aiOps.handleBackgroundTask("expand_graph");}
              else if (action === "delete") nodeOps.handleBatchDelete();
              else if (action === "batch_generate_questions")
                {aiOps.handleBackgroundTask("batch_generate_questions", data);}
              else if (action === "create_region") setIsCreateRegionOpen(true);
            }}
            onConnectNodes={onConnectNodes}
            className="h-full"
            stats={graphStats}
            isReadOnly={isReadOnly}
            graphId={graphId}
            onCreateQuizSet={(kpIds) => {
              if (kpIds.length === 0) return;
              const kpParam = encodeURIComponent(kpIds.join(","));
              navigate(
                `/study?graph_id=${graphId ?? ""}&from=graph&view=quizzes&create=1&kp_ids=${kpParam}`,
              );
            }}
          />
        </div>
      ) : sidebarMode === "detail" && selectedNode ? (
        <NodeDetailSidebar
          node={nodeById.get(selectedNode.id) ?? selectedNode}
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
                summary: selectedNode.summary || "",
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
          onRelatedNodeClick={(relatedNode) => {
            const focusedNodes = getFocusedNodes(relatedNode.id, nodes, edges);
            const focusedLinks = getFocusedLinks(focusedNodes, edges);
            const directChildren = getDirectChildren(relatedNode.id, nodes, edges);

            const node = nodes.find(n => n.id === relatedNode.id);
            if (node) {
              setSelectedNode(node);
            }
            setSelectedNodeIds(new Set([relatedNode.id]));
            setFocusedNodeId(relatedNode.id);
            setFocusedNodeIds(focusedNodes);
            setFocusedLinkIds(focusedLinks);
            setForceShowTextIds(new Set([relatedNode.id, ...directChildren]));
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
          coloringMode={coloringMode}
          onNavigateToNode={(knowledgePointId) => {
            const targetNode = nodes.find(
              (n) => n.knowledge_point_id === knowledgePointId,
            );
            if (targetNode) {
              setSelectedNode(targetNode);
              setSelectedNodeIds(new Set([targetNode.id]));
              setFocusedNodeId(targetNode.id);
              setSidebarMode("detail");
            }
          }}
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
          graphId={selectedNode?.graph_id}
          onNavigateToNode={(knowledgePointId) => {
            const targetNode = nodes.find(
              (n) => n.knowledge_point_id === knowledgePointId,
            );
            if (targetNode) {
              setSelectedNode(targetNode);
              setSelectedNodeIds(new Set([targetNode.id]));
              setFocusedNodeId(targetNode.id);
              setSidebarMode("detail");
            }
          }}
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
      <ErrorBoundary variant="panel">
        <div
          ref={sidebarRef}
          data-tour="sidebar-panel"
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

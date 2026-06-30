import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GraphOutline } from "../GraphEditor/panels/GraphOutline";
import { LearningPathOutline } from "./LearningPathOutline";

type OutlineMode = "graph" | "learning-path";

interface LearningModeOutlineProps {
  isMobile: boolean;
  nodeId: string | null;
  graphId: string | null;
  isOutlineOpen: boolean;
  outlineMode: OutlineMode;
  selectedLearningPathId: string | null;
  selectedNodeIds: Set<string>;
  graphData: {
    nodes: Parameters<typeof GraphOutline>[0]["nodes"];
    edges: Parameters<typeof GraphOutline>[0]["edges"];
    nodeStatus?: Record<string, unknown>;
  } | null | undefined;
  graphMeta: { template_type?: string } | null | undefined;
  onNodeClick: (nodeId: string) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onBatchAction: (action: string, data?: Record<string, unknown>) => void;
  onAddNode: () => void;
  onBackToGraphOutline: () => void;
}

export const LearningModeOutline = ({
  isMobile,
  nodeId,
  graphId,
  isOutlineOpen,
  outlineMode,
  selectedLearningPathId,
  selectedNodeIds,
  graphData,
  graphMeta,
  onNodeClick,
  onSelectionChange,
  onBatchAction,
  onAddNode,
  onBackToGraphOutline,
}: LearningModeOutlineProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={`${
        isMobile
          ? !nodeId
            ? "w-full"
            : "w-0"
          : isOutlineOpen
            ? "w-80"
            : "w-0"
      } transition-all duration-300 ease-in-out border-r dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 relative`}
    >
      <div className={`absolute inset-0 ${isMobile ? "w-full" : "w-80"}`}>
        {outlineMode === "learning-path" && selectedLearningPathId ? (
          <LearningPathOutline
            learningPathId={selectedLearningPathId}
            currentNodeId={nodeId || undefined}
            onNodeClick={onNodeClick}
            onBackToGraph={onBackToGraphOutline}
            className="h-full border-none"
          />
        ) : graphData ? (
          <GraphOutline
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={(node) => onNodeClick(node.id)}
            selectedNodeId={nodeId}
            selectedNodeIds={selectedNodeIds}
            onSelectionChange={onSelectionChange}
            onBatchAction={onBatchAction}
            onAddNode={onAddNode}
            templateType={graphMeta?.template_type}
            graphId={graphId ?? undefined}
            className="h-full border-none"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 className="animate-spin mr-2" />
            {t("learning.header.loading")}
          </div>
        )}
      </div>
    </div>
  );
};

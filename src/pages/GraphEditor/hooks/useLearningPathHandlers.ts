import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { message } from "../../../utils/messageHelper";
import { learningPathsApi } from "../../../services/api/learningPaths";
import type { Node as GraphNode, GraphViewMode } from "../../../types";
import type { GraphRef } from "../../../hooks/graphEditor";
import type { NarrativeStrategy } from "../../../hooks/graphEditor/useNarrativeState";

interface LearningPathNode {
  knowledge_point_id?: string;
  id?: string;
  order_index?: number;
}

interface UseLearningPathHandlersParams {
  /** nodes from useGraphData */
  nodes: GraphNode[];
  /** current view mode from useGraphEditorState */
  viewMode: GraphViewMode;
  setViewMode: (mode: GraphViewMode) => void;
  /** graph ref from useGraphEditorState */
  graphRef: React.RefObject<GraphRef | null>;
  /** presentation mode flag and setter from state */
  isPresentationMode: boolean;
  setIsPresentationMode: (v: boolean) => void;
  setFocusedNodeId: (v: string | null) => void;
  setFocusedNodeIds: (v: Set<string>) => void;
  setFocusedLinkIds: (v: Set<string>) => void;
  /** saved camera transform from state.savedTransform */
  savedTransform: { x: number; y: number; k: number } | null;
  /** narrative controls from useNarrativeState */
  startNarrative: (
    path: string[],
    strategy: NarrativeStrategy,
    transform: { x: number; y: number; k: number },
  ) => void;
  exitNarrative: () => void;
  /** focus node helpers from useFocusNode */
  focusNodeWithNode: (node: GraphNode) => void;
}

/**
 * Manages selected learning path state and narrative mode entry/exit handlers.
 *
 * Extracted from GraphEditor.tsx (P1-13).
 */
export const useLearningPathHandlers = (params: UseLearningPathHandlersParams) => {
  const { t } = useTranslation();
  const {
    nodes,
    viewMode,
    setViewMode,
    graphRef,
    isPresentationMode,
    setIsPresentationMode,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    savedTransform,
    startNarrative,
    exitNarrative,
    focusNodeWithNode,
  } = params;

  const [selectedLearningPathId, setSelectedLearningPathId] = useState<
    string | null
  >(null);
  const [learningPathNodeIds, setLearningPathNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [learningPathOrderMap, setLearningPathOrderMap] = useState<
    Map<string, number>
  >(new Map());

  const handleSelectLearningPath = useCallback(
    async (pathId: string | null) => {
      if (!pathId) {
        setSelectedLearningPathId(null);
        setLearningPathNodeIds(new Set());
        setLearningPathOrderMap(new Map());
        return;
      }

      try {
        const result = await learningPathsApi.get(pathId);
        if (result && result.nodes) {
          const nodeIds = new Set<string>();
          const orderMap = new Map<string, number>();

          result.nodes.forEach((node: LearningPathNode) => {
            const knowledgePointId = node.knowledge_point_id || node.id;
            if (knowledgePointId) {
              nodeIds.add(knowledgePointId);
              orderMap.set(knowledgePointId, node.order_index ?? 0);
            }
          });

          setSelectedLearningPathId(pathId);
          setLearningPathNodeIds(nodeIds);
          setLearningPathOrderMap(orderMap);
        }
      } catch (error) {
        console.error("Failed to fetch learning path:", error);
        message.error(t("graphEditor.loadPathFailed"));
      }
    },
    [t],
  );

  const handleStartNarrative = useCallback(() => {
    if (!selectedLearningPathId || learningPathNodeIds.size === 0) {
      message.warning(t("graphEditor.selectPathFirst"));
      return;
    }

    // Build ordered path from learning path
    const orderedEntries = Array.from(learningPathOrderMap.entries()).sort(
      ([, a], [, b]) => a - b,
    );
    const path = orderedEntries.map(([nodeId]) => nodeId);

    if (path.length === 0) {
      message.warning(t("graphEditor.pathEmpty"));
      return;
    }

    // Get current camera transform from canvas
    const currentTransform =
      graphRef.current?.getTransform?.() ?? { x: 0, y: 0, k: 1 };

    // Switch to mindmap view if not already
    if (viewMode !== "mindmap") {
      setViewMode("mindmap");
    }

    // Exit presentation mode if active
    if (isPresentationMode) {
      setIsPresentationMode(false);
      setFocusedNodeId(null);
      setFocusedNodeIds(new Set());
      setFocusedLinkIds(new Set());
    }

    startNarrative(path, "learningPath", currentTransform);
  }, [
    selectedLearningPathId,
    learningPathNodeIds,
    learningPathOrderMap,
    viewMode,
    setViewMode,
    isPresentationMode,
    setIsPresentationMode,
    setFocusedNodeId,
    setFocusedNodeIds,
    setFocusedLinkIds,
    startNarrative,
    graphRef,
    t,
  ]);

  const handleExitNarrative = useCallback(() => {
    const saved = savedTransform;
    exitNarrative();
    // Restore camera position after exiting narrative mode
    if (saved) {
      graphRef.current?.animateToTransform?.(saved, 600);
    }
  }, [exitNarrative, savedTransform, graphRef]);

  const handleLearningPathNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      focusNodeWithNode(node);

      if (viewMode !== "mindmap") {
        setViewMode("mindmap");
      }
    },
    [nodes, focusNodeWithNode, viewMode, setViewMode],
  );

  return {
    selectedLearningPathId,
    learningPathNodeIds,
    learningPathOrderMap,
    handleSelectLearningPath,
    handleStartNarrative,
    handleExitNarrative,
    handleLearningPathNodeClick,
  };
};

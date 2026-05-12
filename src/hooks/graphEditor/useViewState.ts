import { useState, useEffect, useCallback } from 'react';
import { GraphViewMode } from '../../types';
import { useGraph } from '../queries/useGraphQueries';
import { useUpdateGraphMutation } from '../mutations/useGraphMutations';

export interface ViewState {
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  collapsedNodeIds: Set<string>;
  setCollapsedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewMode: GraphViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<GraphViewMode>>;
  isPathfindingMode: boolean;
  setIsPathfindingMode: React.Dispatch<React.SetStateAction<boolean>>;
  isDeleteMode: boolean;
  setIsDeleteMode: React.Dispatch<React.SetStateAction<boolean>>;
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  saveViewMode: (mode: GraphViewMode) => Promise<void>;
  isInitialized: boolean;
}

export const useViewState = (graphId?: string): ViewState => {
  const [showGrid, setShowGrid] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<GraphViewMode>('mindmap');
  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: graph } = useGraph(graphId || '');
  const updateGraphMutation = useUpdateGraphMutation();

  useEffect(() => {
    if (graph?.settings && !isInitialized && graphId) {
      const settings = graph.settings as Record<string, unknown>;
      if (settings.viewMode) {
        setViewMode(settings.viewMode as GraphViewMode);
      }
      setIsInitialized(true);
    }
  }, [graph?.settings, isInitialized, graphId]);

  const saveViewMode = useCallback(async (mode: GraphViewMode) => {
    if (!graphId) return;

    try {
      await updateGraphMutation.mutateAsync({
        id: graphId,
        data: {
          settings: {
            ...(graph?.settings || {}),
            viewMode: mode,
          },
        },
      });
    } catch (error) {
      console.error('Failed to save view mode:', error);
    }
  }, [graphId, graph, updateGraphMutation]);

  const handleSetViewMode: React.Dispatch<React.SetStateAction<GraphViewMode>> = useCallback(
    (action) => {
      setViewMode((prevMode) => {
        const newMode = typeof action === 'function' ? action(prevMode) : action;
        if (newMode !== prevMode && graphId) {
          saveViewMode(newMode);
        }
        return newMode;
      });
    },
    [graphId, saveViewMode]
  );

  return {
    showGrid,
    setShowGrid,
    collapsedNodeIds,
    setCollapsedNodeIds,
    viewMode,
    setViewMode: handleSetViewMode,
    isPathfindingMode,
    setIsPathfindingMode,
    isDeleteMode,
    setIsDeleteMode,
    isFocusMode,
    setIsFocusMode,
    saveViewMode,
    isInitialized,
  };
};

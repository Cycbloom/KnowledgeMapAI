import { useState } from 'react';
import { GraphViewMode } from '../../types';

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
}

export const useViewState = (): ViewState => {
  const [showGrid, setShowGrid] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<GraphViewMode>('mindmap');
  const [isPathfindingMode, setIsPathfindingMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  return {
    showGrid,
    setShowGrid,
    collapsedNodeIds,
    setCollapsedNodeIds,
    viewMode,
    setViewMode,
    isPathfindingMode,
    setIsPathfindingMode,
    isDeleteMode,
    setIsDeleteMode,
    isFocusMode,
    setIsFocusMode,
  };
};

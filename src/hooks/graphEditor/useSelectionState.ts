import { useState } from 'react';
import { Node } from '../../types';

export interface SelectionState {
  selectedNode: Node | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectionBox: { left: number; top: number; width: number; height: number } | null;
  setSelectionBox: React.Dispatch<React.SetStateAction<{ left: number; top: number; width: number; height: number } | null>>;
}

export const useSelectionState = (): SelectionState => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  return {
    selectedNode,
    setSelectedNode,
    selectedNodeIds,
    setSelectedNodeIds,
    selectionBox,
    setSelectionBox,
  };
};

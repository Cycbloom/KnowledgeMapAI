import { useRef, useMemo } from 'react';
import { useSelectionState, SelectionState } from './useSelectionState';
import { useSidebarState, SidebarState } from './useSidebarState';
import { useExplorationState, ExplorationState } from './useExplorationState';
import { useFocusState, FocusState } from './useFocusState';
import { useModalState, ModalState } from './useModalState';
import { useFormState, FormState } from './useFormState';
import { useViewState, ViewState } from './useViewState';
import { usePresentationState, PresentationState } from './usePresentationState';
import { useNarrativeState, NarrativeState } from './useNarrativeState';
import { useMiscState, MiscState } from './useMiscState';

export { useSelectionState } from './useSelectionState';
export { useSidebarState } from './useSidebarState';
export { useExplorationState } from './useExplorationState';
export { useFocusState } from './useFocusState';
export { useModalState } from './useModalState';
export { useFormState } from './useFormState';
export { useViewState } from './useViewState';
export { usePresentationState } from './usePresentationState';
export { useNarrativeState } from './useNarrativeState';
export { useMiscState } from './useMiscState';

export { useGraphComputed } from './useGraphComputed';
export { useGraphEffects } from './useGraphEffects';
export { useGraphExportOperations } from './useGraphExportOperations';
export { useGraphHistoryHandlers } from './useGraphHistoryHandlers';
export { useGraphInteraction } from './useGraphInteraction';
export { useGraphNodeOperations } from './useGraphNodeOperations';
export { useKnowledgePointOperations } from './useKnowledgePointOperations';
export { useExplorationPath } from './useExplorationPath';
export { useNodeStatusSets } from './useNodeStatusSets';
export { useGraphEditorPanelState } from './useGraphEditorPanelState';
export { useFocusNode } from './useFocusNode';
export { useBranchSelection } from './useBranchSelection';

export interface GraphRef {
  centerNode?: (nodeId: string, options?: { forceRightPanelOpen?: boolean }) => void;
  captureScreenshot?: (options: { transparent: boolean; fitView: boolean; hideGrid: boolean }) => Promise<string>;
  getTransform?: () => { x: number; y: number; k: number };
  animateToTransform?: (transform: { x: number; y: number; k: number }, duration?: number) => void;
  fitView?: () => void;
  fitSelection?: (nodeIds?: string[]) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  resetZoom?: () => void;
  getZoom?: () => number;
}

export type GraphEditorState = {
  graphRef: React.RefObject<GraphRef | null>;
} & SelectionState & SidebarState & ExplorationState & FocusState & ModalState & FormState & ViewState & PresentationState & NarrativeState & MiscState;

export const useGraphEditorState = (): GraphEditorState => {
  const graphRef = useRef<GraphRef | null>(null);
  
  const selection = useSelectionState();
  const sidebar = useSidebarState();
  const exploration = useExplorationState();
  const focus = useFocusState();
  const modal = useModalState();
  const form = useFormState();
  const view = useViewState();
  const presentation = usePresentationState();
  const narrative = useNarrativeState();
  const misc = useMiscState();

  return useMemo(() => ({
    graphRef,
    ...selection,
    ...sidebar,
    ...exploration,
    ...focus,
    ...modal,
    ...form,
    ...view,
    ...presentation,
    ...narrative,
    ...misc,
  }), [
    graphRef,
    selection,
    sidebar,
    exploration,
    focus,
    modal,
    form,
    view,
    presentation,
    narrative,
    misc,
  ]);
};

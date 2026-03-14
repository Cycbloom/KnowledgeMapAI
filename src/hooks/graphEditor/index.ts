import { useRef } from 'react';
import { useSelectionState, SelectionState } from './useSelectionState';
import { useSidebarState, SidebarState } from './useSidebarState';
import { useExplorationState, ExplorationState } from './useExplorationState';
import { useFocusState, FocusState } from './useFocusState';
import { useModalState, ModalState } from './useModalState';
import { useFormState, FormState } from './useFormState';
import { useViewState, ViewState } from './useViewState';
import { usePresentationState, PresentationState } from './usePresentationState';
import { useMiscState, MiscState } from './useMiscState';

export { useSelectionState } from './useSelectionState';
export { useSidebarState } from './useSidebarState';
export { useExplorationState } from './useExplorationState';
export { useFocusState } from './useFocusState';
export { useModalState } from './useModalState';
export { useFormState } from './useFormState';
export { useViewState } from './useViewState';
export { usePresentationState } from './usePresentationState';
export { useMiscState } from './useMiscState';

export { useGraphComputed } from './useGraphComputed';
export { useGraphEffects } from './useGraphEffects';
export { useGraphExportOperations } from './useGraphExportOperations';
export { useGraphHistoryHandlers } from './useGraphHistoryHandlers';
export { useGraphInteraction } from './useGraphInteraction';
export { useGraphNodeOperations } from './useGraphNodeOperations';
export { useKnowledgePointOperations } from './useKnowledgePointOperations';
export { useExplorationPath } from './useExplorationPath';

export type GraphEditorState = {
  graphRef: React.RefObject<any>;
} & SelectionState & SidebarState & ExplorationState & FocusState & ModalState & FormState & ViewState & PresentationState & MiscState;

export const useGraphEditorState = (): GraphEditorState => {
  const graphRef = useRef<any>(null);
  
  const selection = useSelectionState();
  const sidebar = useSidebarState();
  const exploration = useExplorationState();
  const focus = useFocusState();
  const modal = useModalState();
  const form = useFormState();
  const view = useViewState();
  const presentation = usePresentationState();
  const misc = useMiscState();

  return {
    graphRef,
    ...selection,
    ...sidebar,
    ...exploration,
    ...focus,
    ...modal,
    ...form,
    ...view,
    ...presentation,
    ...misc,
  };
};

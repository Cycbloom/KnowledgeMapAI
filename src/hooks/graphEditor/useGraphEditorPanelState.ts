import { useState } from 'react';
import { useConsole } from '../console/useConsole';
import type { CommandContext } from '@/services/console';
import type { ExtractedConcept } from '../../types';

export interface UseGraphEditorPanelStateProps {
  userId: string;
}

export interface UseGraphEditorPanelStateReturn {
  // Style settings
  isStyleSettingsOpen: boolean;
  setIsStyleSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Relationship type settings
  isRelationshipTypeSettingsOpen: boolean;
  setIsRelationshipTypeSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Command palette
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Shortcut help
  isShortcutHelpOpen: boolean;
  setIsShortcutHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // RAG Chat
  isRAGChatOpen: boolean;
  setIsRAGChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ragChatWidth: number;
  setRagChatWidth: React.Dispatch<React.SetStateAction<number>>;
  // Literature
  isLiteratureExtractOpen: boolean;
  setIsLiteratureExtractOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isResearchProgressOpen: boolean;
  setIsResearchProgressOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLiteratureLibraryOpen: boolean;
  setIsLiteratureLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Concepts
  extractedConcepts: ExtractedConcept[];
  setExtractedConcepts: React.Dispatch<React.SetStateAction<ExtractedConcept[]>>;
  isConceptPreviewOpen: boolean;
  setIsConceptPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isConceptAggregationOpen: boolean;
  setIsConceptAggregationOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Version history
  isVersionHistoryOpen: boolean;
  setIsVersionHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDiff: { sourceSnapshotId: string; targetSnapshotId?: string } | null;
  setSelectedDiff: React.Dispatch<React.SetStateAction<{ sourceSnapshotId: string; targetSnapshotId?: string } | null>>;
  // Action result
  actionResult: { title: string; content: string } | null;
  setActionResult: React.Dispatch<React.SetStateAction<{ title: string; content: string } | null>>;
  // Console
  isConsoleOpen: boolean;
  isConsoleMinimized: boolean;
  consoleContext: CommandContext;
  openConsole: () => void;
  closeConsole: () => void;
  toggleConsoleMinimize: () => void;
}

export function useGraphEditorPanelState(
  props: UseGraphEditorPanelStateProps,
): UseGraphEditorPanelStateReturn {
  const { userId } = props;

  // Style settings
  const [isStyleSettingsOpen, setIsStyleSettingsOpen] = useState(false);

  // Relationship type settings
  const [isRelationshipTypeSettingsOpen, setIsRelationshipTypeSettingsOpen] = useState(false);

  // Command palette
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Shortcut help
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);

  // RAG Chat
  const [isRAGChatOpen, setIsRAGChatOpen] = useState(false);
  const [ragChatWidth, setRagChatWidth] = useState(420);

  // Literature
  const [isLiteratureExtractOpen, setIsLiteratureExtractOpen] = useState(false);
  const [isResearchProgressOpen, setIsResearchProgressOpen] = useState(false);
  const [isLiteratureLibraryOpen, setIsLiteratureLibraryOpen] = useState(false);

  // Concepts
  const [extractedConcepts, setExtractedConcepts] = useState<ExtractedConcept[]>([]);
  const [isConceptPreviewOpen, setIsConceptPreviewOpen] = useState(false);
  const [isConceptAggregationOpen, setIsConceptAggregationOpen] = useState(false);

  // Version history
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<{
    sourceSnapshotId: string;
    targetSnapshotId?: string;
  } | null>(null);

  // Action result
  const [actionResult, setActionResult] = useState<{
    title: string;
    content: string;
  } | null>(null);

  // Console
  const {
    isOpen: isConsoleOpen,
    isMinimized: isConsoleMinimized,
    context: consoleContext,
    open: openConsole,
    close: closeConsole,
    toggleMinimize: toggleConsoleMinimize,
  } = useConsole({ userId, autoRegisterCommands: true });

  return {
    // Style settings
    isStyleSettingsOpen,
    setIsStyleSettingsOpen,
    // Relationship type settings
    isRelationshipTypeSettingsOpen,
    setIsRelationshipTypeSettingsOpen,
    // Command palette
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    // Shortcut help
    isShortcutHelpOpen,
    setIsShortcutHelpOpen,
    // RAG Chat
    isRAGChatOpen,
    setIsRAGChatOpen,
    ragChatWidth,
    setRagChatWidth,
    // Literature
    isLiteratureExtractOpen,
    setIsLiteratureExtractOpen,
    isResearchProgressOpen,
    setIsResearchProgressOpen,
    isLiteratureLibraryOpen,
    setIsLiteratureLibraryOpen,
    // Concepts
    extractedConcepts,
    setExtractedConcepts,
    isConceptPreviewOpen,
    setIsConceptPreviewOpen,
    isConceptAggregationOpen,
    setIsConceptAggregationOpen,
    // Version history
    isVersionHistoryOpen,
    setIsVersionHistoryOpen,
    selectedDiff,
    setSelectedDiff,
    // Action result
    actionResult,
    setActionResult,
    // Console
    isConsoleOpen,
    isConsoleMinimized,
    consoleContext,
    openConsole,
    closeConsole,
    toggleConsoleMinimize,
  };
}

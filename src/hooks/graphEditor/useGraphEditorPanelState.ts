import { useState } from 'react';
import type { ExtractedConcept } from '../../types';

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
}

export function useGraphEditorPanelState(): UseGraphEditorPanelStateReturn {
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
  };
}

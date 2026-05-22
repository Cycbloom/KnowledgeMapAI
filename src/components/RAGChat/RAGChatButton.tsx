import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, GraduationCap } from 'lucide-react';
import { useTheme } from "../../hooks";
import { TutorMode, TutorExtractedConcept } from '../../types';

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedTopic {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedDifficulty: number;
}

interface SimpleRAGChatButtonProps {
  isDark: boolean;
  isTutorMode: boolean;
  onClick: () => void;
  isMobilePreviewMode?: boolean;
  hasSelectedNode?: boolean;
}

const SimpleRAGChatButton: React.FC<SimpleRAGChatButtonProps> = ({
  isDark,
  isTutorMode,
  onClick,
  isMobilePreviewMode,
  hasSelectedNode
}) => {
  const shouldMoveUp = isMobilePreviewMode && hasSelectedNode;
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`fixed left-4 z-40 p-2.5 rounded-xl shadow-lg transition-all duration-300 ${
        shouldMoveUp ? 'bottom-72' : 'bottom-16'
      } ${
        isTutorMode
          ? isDark 
            ? 'bg-amber-600 hover:bg-amber-500 text-white' 
            : 'bg-amber-500 hover:bg-amber-600 text-white'
          : isDark 
            ? 'bg-primary-600 hover:bg-primary-500 text-white' 
            : 'bg-primary-500 hover:bg-primary-600 text-white'
      }`}
      title={isTutorMode ? 'AI 助教' : '智能问答'}
    >
      {isTutorMode ? <GraduationCap size={18} /> : <MessageCircle size={18} />}
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
    </motion.button>
  );
};

interface RAGChatButtonProps {
  graphId?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  onNodeClick?: (nodeId: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  selectedNodeIds?: string[];
  aiEnabled?: boolean;
  isTutorMode?: boolean;
  tutorMode?: TutorMode;
  extractedConcepts?: TutorExtractedConcept[];
  onToggleTutorMode?: () => void;
  onSwitchTutorMode?: (mode: TutorMode) => void;
  onExtractConcepts?: (text: string) => void;
  onAddConceptToGraph?: (concept: TutorExtractedConcept) => void;
  onAddAllConcepts?: () => void;
  onSuggestNextTopics?: () => void;
  suggestedNextTopics?: SuggestedTopic[];
  onTutorChat?: (message: string, history: ChatHistoryItem[], onChunk: (content: string) => void) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  isMobilePreviewMode?: boolean;
}

export const RAGChatButton: React.FC<RAGChatButtonProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  isOpen: externalIsOpen,
  onOpenChange,
  selectedNodeIds,
  aiEnabled,
  isTutorMode,
  tutorMode,
  extractedConcepts,
  onToggleTutorMode,
  onSwitchTutorMode,
  onExtractConcepts,
  onAddConceptToGraph,
  onAddAllConcepts,
  onSuggestNextTopics,
  suggestedNextTopics,
  onTutorChat,
  width = 420,
  onWidthChange,
  isMobilePreviewMode
}) => {
  const { isDark } = useTheme();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  return (
    <>
      <SimpleRAGChatButton
        isDark={isDark}
        isTutorMode={isTutorMode || false}
        onClick={() => setIsOpen(true)}
        isMobilePreviewMode={isMobilePreviewMode}
        hasSelectedNode={!!currentNodeId}
      />

      <AnimatePresence>
        {isOpen && (
          <div className="fixed top-0 left-0 bottom-0 z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full pointer-events-auto"
            >
              <RAGChatPanelWrapper
                graphId={graphId}
                currentNodeId={currentNodeId}
                currentNodeTitle={currentNodeTitle}
                onNodeClick={onNodeClick}
                onClose={() => setIsOpen(false)}
                isOpen={isOpen}
                selectedNodeIds={selectedNodeIds}
                aiEnabled={aiEnabled}
                isTutorMode={isTutorMode}
                tutorMode={tutorMode}
                extractedConcepts={extractedConcepts}
                onToggleTutorMode={onToggleTutorMode}
                onSwitchTutorMode={onSwitchTutorMode}
                onExtractConcepts={onExtractConcepts}
                onAddConceptToGraph={onAddConceptToGraph}
                onAddAllConcepts={onAddAllConcepts}
                onSuggestNextTopics={onSuggestNextTopics}
                suggestedNextTopics={suggestedNextTopics}
                onTutorChat={onTutorChat}
                width={width}
                onWidthChange={onWidthChange}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const RAGChatPanelWrapper = React.lazy(() => import('./index').then(m => ({ default: m.RAGChatPanel })));

export default RAGChatButton;

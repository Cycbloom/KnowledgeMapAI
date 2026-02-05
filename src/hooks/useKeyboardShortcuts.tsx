import { useEffect } from 'react';
import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';

import { Node } from '../types';

interface UseKeyboardShortcutsProps {
  undo: () => void;
  redo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  deleteNode: (node: Node | null) => void;
  toggleDeleteMode: () => void;
  togglePathfindingMode: () => void;
  toggleGrid: () => void;
  toggleFocusMode: () => void;
  toggleSidebar: () => void;
  saveNode: () => void;
  sidebarMode: string;
  selectedNode: Node | null;
}

export const useKeyboardShortcuts = ({
  undo,
  redo,
  canUndo = true,
  canRedo = true,
  deleteNode,
  toggleDeleteMode,
  togglePathfindingMode,
  toggleGrid,
  toggleFocusMode,
  toggleSidebar,
  saveNode,
  sidebarMode,
  selectedNode
}: UseKeyboardShortcutsProps) => {
  const { addMessage } = useMessageStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Global shortcuts (even in inputs, some might be allowed, but usually not)
      if (isInput && !((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y'))) {
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
      
      // Save Node (Ctrl+S)
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (sidebarMode === 'edit' || sidebarMode === 'create') {
          saveNode();
        }
      }

      // Delete (Delete or Backspace)
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedNode) {
          e.preventDefault();
          deleteNode(selectedNode);
        }
      }

      // Toggle Sidebar (B)
      else if (e.key.toLowerCase() === 'b' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleSidebar();
      }

      // Toggle Grid (G)
      else if (e.key.toLowerCase() === 'g' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleGrid();
      }

      // Toggle Focus Mode (F)
      else if (e.key.toLowerCase() === 'f' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleFocusMode();
      }

      // Toggle Delete Mode (D)
      else if (e.key.toLowerCase() === 'd' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleDeleteMode();
      }

      // Toggle Pathfinding Mode (P)
      else if (e.key.toLowerCase() === 'p' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        togglePathfindingMode();
      }
      
      // Exit Focus Mode / Close Sidebar (Escape)
      else if (e.key === 'Escape') {
        // This is handled by components usually, but we can add global Esc logic if needed
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo, redo, canUndo, canRedo, 
    deleteNode, toggleDeleteMode, togglePathfindingMode, 
    toggleGrid, toggleFocusMode, toggleSidebar, 
    saveNode, sidebarMode, selectedNode
  ]);
};

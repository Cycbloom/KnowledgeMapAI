import { useEffect } from 'react';
import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';

interface UseKeyboardShortcutsProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isFocusMode: boolean;
  setIsFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useKeyboardShortcuts = ({
  undo,
  redo,
  canUndo,
  canRedo,
  isFocusMode,
  setIsFocusMode
}: UseKeyboardShortcutsProps) => {
  const { addMessage } = useMessageStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Ctrl+Shift+Z -> Redo
          if (canRedo) {
            e.preventDefault();
            redo();
            addMessage({ content: '重做', type: 'success' });
          }
        } else {
          // Ctrl+Z -> Undo
          if (canUndo) {
            e.preventDefault();
            undo();
            addMessage({ content: '撤销', type: 'success' });
          }
        }
      }
      // Check for Ctrl+Y or Cmd+Y -> Redo
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
          addMessage({ content: '重做', type: 'success' });
        }
      }
      // Toggle Focus Mode with 'F'
      else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only block if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (!isInput) {
          e.preventDefault();
          const next = !isFocusMode;
          setIsFocusMode(next);
          addMessage({ 
            content: next ? '已进入专注模式 (按 Esc 退出)' : '已退出专注模式', 
            type: 'info' 
          });
        }
      }
      // Exit Focus Mode with Escape
      else if (e.key === 'Escape') {
        if (isFocusMode) {
          e.preventDefault();
          setIsFocusMode(false);
          addMessage({ content: '已退出专注模式', type: 'info' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, isFocusMode, setIsFocusMode, addMessage]);
};

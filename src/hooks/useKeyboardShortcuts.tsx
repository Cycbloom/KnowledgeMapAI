import { useEffect } from 'react';
import toast from 'react-hot-toast';
import React from 'react';
import { Maximize, Minimize } from 'lucide-react';

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Ctrl+Shift+Z -> Redo
          if (canRedo) {
            e.preventDefault();
            redo();
            toast.success('重做');
          }
        } else {
          // Ctrl+Z -> Undo
          if (canUndo) {
            e.preventDefault();
            undo();
            toast.success('撤销');
          }
        }
      }
      // Check for Ctrl+Y or Cmd+Y -> Redo
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
          toast.success('重做');
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
          toast(next ? '已进入专注模式 (按 Esc 退出)' : '已退出专注模式', { icon: next ? <Maximize size={18}/> : <Minimize size={18}/> });
        }
      }
      // Exit Focus Mode with Escape
      else if (e.key === 'Escape') {
        if (isFocusMode) {
          e.preventDefault();
          setIsFocusMode(false);
          toast('已退出专注模式', { icon: <Minimize size={18}/> });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, isFocusMode, setIsFocusMode]);
};

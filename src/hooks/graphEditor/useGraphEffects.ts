import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraphEditorState } from './index';

interface UseGraphEffectsProps {
  state: GraphEditorState;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  aiEnabled: boolean;
  addMessage: (msg: any) => void;
}

export const useGraphEffects = ({
  state,
  undo,
  redo,
  canUndo,
  canRedo,
  aiEnabled,
  addMessage,
}: UseGraphEffectsProps) => {
  const navigate = useNavigate();
  const {
    setSelectedNode,
    setSelectedNodeIds,
  } = state;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const hasShownAIWarningRef = useRef(false);
  useEffect(() => {
    if (aiEnabled) return;
    if (hasShownAIWarningRef.current) return;
    hasShownAIWarningRef.current = true;
    addMessage({
      type: 'warning',
      content: 'AI 未配置：文本分析/对话将使用模拟结果，文档解析与智能推荐不可用',
      duration: 12000,
      action: { label: '配置说明', onClick: () => navigate('/profile') }
    });
  }, [aiEnabled, addMessage, navigate]);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  }, [setSelectedNode, setSelectedNodeIds]);

  return {
    clearSelection,
  };
};

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Node, Edge } from '../types';
import { GraphEditorState } from './useGraphEditorState';

interface UseGraphEffectsProps {
  state: GraphEditorState;
  nodes: Node[];
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  aiEnabled: boolean;
  addMessage: (msg: any) => void;
  isGraphLoading: boolean;
}

export const useGraphEffects = ({
  state,
  nodes,
  undo,
  redo,
  canUndo,
  canRedo,
  aiEnabled,
  addMessage,
  isGraphLoading,
}: UseGraphEffectsProps) => {
  const navigate = useNavigate();
  const {
    graphRef,
    setSelectedNode,
    setSelectedNodeIds,
  } = state;

  // 处理键盘快捷键
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

  // 处理图表加载后的自动居中 (示例逻辑)
  useEffect(() => {
    if (nodes.length > 0 && !isGraphLoading && graphRef.current) {
      // graphRef.current.zoomToFit(); 
    }
  }, [nodes.length, isGraphLoading, graphRef]);

  // AI 未配置警告
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

  // 处理节点选择逻辑
  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  }, [setSelectedNode, setSelectedNodeIds]);

  return {
    clearSelection,
  };
};

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/messageHelper';
import { GraphEditorState } from './index';

interface UseGraphEffectsProps {
  state: GraphEditorState;
  aiEnabled: boolean;
}

export const useGraphEffects = ({
  state,
  aiEnabled,
}: UseGraphEffectsProps) => {
  const navigate = useNavigate();
  const {
    setSelectedNode,
    setSelectedNodeIds,
  } = state;

  const hasShownAIWarningRef = useRef(false);
  useEffect(() => {
    if (aiEnabled) return;
    if (hasShownAIWarningRef.current) return;
    hasShownAIWarningRef.current = true;
    message.warning('AI 未配置：文本分析/对话将使用模拟结果，文档解析与智能推荐不可用', {
      duration: 12000,
      action: { label: '配置说明', onClick: () => navigate('/profile') }
    });
  }, [aiEnabled, navigate]);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  }, [setSelectedNode, setSelectedNodeIds]);

  return {
    clearSelection,
  };
};

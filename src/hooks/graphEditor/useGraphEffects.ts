import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const {
    setSelectedNode,
    setSelectedNodeIds,
  } = state;

  const hasShownAIWarningRef = useRef(false);
  useEffect(() => {
    if (aiEnabled) return;
    if (hasShownAIWarningRef.current) return;
    hasShownAIWarningRef.current = true;
    message.warning(t('graphEditor.aiNotConfiguredWarning'), {
      duration: 12000,
      action: { label: t('graphEditor.aiConfigAction'), onClick: () => navigate('/profile') }
    });
  }, [aiEnabled, navigate, t]);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
  }, [setSelectedNode, setSelectedNodeIds]);

  return {
    clearSelection,
  };
};

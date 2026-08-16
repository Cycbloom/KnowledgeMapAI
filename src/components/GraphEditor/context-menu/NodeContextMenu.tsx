import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api, AIAction } from '../../../services/api';
import { Zap, Loader2, BookOpen } from 'lucide-react';
import { message } from "../../../utils/messageHelper";
import { useMenuNavigation } from '../../../hooks';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  graphId: string;
  nodeContent?: string;
  onClose: () => void;
  onExecuteAction: (action: AIAction, nodeId: string) => void;
  onRefresh?: () => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x, y, nodeId, graphId, nodeContent, onClose, onExecuteAction, onRefresh
}) => {
  const { t } = useTranslation();
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [annotating, setAnnotating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const data = await api.aiActions.list(graphId);
        setActions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchActions();
  }, [graphId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAnnotateTerms = async () => {
    if (!nodeContent) return;
    setAnnotating(true);
    message.info(t('graphEditor.nodeContextMenu.termAnnotationInProgress'));
    try {
        await api.ai.annotateTerms({
            node_id: nodeId,
            node_content: nodeContent,
            graph_id: graphId
        });
        message.success(t('graphEditor.nodeContextMenu.termAnnotationDone'));
        if (onRefresh) onRefresh();
        onClose();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : t('graphEditor.nodeContextMenu.annotationFailed');
        message.error(errorMessage);
    } finally {
        setAnnotating(false);
    }
  };

  const handleMenuSelect = (index: number) => {
    if (index === 0) {
      if (!annotating) {
        handleAnnotateTerms();
      }
    } else {
      const action = actions[index - 1];
      if (action) {
        onExecuteAction(action, nodeId);
        onClose();
      }
    }
  };

  const { activeIndex } = useMenuNavigation({
    itemCount: 1 + actions.length,
    enabled: !loading,
    onSelect: handleMenuSelect,
    onClose,
  });

  if (loading) {return (
      <div className="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg p-2 z-50 border dark:border-gray-700" style={{ top: y, left: x }}>
          <Loader2 className="animate-spin h-4 w-4 text-gray-500" />
      </div>
  );}

  return (
    <div 
        ref={menuRef}
        className="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg py-1 z-50 border dark:border-gray-700 min-w-[180px]" 
        style={{ top: y, left: x }}
    >
        <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b border-gray-100 dark:border-gray-700 mb-1">
            {t('graphEditor.nodeContextMenu.systemFunction')}
        </div>
        <button
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 ${
              activeIndex === 0
                ? "bg-primary-50 dark:bg-primary-900/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            onClick={handleAnnotateTerms}
            disabled={annotating}
        >
            {annotating ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} className="text-primary-500" />}
            {t('graphEditor.nodeContextMenu.termAnnotation')}
        </button>

        {actions.length > 0 && (
            <>
                <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b border-gray-100 dark:border-gray-700 mt-1 mb-1">
                    {t('graphEditor.nodeContextMenu.aiAction')}
                </div>
                {actions.map((action, index) => (
                    <button
                        key={action.id}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          activeIndex === index + 1
                            ? "bg-primary-50 dark:bg-primary-900/30"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        onClick={() => {
                            onExecuteAction(action, nodeId);
                            onClose();
                        }}
                    >
                        <Zap size={14} className="text-primary-500" />
                        {action.name}
                    </button>
                ))}
            </>
        )}
    </div>
  );
};

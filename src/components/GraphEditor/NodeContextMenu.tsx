import React, { useEffect, useState, useRef } from 'react';
import { api, AIAction } from '../../services/api';
import { Zap, Loader2, BookOpen } from 'lucide-react';
import { useMessageStore } from '../../store/useMessageStore';

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
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [annotating, setAnnotating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { addMessage } = useMessageStore();

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
    addMessage({ content: '正在进行术语标注...', type: 'info' });
    try {
        const res = await api.ai.annotateTerms({
            node_id: nodeId,
            node_content: nodeContent,
            graph_id: graphId
        });
        addMessage({ content: '术语标注已完成', type: 'success' });
        if (onRefresh) onRefresh();
        onClose();
    } catch (error: any) {
        addMessage({ content: error.message || '标注失败', type: 'error' });
    } finally {
        setAnnotating(false);
    }
  };

  if (loading) return (
      <div className="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg p-2 z-50 border dark:border-gray-700" style={{ top: y, left: x }}>
          <Loader2 className="animate-spin h-4 w-4 text-gray-500" />
      </div>
  );

  return (
    <div 
        ref={menuRef}
        className="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg py-1 z-50 border dark:border-gray-700 min-w-[180px]" 
        style={{ top: y, left: x }}
    >
        <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b border-gray-100 dark:border-gray-700 mb-1">
            系统功能
        </div>
        <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200"
            onClick={handleAnnotateTerms}
            disabled={annotating}
        >
            {annotating ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} className="text-blue-500" />}
            术语标注
        </button>

        {actions.length > 0 && (
            <>
                <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b border-gray-100 dark:border-gray-700 mt-1 mb-1">
                    AI 动作
                </div>
                {actions.map(action => (
                    <button
                        key={action.id}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200"
                        onClick={() => {
                            onExecuteAction(action, nodeId);
                            onClose();
                        }}
                    >
                        <Zap size={14} className="text-purple-500" />
                        {action.name}
                    </button>
                ))}
            </>
        )}
    </div>
  );
};

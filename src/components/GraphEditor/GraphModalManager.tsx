import React from 'react';
import { GraphEditorState } from '../../hooks/useGraphEditorState';
import { GraphSettingsModal } from './GraphSettingsModal';
import { HelpModal } from '../HelpModal';
import { ExportDialog } from './ExportDialog';
import { ShareModal } from './ShareModal';
import { ChatDialog } from './ChatDialog';
import { ConfirmationModal } from '../ConfirmationModal';
import { queryKeys } from '../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageStore } from '../../store/useMessageStore';

interface GraphModalManagerProps {
  id: string;
  state: GraphEditorState;
  graphMeta: any;
  aiEnabled: boolean;
}

export const GraphModalManager: React.FC<GraphModalManagerProps> = ({
  id,
  state,
  graphMeta,
  aiEnabled,
}) => {
  const queryClient = useQueryClient();
  const { addMessage } = useMessageStore();
  const {
    isSettingsOpen, setIsSettingsOpen,
    isHelpOpen, setIsHelpOpen,
    isChatOpen, setIsChatOpen,
    isExportImageModalOpen, setIsExportImageModalOpen,
    isShareModalOpen, setIsShareModalOpen,
    confirmModal, setConfirmModal,
    exportImageOptions, setExportImageOptions,
    selectedNodeIds,
    isExportPDFOpen, setIsExportPDFOpen,
  } = state;

  const exportOps = {
    confirmExportImage: async () => {
      try {
        if (!state.graphRef.current) return;
        const dataUrl = await state.graphRef.current.captureScreenshot(exportImageOptions);
        const link = document.createElement('a');
        link.download = `${graphMeta?.title || 'graph'}_snapshot.png`;
        link.href = dataUrl;
        link.click();
        setIsExportImageModalOpen(false);
        addMessage({ content: '图片导出成功', type: 'success' });
      } catch (error) {
        console.error('Export image failed:', error);
        addMessage({ content: '图片导出失败', type: 'error' });
      }
    }
  };

  return (
    <>
      <GraphSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        graphId={id || ''}
      />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ExportDialog 
        isOpen={isExportPDFOpen}
        onClose={() => setIsExportPDFOpen(false)}
        graphId={id || ''}
        graphTitle={graphMeta?.title || '未命名图谱'}
        getScreenshot={() => state.graphRef.current?.captureScreenshot({ transparent: true, fitView: true, hideGrid: true }) || null}
      />
      
      {/* Image Export Modal */}
      {isExportImageModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-6">
            <h2 className="text-xl font-bold mb-4 dark:text-white">导出为图片</h2>
            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer dark:text-gray-200">
                <input 
                  type="checkbox" 
                  checked={exportImageOptions.transparent} 
                  onChange={e => setExportImageOptions(prev => ({ ...prev, transparent: e.target.checked }))}
                />
                透明背景
              </label>
              <label className="flex items-center gap-2 cursor-pointer dark:text-gray-200">
                <input 
                  type="checkbox" 
                  checked={exportImageOptions.fitView} 
                  onChange={e => setExportImageOptions(prev => ({ ...prev, fitView: e.target.checked }))}
                />
                自适应视图
              </label>
              <label className="flex items-center gap-2 cursor-pointer dark:text-gray-200">
                <input 
                  type="checkbox" 
                  checked={exportImageOptions.hideGrid} 
                  onChange={e => setExportImageOptions(prev => ({ ...prev, hideGrid: e.target.checked }))}
                />
                隐藏网格
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsExportImageModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={exportOps.confirmExportImage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                导出
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        graphId={id || ''}
        isPublic={graphMeta?.is_public || false}
        onPublicChange={(newStatus) => {
          if (graphMeta) {
             queryClient.setQueryData(queryKeys.graph(id || ''), { ...graphMeta, is_public: newStatus });
          }
        }}
      />
      <ChatDialog 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        graphId={id || ''}
        selectedNodeIds={Array.from(selectedNodeIds)}
        aiEnabled={aiEnabled}
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="删除"
        isDangerous={true}
      />
    </>
  );
};

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Image } from "lucide-react";
import { GraphEditorState } from "../../../hooks";
import { GraphSettingsModal } from "./GraphSettingsModal";
import { ExportDialog } from "./ExportDialog";
import { ShareModal } from "./ShareModal";
import { PodcastModal } from "./PodcastModal";
import { ConfirmationModal } from "../../common";
import { queryKeys } from "../../../hooks/queries/config";
import { useQueryClient } from "@tanstack/react-query";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";

interface GraphModalManagerProps {
  id: string;
  state: GraphEditorState;
  graphMeta: any;
  aiEnabled: boolean;
  tutorOps?: any;
  nodes: any[];
}

export const GraphModalManager: React.FC<GraphModalManagerProps> = ({
  id,
  state,
  graphMeta,
  nodes,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    isPodcastModalOpen,
    setIsPodcastModalOpen,
    isExportImageModalOpen,
    setIsExportImageModalOpen,
    isShareModalOpen,
    setIsShareModalOpen,
    confirmModal,
    setConfirmModal,
    exportImageOptions,
    setExportImageOptions,
    isExportPDFOpen,
    setIsExportPDFOpen,
  } = state;

  const handleConfirmExportImage = async () => {
    try {
      setIsExporting(true);
      if (!state.graphRef.current?.captureScreenshot) {
        frontendEventBus.publish("message_show", { content: t("graphEditor.export.notSupported"), type: "error" });
        setIsExportImageModalOpen(false);
        return;
      }
      const dataUrl =
        await state.graphRef.current.captureScreenshot(exportImageOptions);
      const link = document.createElement("a");
      const safeTitle = (graphMeta?.title || "graph").replace(/[^a-z0-9\u4e00-\u9fff]/gi, "_").toLowerCase();
      link.download = `${safeTitle}-graph.png`;
      link.href = dataUrl;
      link.click();
      setIsExportImageModalOpen(false);
      frontendEventBus.publish("message_show", { content: t("graphEditor.export.success"), type: "success" });
    } catch (error) {
      console.error("Export image failed:", error);
      frontendEventBus.publish("message_show", { content: t("graphEditor.export.failed"), type: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <GraphSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        graphId={id || ""}
      />
      <ExportDialog
        isOpen={isExportPDFOpen}
        onClose={() => setIsExportPDFOpen(false)}
        graphId={id || ""}
        graphTitle={graphMeta?.title || t("graphEditor.mindMap.unnamed")}
        getScreenshot={async () => {
          if (!state.graphRef.current?.captureScreenshot) return null;
          return state.graphRef.current.captureScreenshot({
            transparent: true,
            fitView: true,
            hideGrid: true,
          });
        }}
      />

      {/* Image Export Modal */}
      {isExportImageModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Image className="text-primary-600" size={20} />
                {t("graphEditor.export.imageTitle")}
              </h2>
              <button
                onClick={() => setIsExportImageModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                disabled={isExporting}
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer dark:text-gray-200 group">
                <input
                  type="checkbox"
                  checked={exportImageOptions.transparent}
                  onChange={(e) =>
                    setExportImageOptions((prev) => ({
                      ...prev,
                      transparent: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isExporting}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 transition-colors">
                  {t("graphEditor.export.transparent")}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer dark:text-gray-200 group">
                <input
                  type="checkbox"
                  checked={exportImageOptions.fitView}
                  onChange={(e) =>
                    setExportImageOptions((prev) => ({
                      ...prev,
                      fitView: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isExporting}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 transition-colors">
                  {t("graphEditor.export.fitView")}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer dark:text-gray-200 group">
                <input
                  type="checkbox"
                  checked={exportImageOptions.hideGrid}
                  onChange={(e) =>
                    setExportImageOptions((prev) => ({
                      ...prev,
                      hideGrid: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isExporting}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 transition-colors">
                  {t("graphEditor.export.hideGrid")}
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setIsExportImageModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                disabled={isExporting}
              >
                {t("graphEditor.export.cancel")}
              </button>
              <button
                onClick={handleConfirmExportImage}
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Image size={16} />
                )}
                {isExporting ? t("graphEditor.export.exporting") : t("graphEditor.export.exportBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        graphId={id || ""}
        isPublic={graphMeta?.is_public || false}
        ownerId={graphMeta?.user_id}
        onPublicChange={(newStatus) => {
          if (graphMeta) {
            queryClient.setQueryData(queryKeys.graph(id || ""), {
              ...graphMeta,
              is_public: newStatus,
            });
          }
        }}
      />
      <PodcastModal
        isOpen={isPodcastModalOpen}
        onClose={() => setIsPodcastModalOpen(false)}
        nodes={nodes}
        graphTitle={graphMeta?.title || t("graphEditor.mindMap.unnamed")}
        graphId={id}
        initialScript={graphMeta?.podcast_script}
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="删除"
        isDangerous={true}
      />
    </>
  );
};

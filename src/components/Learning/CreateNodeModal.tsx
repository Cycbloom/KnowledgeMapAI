import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useCallback } from "react";
import { NodeLevel } from "../../types";
import { useFocusTrap, useEscapeKey, useFormDraft } from "../../hooks";
import { ConfirmationModal } from "../common/ConfirmationModal";

interface CreateNodeDraft {
  newNodeTitle: string;
  newNodeContent: string;
  newNodeLevel: NodeLevel;
  selectedParentNodeId: string;
}

interface CreateNodeModalProps {
  isDark: boolean;
  isOpen: boolean;
  newNodeTitle: string;
  newNodeContent: string;
  newNodeLevel: NodeLevel;
  selectedParentNodeId: string;
  graphNodes: { id: string; title: string }[] | undefined;
  onNewNodeTitleChange: (value: string) => void;
  onNewNodeContentChange: (value: string) => void;
  onNewNodeLevelChange: (value: NodeLevel) => void;
  onSelectedParentNodeIdChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export const CreateNodeModal = ({
  isDark,
  isOpen,
  newNodeTitle,
  newNodeContent,
  newNodeLevel,
  selectedParentNodeId,
  graphNodes,
  onNewNodeTitleChange,
  onNewNodeContentChange,
  onNewNodeLevelChange,
  onSelectedParentNodeIdChange,
  onClose,
  onCreate,
}: CreateNodeModalProps) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const {
    setValue: setDraft,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<CreateNodeDraft>({
    key: "create_node_draft",
    initialValue: {
      newNodeTitle,
      newNodeContent,
      newNodeLevel,
      selectedParentNodeId,
    },
  });

  // Persist current prop values to draft (debounced via useFormDraft)
  useEffect(() => {
    setDraft({
      newNodeTitle,
      newNodeContent,
      newNodeLevel,
      selectedParentNodeId,
    });
  }, [
    newNodeTitle,
    newNodeContent,
    newNodeLevel,
    selectedParentNodeId,
    setDraft,
  ]);

  // On restore, apply draft values to parent via change callbacks
  const handleRestore = useCallback(() => {
    try {
      const raw = window.localStorage.getItem("create_node_draft");
      if (raw) {
        const draft = JSON.parse(raw) as CreateNodeDraft;
        onNewNodeTitleChange(draft.newNodeTitle ?? "");
        onNewNodeContentChange(draft.newNodeContent ?? "");
        onNewNodeLevelChange(draft.newNodeLevel ?? "normal");
        onSelectedParentNodeIdChange(draft.selectedParentNodeId ?? "");
      }
    } catch {
      // ignore parse errors
    }
    onRestore();
  }, [
    onRestore,
    onNewNodeTitleChange,
    onNewNodeContentChange,
    onNewNodeLevelChange,
    onSelectedParentNodeIdChange,
  ]);

  const handleCreate = useCallback(() => {
    clearDraft();
    onCreate();
  }, [clearDraft, onCreate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={containerRef}
        className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"} rounded-xl shadow-2xl w-full max-w-md mx-4 border`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3
              className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {t("learning.node.createTitle")}
            </h3>
            <button
              onClick={onClose}
              aria-label={t("common.aria.close")}
              className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                {t("learning.node.titleLabel")}{" "}
                <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                type="text"
                aria-required={true}
                value={newNodeTitle}
                onChange={(e) => onNewNodeTitleChange(e.target.value)}
                placeholder={t("learning.node.titlePlaceholder")}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                {t("learning.node.contentLabel")}
              </label>
              <textarea
                value={newNodeContent}
                onChange={(e) => onNewNodeContentChange(e.target.value)}
                placeholder={t("learning.node.contentPlaceholder")}
                rows={4}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all resize-none ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                {t("learning.node.levelLabel")}
              </label>
              <select
                value={newNodeLevel}
                onChange={(e) =>
                  onNewNodeLevelChange(e.target.value as NodeLevel)
                }
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="root">{t("learning.node.levelRoot")}</option>
                <option value="core">{t("learning.node.levelCore")}</option>
                <option value="sub">{t("learning.node.levelSub")}</option>
                <option value="normal">
                  {t("learning.node.levelNormal")}
                </option>
                <option value="leaf">{t("learning.node.levelLeaf")}</option>
              </select>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                {t("learning.node.parentLabel")}
              </label>
              <select
                value={selectedParentNodeId}
                onChange={(e) => onSelectedParentNodeIdChange(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="">{t("learning.node.noParent")}</option>
                {graphNodes?.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("learning.node.cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={!newNodeTitle.trim()}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                !newNodeTitle.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              }`}
            >
              <Plus size={18} aria-hidden="true" />
              {t("learning.node.createButton")}
            </button>
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={handleRestore}
        title={t("common.restoreDraftTitle")}
        message={t("common.restoreDraftMessage")}
        isDangerous={false}
      />
    </div>
  );
};

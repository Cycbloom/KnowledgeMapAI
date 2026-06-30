import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NodeLevel } from "../../types";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
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
              className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                {t("learning.node.titleLabel")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
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
              onClick={onCreate}
              disabled={!newNodeTitle.trim()}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                !newNodeTitle.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              }`}
            >
              <Plus size={18} />
              {t("learning.node.createButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

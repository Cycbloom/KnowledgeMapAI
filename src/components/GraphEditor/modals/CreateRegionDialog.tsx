import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Palette, Check } from "lucide-react";
import type { Node, CustomRegion } from "@shared/types/graph";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";

interface CreateRegionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    region: Omit<CustomRegion, "id" | "createdAt" | "updatedAt">,
  ) => void;
  selectedNodeIds: Set<string>;
  nodes: Node[];
}

const PRESET_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
  "#F97316",
  "#84CC16",
];

export const CreateRegionDialog: React.FC<CreateRegionDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  selectedNodeIds,
  nodes,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isCustomColor, setIsCustomColor] = useState(false);

  const selectedNodes = useMemo(() => {
    return nodes.filter((node) => selectedNodeIds.has(node.id));
  }, [nodes, selectedNodeIds]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      color,
      nodeIds: Array.from(selectedNodeIds),
    });

    setName("");
    setColor(PRESET_COLORS[0]);
    setIsCustomColor(false);
    onClose();
  };

  const handleClose = () => {
    setName("");
    setColor(PRESET_COLORS[0]);
    setIsCustomColor(false);
    onClose();
  };

  const contentRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(handleClose, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-region-dialog-title"
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="create-region-dialog-title" className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Palette className="text-primary-600" size={20} />
            {t("graphEditor.region.createRegion")}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t("graphEditor.region.regionName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("graphEditor.region.regionNamePlaceholder")}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t("graphEditor.region.regionColor")}
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  onClick={() => {
                    setColor(presetColor);
                    setIsCustomColor(false);
                  }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === presetColor && !isCustomColor
                      ? "border-slate-800 dark:border-white scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                >
                  {color === presetColor && !isCustomColor && (
                    <Check size={14} className="text-white mx-auto" />
                  )}
                </button>
              ))}
              <button
                onClick={() => setIsCustomColor(true)}
                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                  isCustomColor
                    ? "border-slate-800 dark:border-white scale-110"
                    : "border-slate-300 dark:border-slate-500 hover:scale-105"
                }`}
                style={{
                  background: isCustomColor
                    ? color
                    : "linear-gradient(135deg, #ff0000, #00ff00, #0000ff)",
                }}
              >
                {isCustomColor && <Check size={14} className="text-white" />}
              </button>
            </div>
            {isCustomColor && (
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t("graphEditor.region.selectedNodes")} ({selectedNodes.length})
            </label>
            <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-500 p-2">
              {selectedNodes.length === 0 ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                  {t("graphEditor.region.noSelectedNodes")}
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedNodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">
                        {node.title || t("graphEditor.outline.unnamedNode")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || selectedNodes.length === 0}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
};

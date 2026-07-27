import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Palette, Check, Plus, Minus } from "lucide-react";
import type { Node, CustomRegion } from "@shared/types/graph";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";

interface EditRegionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (region: CustomRegion) => void;
  region: CustomRegion | null;
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

export const EditRegionDialog: React.FC<EditRegionDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  region,
  nodes,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [nodeIds, setNodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (region) {
      setName(region.name);
      setColor(region.color);
      setNodeIds(new Set(region.nodeIds));
      setIsCustomColor(!PRESET_COLORS.includes(region.color));
    }
  }, [region]);

  const regionNodes = useMemo(() => {
    return nodes.filter((node) => nodeIds.has(node.id));
  }, [nodes, nodeIds]);

  const availableNodes = useMemo(() => {
    return nodes.filter((node) => !nodeIds.has(node.id));
  }, [nodes, nodeIds]);

  const handleToggleNode = (nodeId: string) => {
    setNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleAddAll = () => {
    setNodeIds(new Set(nodes.map((n) => n.id)));
  };

  const handleClearAll = () => {
    setNodeIds(new Set());
  };

  const handleSubmit = () => {
    if (!name.trim() || !region) return;

    onSave({
      ...region,
      name: name.trim(),
      color,
      nodeIds: Array.from(nodeIds),
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  const contentRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(handleClose, isOpen);

  if (!isOpen || !region) return null;

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
        aria-labelledby="edit-region-dialog-title"
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="edit-region-dialog-title" className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Palette className="text-primary-600" size={20} />
            {t("graphEditor.region.editRegion")}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                aria-label={t('graphEditor.region.colorLabel')}
                className="w-full h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-500"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("graphEditor.region.manageNodes")} ({regionNodes.length})
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddAll}
                  className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                  title={t("common.selectAll")}
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={handleClearAll}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  title={t("common.deselectAll")}
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t("graphEditor.region.inRegion")}
                </div>
                <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-500 p-2">
                  {regionNodes.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      {t("graphEditor.region.noSelectedNodes")}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {regionNodes.map((node) => (
                        <div
                          key={node.id}
                          onClick={() => handleToggleNode(node.id)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate flex-1">
                            {node.title || t("graphEditor.outline.unnamedNode")}
                          </span>
                          <Minus size={12} className="text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t("graphEditor.region.availableNodes")}
                </div>
                <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-500 p-2">
                  {availableNodes.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      {t("graphEditor.region.noAvailableNodes")}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {availableNodes.map((node) => (
                        <div
                          key={node.id}
                          onClick={() => handleToggleNode(node.id)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-500" />
                          <span className="truncate flex-1">
                            {node.title || t("graphEditor.outline.unnamedNode")}
                          </span>
                          <Plus size={12} className="text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
            disabled={!name.trim()}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

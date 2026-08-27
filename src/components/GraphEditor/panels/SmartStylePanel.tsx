import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Palette,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { api } from "../../../services/api";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";

interface NodeStyleSuggestion {
  node_id: string;
  color: string;
  icon: string;
  reason: string;
}

interface SmartStylePanelProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  nodes: Array<{ id: string; title: string; content?: string; level?: string }>;
  onApply: (
    suggestions: NodeStyleSuggestion[],
  ) => Promise<void>;
}

export const SmartStylePanel: React.FC<SmartStylePanelProps> = ({
  isOpen,
  onClose,
  graphId: _graphId,
  nodes,
  onApply,
}) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<NodeStyleSuggestion[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (nodes.length === 0) return;
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setApplied(false);
    try {
      const result = await api.ai.suggestNodeStyles({ nodes });
      setSuggestions(result.suggestions);
      if (result.usedDefault && result.suggestions.length > 0) {
        // 仍展示（默认样式），但不报错
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.smartStyle.generateFailed");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!suggestions || suggestions.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await onApply(suggestions);
      setApplied(true);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.smartStyle.applyFailed");
      setError(errMsg);
    } finally {
      setApplying(false);
    }
  };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("graphEditor.smartStyle.title")}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Palette className="text-primary-500" size={20} />
            {t("graphEditor.smartStyle.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.aria.close")}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("graphEditor.smartStyle.description")}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading || nodes.length === 0 || applying}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-pink-500 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading
                ? t("graphEditor.smartStyle.generating")
                : t("graphEditor.smartStyle.generate")}
            </button>
            {suggestions && !applied && (
              <button
                onClick={() => {
                  setSuggestions(null);
                  setApplied(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RotateCcw size={14} />
                {t("graphEditor.smartStyle.reset")}
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {applied && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
              <Check size={16} />
              {t("graphEditor.smartStyle.applied")}
            </div>
          )}

          {suggestions && suggestions.length > 0 && !applied && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} />
                {t("graphEditor.smartStyle.previewHint")}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 max-h-64 overflow-y-auto space-y-1.5 bg-gray-50 dark:bg-slate-700/40">
                {suggestions.map((s) => {
                  const node = nodeById.get(s.node_id);
                  return (
                    <div
                      key={s.node_id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 border border-black/5"
                        style={{ backgroundColor: `${s.color}22` }}
                      >
                        {s.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {node?.title || s.node_id}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <span className="font-mono">{s.color}</span>
                          {s.reason && <span className="truncate">{s.reason}</span>}
                        </div>
                      </div>
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {t("graphEditor.smartStyle.cancel")}
          </button>
          {suggestions && suggestions.length > 0 && !applied && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {applying
                ? t("graphEditor.smartStyle.applying")
                : t("graphEditor.smartStyle.apply")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartStylePanel;

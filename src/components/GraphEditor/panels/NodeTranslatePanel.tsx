import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Languages,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { api } from "../../../services/api";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";

interface NodeTranslation {
  node_id: string;
  title: string;
  content?: string;
  summary?: string;
}

interface NodeTranslatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; title: string; content?: string; summary?: string }>;
  onApply: (
    translations: NodeTranslation[],
    targetLanguage: string,
  ) => Promise<void>;
}

const LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "en-US", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
];

export const NodeTranslatePanel: React.FC<NodeTranslatePanelProps> = ({
  isOpen,
  onClose,
  nodes,
  onApply,
}) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const [targetLang, setTargetLang] = useState("en-US");
  const [loading, setLoading] = useState(false);
  const [translations, setTranslations] = useState<NodeTranslation[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTranslate = async () => {
    if (nodes.length === 0) return;
    setLoading(true);
    setError(null);
    setTranslations(null);
    setApplied(false);
    try {
      const result = await api.ai.translateNodes({
        nodes,
        target_language: targetLang,
      });
      setTranslations(result.translations);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.nodeTranslate.translateFailed");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!translations || translations.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await onApply(translations, targetLang);
      setApplied(true);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.nodeTranslate.applyFailed");
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
        aria-label={t("graphEditor.nodeTranslate.title")}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Languages className="text-primary-500" size={20} />
            {t("graphEditor.nodeTranslate.title")}
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
            {t("graphEditor.nodeTranslate.description", { count: nodes.length })}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("graphEditor.nodeTranslate.targetLanguage")}
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setTargetLang(lang.code);
                    setTranslations(null);
                    setApplied(false);
                  }}
                  aria-pressed={targetLang === lang.code}
                  className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-all ${
                    targetLang === lang.code
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-slate-600 hover:border-primary-300"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTranslate}
              disabled={loading || nodes.length === 0 || applying}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading
                ? t("graphEditor.nodeTranslate.translating")
                : t("graphEditor.nodeTranslate.translate")}
            </button>
            {translations && !applied && (
              <button
                onClick={() => {
                  setTranslations(null);
                  setApplied(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RotateCcw size={14} />
                {t("graphEditor.nodeTranslate.reset")}
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
              {t("graphEditor.nodeTranslate.applied")}
            </div>
          )}

          {translations && translations.length > 0 && !applied && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} />
                {t("graphEditor.nodeTranslate.previewHint")}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 max-h-64 overflow-y-auto space-y-2 bg-gray-50 dark:bg-slate-700/40">
                {translations.map((tr) => {
                  const node = nodeById.get(tr.node_id);
                  return (
                    <div
                      key={tr.node_id}
                      className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {t("graphEditor.nodeTranslate.original")}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {node?.title}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {tr.title}
                      </div>
                      {tr.summary && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                          {tr.summary}
                        </p>
                      )}
                      {tr.content && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {tr.content}
                        </p>
                      )}
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
            {t("graphEditor.nodeTranslate.cancel")}
          </button>
          {translations && translations.length > 0 && !applied && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {applying
                ? t("graphEditor.nodeTranslate.applying")
                : t("graphEditor.nodeTranslate.apply")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeTranslatePanel;

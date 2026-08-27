import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  X,
  Languages,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { tasksApi } from "../../../services/api/tasks";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";
import { message } from "../../../utils/messageHelper";

interface NodeTranslatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; title: string; content?: string; summary?: string }>;
  graphId?: string;
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

const FIELDS = [
  { key: "title", labelKey: "graphEditor.nodeTranslate.fieldTitle" },
  { key: "content", labelKey: "graphEditor.nodeTranslate.fieldContent" },
  { key: "summary", labelKey: "graphEditor.nodeTranslate.fieldSummary" },
] as const;

export const NodeTranslatePanel: React.FC<NodeTranslatePanelProps> = ({
  isOpen,
  onClose,
  nodes,
  graphId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const [targetLang, setTargetLang] = useState("en-US");
  const [fields, setFields] = useState<string[]>([
    "title",
    "content",
    "summary",
  ]);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleField = (key: string) => {
    setFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    );
  };

  const handleCreateTask = async () => {
    if (nodes.length === 0) return;
    if (fields.length === 0) {
      setError(t("graphEditor.nodeTranslate.noFieldSelected"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await tasksApi.create({
        type: "translate_nodes",
        payload: {
          node_ids: nodes.map((n) => n.id),
          graph_id: graphId,
          target_language: targetLang,
          only_missing: onlyMissing,
          fields,
        },
      });
      setCreatedTaskId(task.id);
      message.success(t("graphEditor.nodeTranslate.taskCreated"));
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.nodeTranslate.createFailed");
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewTasks = () => {
    onClose();
    navigate("/tasks");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("graphEditor.nodeTranslate.title")}
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
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

          {createdTaskId ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200">
                {t("graphEditor.nodeTranslate.taskCreatedHint")}
              </p>
              <button
                onClick={handleViewTasks}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
              >
                {t("graphEditor.nodeTranslate.viewTasks")}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("graphEditor.nodeTranslate.targetLanguage")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setTargetLang(lang.code)}
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

              {/* 翻译设置（可配置字段 + 去重） */}
              <div className="rounded-lg border border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowSettings((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-t-lg"
                >
                  <Settings2 size={15} className="text-gray-400 dark:text-gray-500" />
                  {t("graphEditor.nodeTranslate.settings")}
                  <ChevronDown
                    size={15}
                    className={`ml-auto text-gray-400 transition-transform ${
                      showSettings ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showSettings && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                        {t("graphEditor.nodeTranslate.fieldsLabel")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {FIELDS.map((f) => (
                          <label
                            key={f.key}
                            className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md bg-gray-50 dark:bg-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={fields.includes(f.key)}
                              onChange={() => toggleField(f.key)}
                              className="accent-primary-600"
                            />
                            {t(f.labelKey)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={onlyMissing}
                        onChange={(e) => setOnlyMissing(e.target.checked)}
                        className="accent-primary-600"
                      />
                      {t("graphEditor.nodeTranslate.onlyMissing")}
                    </label>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t("graphEditor.nodeTranslate.onlyMissingHint")}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                  <AlertTriangle size={15} />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateTask}
                  disabled={submitting || nodes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {submitting
                    ? t("graphEditor.nodeTranslate.creating")
                    : t("graphEditor.nodeTranslate.createTask")}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t("graphEditor.nodeTranslate.asyncHint")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {t("graphEditor.nodeTranslate.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NodeTranslatePanel;
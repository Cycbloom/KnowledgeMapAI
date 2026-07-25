import React, { useState, useEffect, useCallback } from "react";
import { Save, Eye, Edit3, Maximize2, Minimize2, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../common/EmptyState";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { useFormDraft, useAutoSave, useBeforeUnload } from "../../../hooks";
import { ConfirmationModal } from "../../common/ConfirmationModal";
import { sanitizeHtml } from "@/utils/sanitize";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  placeholder = "在这里记录任务笔记...",
  className = "",
}) => {
  const [isEditing, setIsEditing] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    value: localValue,
    setValue: setLocalValue,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<string>({
    key: "markdown_editor_draft",
    initialValue: value,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  const { status: autoSaveStatus, save: autoSaveNow } = useAutoSave<string>({
    value: localValue,
    onSave: (v) => onSave?.(v),
    delay: 3000,
    enabled: !!localValue && !!onSave,
  });

  useEffect(() => {
    setLocalValue(value);
  }, [value, setLocalValue]);

  // Warn user before leaving when there are unsaved changes
  useBeforeUnload(localValue !== value, t("common.unsavedChanges"));

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange(newValue);
    },
    [onChange, setLocalValue],
  );

  const handleSave = useCallback(async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(localValue);
        clearDraft();
      } finally {
        setIsSaving(false);
      }
    }
  }, [onSave, localValue, clearDraft]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void autoSaveNow();
      }
    },
    [autoSaveNow],
  );

  const renderPreview = () => {
    const lines = localValue.split("\n");
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {lines.map((line, index) => {
          if (line.startsWith("### ")) {
            return (
              <h3 key={index} className="text-lg font-semibold mt-4 mb-2">
                {line.slice(4)}
              </h3>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h2 key={index} className="text-xl font-bold mt-4 mb-2">
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith("# ")) {
            return (
              <h1 key={index} className="text-2xl font-bold mt-4 mb-2">
                {line.slice(2)}
              </h1>
            );
          }
          if (line.startsWith("- ")) {
            return (
              <li key={index} className="ml-4">
                {line.slice(2)}
              </li>
            );
          }
          if (line.startsWith("* ") || line.startsWith("- ")) {
            return (
              <li key={index} className="ml-4">
                {line.slice(2)}
              </li>
            );
          }
          if (line.startsWith("```")) {
            return null;
          }
          if (line.trim() === "") {
            return <br key={index} />;
          }
          let processedLine = line;
          processedLine = processedLine.replace(
            /\*\*(.+?)\*\*/g,
            "<strong>$1</strong>",
          );
          processedLine = processedLine.replace(/\*(.+?)\*/g, "<em>$1</em>");
          processedLine = processedLine.replace(
            /`(.+?)`/g,
            '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">$1</code>',
          );
          processedLine = processedLine.replace(
            /\[(.+?)\]\((.+?)\)/g,
            '<a href="$2" class="text-primary-500 underline" target="_blank">$1</a>',
          );

          return (
            <p
              key={index}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedLine) }}
            />
          );
        })}
      </div>
    );
  };

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 bg-white dark:bg-slate-900"
    : "";

  return (
    <ErrorBoundary
      fallbackRender={(error, resetErrorBoundary) => (
        <div className="p-4 border border-red-300 rounded-xl bg-red-50 dark:bg-red-900/20 dark:border-red-700">
          <p className="text-red-700 dark:text-red-400 font-medium">编辑器崩溃</p>
          <p className="text-sm text-red-600 dark:text-red-300 mt-1 break-words">
            {error.message}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(value);
              }}
              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
            >
              复制内容
            </button>
            <button
              onClick={resetErrorBoundary}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}
    >
      <div className={`flex flex-col h-full ${containerClass} ${className}`}>
        <div className={`flex flex-col h-full ${isFullscreen ? "p-4" : ""}`}>
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-slate-500">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isEditing
                    ? "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Edit3 size={14} className="inline mr-1" />
                编辑
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  !isEditing
                    ? "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Eye size={14} className="inline mr-1" />
                预览
              </button>
            </div>
            <div className="flex items-center gap-2">
              {onSave && autoSaveStatus !== "idle" && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {autoSaveStatus === "saving" && t("common.saving")}
                  {autoSaveStatus === "saved" && t("toast.common.saved")}
                  {autoSaveStatus === "error" && t("toast.common.saveFailed")}
                </span>
              )}
              {onSave && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg text-sm font-medium hover:from-primary-600 hover:to-primary-600 disabled:opacity-50 transition-all"
                >
                  <Save size={14} />
                  {isSaving ? "保存中..." : "保存"}
                </button>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {isEditing ? (
              <textarea
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full h-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400"
              />
            ) : (
              <div className="h-full overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 rounded-xl">
                {localValue ? (
                  renderPreview()
                ) : (
                  <EmptyState icon={<FileText size={32} />} title={t('scheduler.empty.content')} className="min-h-0 py-4" />
                )}
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            支持 Markdown 语法：**粗体** *斜体* `代码` [链接](url) # 标题 - 列表
          </div>
        </div>
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t("common.restoreDraftTitle")}
          message={t("common.restoreDraftMessage")}
          isDangerous={false}
        />
      </div>
    </ErrorBoundary>
  );
};

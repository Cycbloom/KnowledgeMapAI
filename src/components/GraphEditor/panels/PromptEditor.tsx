import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Sparkles, Save, Variable } from "lucide-react";
import { api } from "../../../services/api";
import { useAutoSave, useBeforeUnload } from "../../../hooks";
import { message } from "@/utils/messageHelper";

interface PromptEditorProps {
  initialContent: string;
  variables: string[];
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  title?: string;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  initialContent,
  variables,
  onSave,
  onCancel,
  title = "Edit Prompt",
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeInstruction, setOptimizeInstruction] = useState("");
  const [showOptimizeInput, setShowOptimizeInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { status: autoSaveStatus } = useAutoSave<string>({
    value: content,
    onSave: async (v) => {
      await onSave(v);
    },
    delay: 3000,
    enabled: true,
  });

  // Update content if initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Warn user before leaving when there are unsaved changes
  useBeforeUnload(content !== initialContent, t("common.unsavedChanges"));

  const handleInsertVariable = (variable: string) => {
    const textarea = document.getElementById(
      "prompt-editor-textarea",
    ) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newContent = `${before}{{${variable}}}${after}`;
      setContent(newContent);

      // Restore focus and cursor position after render
      setTimeout(() => {
        textarea.focus();
        const newPos = start + variable.length + 4; // {{}} is 4 chars
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setContent((prev) => `${prev} {{${variable}}}`);
    }
  };

  const handleOptimize = async () => {
    if (!content.trim()) return;
    setIsOptimizing(true);
    try {
      const result = await api.prompts.optimize({
        template_content: content,
        instruction: optimizeInstruction,
      }) as { optimized_content: string };
      setContent(result.optimized_content);
      setShowOptimizeInput(false);
      setOptimizeInstruction(""); // Clear instruction
    } catch (error) {
      console.error("Optimization failed", error);
      message.error(
        t("promptEditor.optimizeFailed", { message: (error as any).message }),
      );
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } catch (error) {
      console.error("Save failed", error);
      message.error(t("promptEditor.saveFailed", { message: (error as any).message }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border dark:border-gray-700">
      {/* Header - only show if title is provided */}
      {title && (
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 overflow-x-auto">
        <span className="text-xs font-medium text-gray-500 uppercase mr-2 flex-shrink-0">
          {t("promptEditor.availableVariables")}:
        </span>
        {variables.map((v) => (
          <button
            key={v}
            onClick={() => handleInsertVariable(v)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded dark:text-primary-400 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 transition-colors whitespace-nowrap"
            title={`插入 {{${v}}}`}
          >
            <Variable size={12} />
            {v}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 relative min-h-[300px]">
        <textarea
          id="prompt-editor-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none dark:bg-gray-800 dark:text-gray-200"
          placeholder={t("promptEditor.placeholder")}
          spellCheck={false}
        />

        {/* Optimize Overlay/Panel */}
        {showOptimizeInput && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg animate-in slide-in-from-bottom-5 z-10">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("promptEditor.optimizeInstruction")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optimizeInstruction}
                  onChange={(e) => setOptimizeInstruction(e.target.value)}
                  placeholder={t("promptEditor.optimizePlaceholder")}
                  className="flex-1 px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500"
                  onKeyDown={(e) => e.key === "Enter" && handleOptimize()}
                  autoFocus
                />
                <button
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                >
                  {isOptimizing ? (
                    t("promptEditor.optimizing")
                  ) : (
                    <>
                      <Sparkles size={16} /> {t("promptEditor.startOptimize")}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowOptimizeInput(false)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {t("promptEditor.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-2 items-center">
          {autoSaveStatus !== "idle" && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {autoSaveStatus === "saving" && t("common.saving")}
              {autoSaveStatus === "saved" && t("common.saved")}
              {autoSaveStatus === "error" && t("common.saveFailed")}
            </span>
          )}
          {!showOptimizeInput && (
            <button
              onClick={() => setShowOptimizeInput(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-md dark:text-primary-400 dark:hover:bg-primary-900/20 transition-colors"
            >
              <Sparkles size={16} />
              {t("promptEditor.aiOptimize")}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            {t("promptEditor.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
          >
            <Save size={16} />
            {isSaving
              ? t("promptEditor.saving")
              : t("promptEditor.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  X,
  Save,
  BookOpen,
  Briefcase,
  Search,
  Layers,
  Microscope,
  Sparkles,
  Clock,
  Tag,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { taskTemplatesApi } from "../../services/api/taskTemplates";
import { message } from "../../utils/messageHelper";
import { useTheme, useFocusTrap, useEscapeKey, useFormDraft } from "../../hooks";
import { ConfirmationModal } from "../common/ConfirmationModal";

const categoryIcons: Record<string, React.ReactNode> = {
  knowledge: <BookOpen size={18} />,
  project: <Briefcase size={18} />,
  analysis: <Search size={18} />,
  architecture: <Layers size={18} />,
  topicResearch: <Microscope size={18} />,
  creative: <Sparkles size={18} />,
};

interface SaveAsTemplateModalProps {
  task: {
    id: string;
    title: string;
    description?: string;
    estimated_duration?: number;
    tags?: string[];
    priority?: number;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({
  task,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      knowledge: t("scheduler.saveAsTemplate.categories.knowledge"),
      project: t("scheduler.saveAsTemplate.categories.project"),
      analysis: t("scheduler.saveAsTemplate.categories.analysis"),
      architecture: t("scheduler.saveAsTemplate.categories.architecture"),
      topicResearch: t("scheduler.saveAsTemplate.categories.topicResearch"),
      creative: t("scheduler.saveAsTemplate.categories.creative"),
    }),
    [t],
  );
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: true });
  useEscapeKey(() => onClose());
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState("");

  interface SaveAsTemplateDraft {
    name: string;
    description: string;
    category: "knowledge" | "project" | "analysis" | "architecture" | "topicResearch" | "creative";
    titleTemplate: string;
    descriptionTemplate: string;
    estimatedDuration: number;
    tags: string[];
    priority: number;
  }

  const initialDraft: SaveAsTemplateDraft = {
    name: task.title,
    description: task.description || "",
    category: "creative",
    titleTemplate: task.title,
    descriptionTemplate: task.description || "",
    estimatedDuration: task.estimated_duration || 25,
    tags: task.tags || [],
    priority: task.priority || 2,
  };

  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<SaveAsTemplateDraft>({
    key: "saveAsTemplate_draft",
    initialValue: initialDraft,
  });

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map((m) => m.slice(2, -2).trim());
  };

  const suggestVariables = () => {
    const words = task.title.split(/\s+/).filter((w) => w.length > 2);
    let suggestedTitle = task.title;
    words.slice(0, 2).forEach((word, index) => {
      suggestedTitle = suggestedTitle.replace(
        word,
        `{{topic${index > 0 ? index : ""}}}`,
      );
    });
    setFormData((prev) => ({ ...prev, titleTemplate: suggestedTitle }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.titleTemplate) {
      message.error(t("scheduler.saveAsTemplate.fillRequired"));
      return;
    }

    setLoading(true);
    try {
      await taskTemplatesApi.createTemplate({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        title_template: formData.titleTemplate,
        description_template: formData.descriptionTemplate,
        estimated_duration: formData.estimatedDuration,
        tags: formData.tags,
        priority: formData.priority,
      });
      clearDraft();
      message.success(t("scheduler.saveAsTemplate.saveSuccess"));
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("scheduler.saveAsTemplate.saveFailed");
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-modal-overlay flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t("scheduler.saveAsTemplate.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("scheduler.saveAsTemplate.templateName")} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              type="text"
              aria-required={true}
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('scheduler.saveAsTemplate.namePlaceholder')}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("scheduler.saveAsTemplate.description")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={t('scheduler.saveAsTemplate.descriptionPlaceholder')}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("scheduler.saveAsTemplate.category")}
            </label>
            <div className="flex gap-2">
              {(["knowledge", "project", "analysis", "architecture", "topicResearch", "creative"] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, category: cat }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.category === cat
                        ? "bg-primary-600 text-white"
                        : isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {categoryIcons[cat]}
                    {categoryLabels[cat]}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("scheduler.saveAsTemplate.titleTemplate")} <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={suggestVariables}
                className="text-xs text-primary-500 hover:text-primary-600"
              >
                {t("scheduler.saveAsTemplate.autoExtractVariables")}
              </button>
            </div>
            <input
              type="text"
              aria-required={true}
              value={formData.titleTemplate}
              onChange={(e) => setFormData((prev) => ({ ...prev, titleTemplate: e.target.value }))}
              placeholder={t('scheduler.saveAsTemplate.titleTemplatePlaceholder')}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
              }`}
            />
            <p className="text-xs text-slate-400 mt-1">
              {t("scheduler.saveAsTemplate.variableHint", {
                variableSyntax: "{{variableName}}",
                example1: "{{topic}}",
                example2: "{{date}}",
              })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t("scheduler.saveAsTemplate.descriptionTemplate")}
            </label>
            <textarea
              value={formData.descriptionTemplate}
              onChange={(e) => setFormData((prev) => ({ ...prev, descriptionTemplate: e.target.value }))}
              placeholder={t('scheduler.saveAsTemplate.descriptionTemplatePlaceholder')}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Clock size={14} className="inline mr-1" />
                {t("scheduler.saveAsTemplate.estimatedDuration")}
              </label>
              <input
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, estimatedDuration: parseInt(e.target.value) || 25 }))
                }
                aria-label={t('scheduler.estimatedDuration')}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t("scheduler.saveAsTemplate.priority")}
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) }))}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
                }`}
              >
                <option value={1}>{t("scheduler.saveAsTemplate.priorityOptions.low")}</option>
                <option value={2}>{t("scheduler.saveAsTemplate.priorityOptions.medium")}</option>
                <option value={3}>{t("scheduler.saveAsTemplate.priorityOptions.high")}</option>
                <option value={4}>{t("scheduler.saveAsTemplate.priorityOptions.urgent")}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Tag size={14} className="inline mr-1" />
              {t("scheduler.saveAsTemplate.tags")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addTag())
                }
                placeholder={t('scheduler.saveAsTemplate.tagPlaceholder')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
                }`}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                {t("scheduler.saveAsTemplate.addTag")}
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                      isDark
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            className={`p-3 rounded-lg ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            <h5
              className={`text-xs font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {t("scheduler.saveAsTemplate.preview")}
            </h5>
            <p
              className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {formData.titleTemplate}
            </p>
            {formData.descriptionTemplate && (
              <p
                className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                {formData.descriptionTemplate}
              </p>
            )}
            {extractVariables(formData.titleTemplate).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {extractVariables(formData.titleTemplate).map((v) => (
                  <span
                    key={v}
                    className="px-2 py-0.5 bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded text-xs"
                  >
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-500">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-medium ${
              isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t("scheduler.saveAsTemplate.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save size={16} />
            )}
            {t("scheduler.saveAsTemplate.save")}
          </button>
        </div>
      </motion.div>
      {showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t("common.restoreDraftTitle")}
          message={t("common.restoreDraftMessage")}
          isDangerous={false}
        />
      )}
    </motion.div>
  );
};

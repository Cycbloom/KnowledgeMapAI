import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  BookOpen,
  Briefcase,
  Layers,
  Microscope,
  Sparkles,
  Clock,
  Tag,
  Copy,
  Check,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { SkeletonCard } from "../common";
import {
  taskTemplatesApi,
  TaskTemplate,
  applyTemplatePlaceholders,
  extractPlaceholders,
} from "../../services/api/taskTemplates";
import { message } from "../../utils/messageHelper";
import { useTheme } from "../../hooks";
import { useTemplateForm } from "../../hooks/templates/useTemplateForm";
import { useTemplateList } from "../../hooks/templates/useTemplateList";
import { useTemplateModals } from "../../hooks/templates/useTemplateModals";
import { asyncConfirm } from "@/utils/asyncConfirm";

const CATEGORIES = [
  "all",
  "knowledge",
  "project",
  "analysis",
  "architecture",
  "topicResearch",
  "creative",
] as const;
type Category = typeof CATEGORIES[number];
type TemplateCategory = Exclude<Category, "all">;

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  knowledge: <BookOpen size={20} />,
  project: <Briefcase size={20} />,
  analysis: <Search size={20} />,
  architecture: <Layers size={20} />,
  topicResearch: <Microscope size={20} />,
  creative: <Sparkles size={20} />,
};

interface TaskTemplatesProps {
  onSelectTemplate?: (template: TaskTemplate) => void;
}

export const TaskTemplates: React.FC<TaskTemplatesProps> = ({
  onSelectTemplate,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const {
    loading,
    searchQuery,
    selectedCategory,
    filteredTemplates,
    loadTemplates,
    setSearchQuery,
    setSelectedCategory,
  } = useTemplateList();

  const {
    formData,
    updateField,
    resetForm,
    setFormDataForEdit,
    addTag,
    removeTag,
    newTag,
    setNewTag,
  } = useTemplateForm();

  const {
    modalState,
    placeholderValues,
    openCreateModal,
    openEditModal,
    openApplyModal,
    closeAllModals,
    updatePlaceholderValue,
  } = useTemplateModals();

  const { isCreating, isEditing, isApplying, editingTemplate, applyingTemplate } = modalState;

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.title_template) {
      message.error(t("toast.templates.nameAndTitleRequired"));
      return;
    }

    try {
      await taskTemplatesApi.createTemplate({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        title_template: formData.title_template,
        description_template: formData.description_template,
        estimated_duration: formData.estimated_duration,
        tags: formData.tags,
        priority: formData.priority,
      });
      message.success(t("toast.templates.createSuccess"));
      closeAllModals();
      resetForm();
      loadTemplates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("toast.templates.createFailed");
      message.error(errorMessage);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      await taskTemplatesApi.updateTemplate(editingTemplate.id, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        title_template: formData.title_template,
        description_template: formData.description_template,
        estimated_duration: formData.estimated_duration,
        tags: formData.tags,
        priority: formData.priority,
      });
      message.success(t("toast.templates.updateSuccess"));
      closeAllModals();
      resetForm();
      loadTemplates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("toast.templates.updateFailed");
      message.error(errorMessage);
    }
  };

  const handleDeleteTemplate = async (template: TaskTemplate) => {
    if (template.is_system) {
      message.error(t("toast.templates.systemTemplateCannotDelete"));
      return;
    }

    if (!await asyncConfirm({ title: t("common.delete"), message: `${t("common.confirmButton")}${t("common.delete")} "${template.name}"?`, isDangerous: true })) return;

    try {
      await taskTemplatesApi.deleteTemplate(template.id);
      message.success(t("toast.templates.deleteSuccess"));
      loadTemplates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("toast.templates.deleteFailed");
      message.error(errorMessage);
    }
  };

  const handleDuplicateTemplate = async (template: TaskTemplate) => {
    try {
      await taskTemplatesApi.duplicateTemplate(
        template.id,
        `${template.name} (${t("templates.button.duplicate")})`,
      );
      message.success(t("toast.templates.duplicateSuccess"));
      loadTemplates();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("toast.templates.duplicateFailed");
      message.error(errorMessage);
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyingTemplate) return;

    try {
      await taskTemplatesApi.applyTemplate(applyingTemplate.id, {
        placeholders: placeholderValues,
      });
      message.success(t("toast.templates.applySuccess"));
      closeAllModals();
      if (onSelectTemplate) {
        onSelectTemplate(applyingTemplate);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("toast.templates.applyFailed");
      message.error(errorMessage);
    }
  };

  const handleOpenEditModal = (template: TaskTemplate) => {
    if (template.is_system) {
      message.error(t("toast.templates.systemTemplateCannotEdit"));
      return;
    }
    setFormDataForEdit({
      name: template.name,
      description: template.description || "",
      category: template.category as TemplateCategory,
      title_template: template.title_template,
      description_template: template.description_template || "",
      estimated_duration: template.estimated_duration,
      tags: template.tags || [],
      priority: template.priority,
    });
    openEditModal(template);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    openCreateModal();
  };

  const handleCloseModals = () => {
    closeAllModals();
    resetForm();
  };

  const getPreview = () => {
    if (!applyingTemplate) return { title: "", description: "" };
    return applyTemplatePlaceholders(applyingTemplate, placeholderValues);
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-6">
        <h2
          className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
        >
          {t("templates.taskTemplates")}
        </h2>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 rounded-xl flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white shadow-md transition-all font-medium text-sm"
        >
          <Plus size={18} />
          <span>{t("templates.createTemplate")}</span>
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder={t("templates.searchTaskPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all ${
              isDark
                ? "bg-slate-800 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                : "bg-white border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            }`}
          />
        </div>

        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl font-medium transition-all text-sm ${
                selectedCategory === cat
                  ? "bg-primary-600 text-white"
                  : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {cat === "all" ? t("templates.filter.all") : t(`templates.category.${cat}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title={t("templates.empty.noTemplates")}
          description={t("templates.empty.noTemplatesHint")}
          action={{ label: t("templates.createTemplate"), onClick: handleOpenCreateModal }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      template.category === "knowledge"
                        ? "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"
                        : template.category === "project"
                          ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                          : template.category === "analysis"
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                            : template.category === "architecture"
                              ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                              : template.category === "topicResearch"
                                ? "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
                                : template.category === "creative"
                                  ? "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400"
                                  : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                    }`}
                  >
                    {categoryIcons[template.category as TemplateCategory]}
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      {template.name}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {t(`templates.category.${template.category as TemplateCategory}`)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {template.is_system && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                      {t("templates.system")}
                    </span>
                  )}
                </div>
              </div>

              <p
                className={`text-sm mb-3 line-clamp-2 ${isDark ? "text-slate-400" : "text-gray-600"}`}
              >
                {template.description || template.title_template}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                {template.estimated_duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {t("templates.minutes", { count: template.estimated_duration })}
                  </span>
                )}
                {template.tags && template.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Tag size={12} />
                    {t("templates.tagsCount", { count: template.tags.length })}
                  </span>
                )}
                <span>{t("templates.usageCount", { count: template.usage_count })}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openApplyModal(template)}
                  className="flex-1 px-3 py-2 rounded-lg font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors text-sm"
                >
                  {t("templates.button.useTemplate")}
                </button>
                <button
                  onClick={() => handleDuplicateTemplate(template)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title={t("templates.button.duplicate")}
                >
                  <Copy size={16} className="text-gray-500" />
                </button>
                {!template.is_system && (
                  <>
                    <button
                      onClick={() => handleOpenEditModal(template)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title={t("templates.button.edit")}
                    >
                      <Pencil size={16} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t("templates.button.delete")}
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {(isCreating || isEditing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto ${
                isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
              }`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">
                  {isEditing ? t("templates.button.edit") : t("templates.createTemplate")}
                </h3>
                <button
                  onClick={handleCloseModals}
                  className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${
                    isDark
                      ? "hover:bg-white text-slate-400"
                      : "hover:bg-black text-gray-400"
                  }`}
                >
                  <X size={24} />
                </button>
              </div>

              <form
                onSubmit={isEditing ? handleUpdateTemplate : handleCreateTemplate}
                className="space-y-4"
              >
                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("templates.form.name")} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder={t("templates.form.namePlaceholder")}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("templates.form.description")}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder={t("templates.form.descriptionPlaceholder")}
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 resize-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      {t("templates.form.category")}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => updateField("category", e.target.value as TemplateCategory)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                      }`}
                    >
                      {(["knowledge", "project", "analysis", "architecture", "topicResearch", "creative"] as const).map((value) => (
                        <option key={value} value={value}>
                          {t(`templates.category.${value}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      {t("templates.form.estimatedDuration")}
                    </label>
                    <input
                      type="number"
                      value={formData.estimated_duration}
                      onChange={(e) =>
                        updateField("estimated_duration", parseInt(e.target.value) || 25)
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("templates.form.titleTemplate")} *{" "}
                    <span className="text-xs text-gray-400">
                      ({t("templates.form.titleTemplateHint")})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.title_template}
                    onChange={(e) => updateField("title_template", e.target.value)}
                    placeholder={t("templates.form.titleTemplatePlaceholder")}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("templates.form.descriptionTemplate")}
                  </label>
                  <textarea
                    value={formData.description_template}
                    onChange={(e) => updateField("description_template", e.target.value)}
                    placeholder={t("templates.form.descriptionTemplatePlaceholder")}
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 resize-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("templates.form.tags")}
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addTag())
                      }
                      placeholder={t("templates.form.tagsPlaceholder")}
                      className={`flex-1 px-4 py-2 rounded-xl border outline-none transition-all ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                    >
                      {t("templates.button.add")}
                    </button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                            isDark
                              ? "bg-slate-700 text-slate-300"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModals}
                    className={`px-4 py-2 rounded-xl font-medium ${
                      isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {t("templates.button.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
                  >
                    {isEditing ? t("templates.button.update") : t("templates.button.create")}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isApplying && applyingTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg rounded-2xl shadow-2xl p-6 ${
                isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
              }`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">
                  {t("templates.button.useTemplate")}: {applyingTemplate.name}
                </h3>
                <button
                  onClick={handleCloseModals}
                  className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${
                    isDark
                      ? "hover:bg-white text-slate-400"
                      : "hover:bg-black text-gray-400"
                  }`}
                >
                  <X size={24} />
                </button>
              </div>

              {extractPlaceholders(applyingTemplate).length > 0 && (
                <div className="mb-6">
                  <h4
                    className={`text-sm font-medium mb-3 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("templates.fillVariables")}
                  </h4>
                  <div className="space-y-3">
                    {extractPlaceholders(applyingTemplate).map(
                      (placeholder: string) => (
                        <div key={placeholder}>
                          <label
                            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                          >
                            {placeholder}
                          </label>
                          <input
                            type="text"
                            value={placeholderValues[placeholder] || ""}
                            onChange={(e) =>
                              updatePlaceholderValue(placeholder, e.target.value)
                            }
                            placeholder={t("templates.input", { name: placeholder })}
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                              isDark
                                ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                                : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500"
                            }`}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              <div
                className={`p-4 rounded-xl mb-6 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
              >
                <h4
                  className={`text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {t("templates.preview.title")}
                </h4>
                <p
                  className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {getPreview().title}
                </p>
                {getPreview().description && (
                  <p
                    className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-600"}`}
                  >
                    {getPreview().description}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {t("templates.minutes", { count: applyingTemplate.estimated_duration })}
                  </span>
                  <span>{t("templates.priority")}: {applyingTemplate.priority}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseModals}
                  className={`px-4 py-2 rounded-xl font-medium ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t("templates.button.cancel")}
                </button>
                <button
                  onClick={handleApplyTemplate}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  {t("templates.button.createTask")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTemplates } from "../hooks/queries";
import {
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} from "../hooks/mutations";
import { Template, TemplateCategory } from "../types";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  GraduationCap,
  Briefcase,
  Layers,
  Network,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { useTheme } from "../hooks";
import { TaskTemplates } from "../components/Templates/TaskTemplates";

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  knowledge: <GraduationCap size={20} />,
  project: <Briefcase size={20} />,
  analysis: <Search size={20} />,
  architecture: <Layers size={20} />,
  creative: <Sparkles size={20} />,
};

type TemplateTab = "knowledge" | "task";

export const Templates = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplateMutation = useCreateTemplateMutation();
  const updateTemplateMutation = useUpdateTemplateMutation();
  const deleteTemplateMutation = useDeleteTemplateMutation();

  const [activeTab, setActiveTab] = useState<TemplateTab>("knowledge");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | "all"
  >("all");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] =
    useState<TemplateCategory>("knowledge");

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description &&
        t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === "all" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName) return;

    try {
      await createTemplateMutation.mutateAsync({
        name: newTemplateName,
        description: newTemplateDescription,
        category: newTemplateCategory,
        nodes: [
          {
            id: "node-1",
            title: t("templates.node.root"),
            level: "root",
          },
          {
            id: "node-2",
            title: t("templates.node.sub"),
            level: "core",
            parentId: "node-1",
          },
        ],
        edges: [{ source: "node-1", target: "node-2" }],
      });
      setNewTemplateName("");
      setNewTemplateDescription("");
      setIsCreating(false);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("templates.message.createSuccess"),
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("templates.message.createFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (template.is_system) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("templates.message.systemTemplateCannotDelete"),
      });
      return;
    }

    if (
      !confirm(
        `${t("common.confirm")}${t("common.delete")} "${template.name}"?`,
      )
    )
      return;

    try {
      await deleteTemplateMutation.mutateAsync(template.id);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("templates.message.deleteSuccess"),
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("templates.message.deleteFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleEditTemplate = (template: Template) => {
    if (template.is_system) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("templates.message.systemTemplateCannotEdit"),
      });
      return;
    }
    setEditingTemplate(template);
    setIsEditing(true);
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      await updateTemplateMutation.mutateAsync({
        id: editingTemplate.id,
        data: {
          name: newTemplateName,
          description: newTemplateDescription,
          category: newTemplateCategory,
          nodes: editingTemplate.nodes,
          edges: editingTemplate.edges,
          layout: editingTemplate.layout,
        },
      });
      setEditingTemplate(null);
      setIsEditing(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("templates.message.updateSuccess"),
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("templates.message.updateFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleUseTemplate = (template: Template) => {
    navigate("/dashboard", { state: { templateId: template.id } });
  };

  return (
    <div
      className={`h-full overflow-y-auto ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1
            className={`text-3xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {t("templates.title")}
          </h1>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("knowledge")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === "knowledge"
                ? "bg-primary-600 text-white shadow-md"
                : isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Network size={18} />
            <span>{t("templates.knowledgeTemplates")}</span>
          </button>
          <button
            onClick={() => setActiveTab("task")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === "task"
                ? "bg-primary-600 text-white shadow-md"
                : isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            <CheckSquare size={18} />
            <span>{t("templates.taskTemplates")}</span>
          </button>
        </div>

        {activeTab === "task" ? (
          <TaskTemplates />
        ) : (
          <>
            <div className="flex items-center justify-end mb-6">
              <button
                onClick={() => {
                  setNewTemplateName("");
                  setNewTemplateDescription("");
                  setNewTemplateCategory("knowledge");
                  setIsCreating(true);
                }}
                className="px-5 py-2.5 rounded-xl flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg transition-all font-medium"
              >
                <Plus size={20} />
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
                  placeholder={t("templates.searchPlaceholder")}
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
                {(
                  [
                    "all",
                    "knowledge",
                    "project",
                    "analysis",
                    "architecture",
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
                      selectedCategory === cat
                        ? "bg-primary-600 text-white"
                        : isDark
                          ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {cat === "all"
                      ? t("templates.filter.all")
                      : t(`templates.category.${cat}`)}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <p className="text-lg mb-2">
                  {t("templates.empty.noTemplates")}
                </p>
                <p className="text-sm">
                  {t("templates.empty.noTemplatesHint")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template: Template) => (
                  <div
                    key={template.id}
                    className={`rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${
                      isDark
                        ? "bg-slate-800 border-slate-700"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl ${
                            template.category === "knowledge"
                              ? "bg-primary-50 text-primary-600"
                              : template.category === "project"
                                ? "bg-green-50 text-green-600"
                                : template.category === "analysis"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-primary-50 text-primary-600"
                          }`}
                        >
                          {categoryIcons[template.category as TemplateCategory]}
                        </div>
                        <div>
                          <h3
                            className={`font-bold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {template.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {t(
                              `templates.category.${template.category as TemplateCategory}`,
                            )}
                            {t("templates.template")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!template.is_system && (
                          <>
                            <button
                              onClick={() => handleEditTemplate(template)}
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
                        {template.is_system && (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            {t("templates.system")}
                          </span>
                        )}
                      </div>
                    </div>

                    <p
                      className={`text-sm mb-4 line-clamp-2 ${
                        isDark ? "text-slate-300" : "text-gray-600"
                      }`}
                    >
                      {template.description || t("common.noData")}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>
                        {t("templates.nodeCount", {
                          count: template.nodes?.length ?? 0,
                        })}
                      </span>
                      {template.layout && (
                        <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700">
                          {template.layout.type}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="w-full px-4 py-2.5 rounded-xl font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                    >
                      {t("templates.button.use")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 ${
              isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {t("templates.createTemplate")}
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${
                  isDark
                    ? "hover:bg-white text-slate-400"
                    : "hover:bg-black text-gray-400"
                }`}
              >
                <X size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-5">
              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.form.name")}
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={t("templates.form.namePlaceholder")}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.form.descriptionOptional")}
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder={t("templates.form.descriptionPlaceholder")}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.form.category")}
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) =>
                    setNewTemplateCategory(e.target.value as TemplateCategory)
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                >
                  <option value="knowledge">
                    {t("templates.category.knowledge")}
                  </option>
                  <option value="project">
                    {t("templates.category.project")}
                  </option>
                  <option value="analysis">
                    {t("templates.category.analysis")}
                  </option>
                  <option value="architecture">
                    {t("templates.category.architecture")}
                  </option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t("templates.button.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={
                    createTemplateMutation.isPending || !newTemplateName
                  }
                >
                  {createTemplateMutation.isPending
                    ? `${t("common.generating")}`
                    : t("templates.button.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditing && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 ${
              isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {t("templates.button.edit")}
              </h3>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingTemplate(null);
                }}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${
                  isDark
                    ? "hover:bg-white text-slate-400"
                    : "hover:bg-black text-gray-400"
                }`}
              >
                <X size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleUpdateTemplate} className="space-y-5">
              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.form.name")}
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={editingTemplate.name}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.form.descriptionOptional")}
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder={
                    editingTemplate.description ||
                    t("templates.form.descriptionPlaceholder")
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <label
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.form.category")}
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) =>
                    setNewTemplateCategory(e.target.value as TemplateCategory)
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }`}
                >
                  <option value="knowledge">
                    {t("templates.category.knowledge")}
                  </option>
                  <option value="project">
                    {t("templates.category.project")}
                  </option>
                  <option value="analysis">
                    {t("templates.category.analysis")}
                  </option>
                  <option value="architecture">
                    {t("templates.category.architecture")}
                  </option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingTemplate(null);
                  }}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t("templates.button.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={
                    updateTemplateMutation.isPending || !newTemplateName
                  }
                >
                  {updateTemplateMutation.isPending
                    ? `${t("common.generating")}`
                    : t("templates.button.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

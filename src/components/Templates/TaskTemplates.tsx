import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  BookOpen,
  Briefcase,
  Home,
  Heart,
  Star,
  Clock,
  Tag,
  Copy,
  Check,
} from "lucide-react";
import {
  templateApi,
  TaskTemplate,
  extractPlaceholders,
  applyTemplatePlaceholders,
} from "../../services/api/template";
import { useMessageStore } from "../../store/useMessageStore";
import { useTheme } from "../../hooks/useTheme";

const categoryIcons: Record<string, React.ReactNode> = {
  study: <BookOpen size={20} />,
  work: <Briefcase size={20} />,
  life: <Home size={20} />,
  health: <Heart size={20} />,
  custom: <Star size={20} />,
};

const categoryLabels: Record<string, string> = {
  study: "学习",
  work: "工作",
  life: "生活",
  health: "健康",
  custom: "自定义",
};

interface TaskTemplatesProps {
  onSelectTemplate?: (template: TaskTemplate) => void;
}

export const TaskTemplates: React.FC<TaskTemplatesProps> = ({
  onSelectTemplate,
}) => {
  const { isDark } = useTheme();
  const { addMessage } = useMessageStore();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(
    null,
  );
  const [isApplying, setIsApplying] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<TaskTemplate | null>(
    null,
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "study" as string,
    title_template: "",
    description_template: "",
    estimated_duration: 25,
    tags: [] as string[],
    priority: 2,
  });

  const [placeholderValues, setPlaceholderValues] = useState<
    Record<string, string>
  >({});
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await templateApi.getTemplates();
      if (response.success) {
        setTemplates(response.data || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

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
    if (!formData.name || !formData.title_template) {
      addMessage({ type: "error", content: "请填写模板名称和标题模板" });
      return;
    }

    try {
      await templateApi.createTemplate({
        name: formData.name,
        description: formData.description,
        category: formData.category as any,
        title_template: formData.title_template,
        description_template: formData.description_template,
        estimated_duration: formData.estimated_duration,
        tags: formData.tags,
        priority: formData.priority,
      });
      addMessage({ type: "success", content: "模板创建成功!" });
      setIsCreating(false);
      resetForm();
      loadTemplates();
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "创建模板失败" });
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      await templateApi.updateTemplate(editingTemplate.id, {
        name: formData.name,
        description: formData.description,
        category: formData.category as any,
        title_template: formData.title_template,
        description_template: formData.description_template,
        estimated_duration: formData.estimated_duration,
        tags: formData.tags,
        priority: formData.priority,
      });
      addMessage({ type: "success", content: "模板更新成功!" });
      setIsEditing(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "更新模板失败" });
    }
  };

  const handleDeleteTemplate = async (template: TaskTemplate) => {
    if (template.is_system) {
      addMessage({ type: "error", content: "系统预设模板不能删除" });
      return;
    }

    if (!confirm(`确定要删除模板 "${template.name}" 吗？`)) return;

    try {
      await templateApi.deleteTemplate(template.id);
      addMessage({ type: "success", content: "模板已删除" });
      loadTemplates();
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "删除模板失败" });
    }
  };

  const handleDuplicateTemplate = async (template: TaskTemplate) => {
    try {
      await templateApi.duplicateTemplate(
        template.id,
        `${template.name} (副本)`,
      );
      addMessage({ type: "success", content: "模板已复制" });
      loadTemplates();
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "复制模板失败" });
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyingTemplate) return;

    try {
      await templateApi.applyTemplate(applyingTemplate.id, {
        placeholders: placeholderValues,
      });
      addMessage({ type: "success", content: "任务已创建!" });
      setIsApplying(false);
      setApplyingTemplate(null);
      setPlaceholderValues({});
      if (onSelectTemplate) {
        onSelectTemplate(applyingTemplate);
      }
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "应用模板失败" });
    }
  };

  const openApplyModal = (template: TaskTemplate) => {
    setApplyingTemplate(template);
    const placeholders = extractPlaceholders(template);
    const initialValues: Record<string, string> = {};
    placeholders.forEach((p: string) => {
      initialValues[p] = "";
    });
    setPlaceholderValues(initialValues);
    setIsApplying(true);
  };

  const openEditModal = (template: TaskTemplate) => {
    if (template.is_system) {
      addMessage({ type: "error", content: "系统预设模板不能编辑" });
      return;
    }
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category,
      title_template: template.title_template,
      description_template: template.description_template || "",
      estimated_duration: template.estimated_duration,
      tags: template.tags || [],
      priority: template.priority,
    });
    setIsEditing(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "study",
      title_template: "",
      description_template: "",
      estimated_duration: 25,
      tags: [],
      priority: 2,
    });
    setNewTag("");
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
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
          任务模板
        </h2>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="px-4 py-2 rounded-xl flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all font-medium text-sm"
        >
          <Plus size={18} />
          <span>新建模板</span>
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
            placeholder="搜索任务模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all ${
              isDark
                ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                : "bg-white border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            }`}
          />
        </div>

        <div className="flex gap-2">
          {["all", "study", "work", "life", "health", "custom"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl font-medium transition-all text-sm ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white"
                  : isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {cat === "all" ? "全部" : categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <p className="text-lg mb-2">未找到匹配的模板</p>
          <p className="text-sm">尝试更换搜索关键词或分类</p>
        </div>
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
                      template.category === "study"
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                        : template.category === "work"
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
                          : template.category === "life"
                            ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                            : template.category === "health"
                              ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                              : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                    }`}
                  >
                    {categoryIcons[template.category]}
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      {template.name}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {categoryLabels[template.category]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {template.is_system && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                      系统
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
                    {template.estimated_duration}分钟
                  </span>
                )}
                {template.tags && template.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Tag size={12} />
                    {template.tags.length}个标签
                  </span>
                )}
                <span>使用 {template.usage_count} 次</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openApplyModal(template)}
                  className="flex-1 px-3 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm"
                >
                  使用模板
                </button>
                <button
                  onClick={() => handleDuplicateTemplate(template)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="复制"
                >
                  <Copy size={16} className="text-gray-500" />
                </button>
                {!template.is_system && (
                  <>
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Pencil size={16} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="删除"
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

      {/* Create/Edit Modal */}
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
                  {isEditing ? "编辑模板" : "创建任务模板"}
                </h3>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
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
                onSubmit={
                  isEditing ? handleUpdateTemplate : handleCreateTemplate
                }
                className="space-y-4"
              >
                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    模板名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="例如：每日学习"
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="模板描述..."
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 resize-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      分类
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                      }`}
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      预计时长（分钟）
                    </label>
                    <input
                      type="number"
                      value={formData.estimated_duration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          estimated_duration: parseInt(e.target.value) || 25,
                        })
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    标题模板 *{" "}
                    <span className="text-xs text-gray-400">
                      (支持 {"{{topic}}"} 等变量)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.title_template}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        title_template: e.target.value,
                      })
                    }
                    placeholder="例如：学习：{{topic}}"
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    描述模板
                  </label>
                  <textarea
                    value={formData.description_template}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description_template: e.target.value,
                      })
                    }
                    placeholder="例如：深入学习 {{topic}}，理解核心概念..."
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 resize-none ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                        : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    标签
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addTag())
                      }
                      placeholder="添加标签"
                      className={`flex-1 px-4 py-2 rounded-xl border outline-none transition-all ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                          : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      添加
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
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                      setEditingTemplate(null);
                      resetForm();
                    }}
                    className={`px-4 py-2 rounded-xl font-medium ${
                      isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                  >
                    {isEditing ? "更新" : "创建"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply Template Modal */}
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
                  使用模板：{applyingTemplate.name}
                </h3>
                <button
                  onClick={() => {
                    setIsApplying(false);
                    setApplyingTemplate(null);
                    setPlaceholderValues({});
                  }}
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
                    填写变量
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
                              setPlaceholderValues({
                                ...placeholderValues,
                                [placeholder]: e.target.value,
                              })
                            }
                            placeholder={`输入 ${placeholder}`}
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all mt-1 ${
                              isDark
                                ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500"
                                : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
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
                  预览
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
                    {applyingTemplate.estimated_duration}分钟
                  </span>
                  <span>优先级: {applyingTemplate.priority}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsApplying(false);
                    setApplyingTemplate(null);
                    setPlaceholderValues({});
                  }}
                  className={`px-4 py-2 rounded-xl font-medium ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleApplyTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  创建任务
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

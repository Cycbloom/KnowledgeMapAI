import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  Home,
  Heart,
  Star,
  Search,
  X,
  Clock,
  Check,
  Tag,
  Loader2,
  Plus,
  FileQuestion,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  taskTemplatesApi,
  TaskTemplate,
  TemplateCategory,
  extractPlaceholders,
  applyTemplatePlaceholders,
  getCategoryBgClass,
  getCategoryTextClass,
} from "../../services/api/taskTemplates";
import { useTheme } from "../../hooks";
import { EmptyState } from "../common/EmptyState";

const categoryIcons: Record<string, React.ReactNode> = {
  study: <BookOpen size={16} />,
  work: <Briefcase size={16} />,
  life: <Home size={16} />,
  health: <Heart size={16} />,
  custom: <Star size={16} />,
};

const categoryLabels: Record<string, string> = {
  study: "学习",
  work: "工作",
  life: "生活",
  health: "健康",
  custom: "自定义",
};

interface TemplateSelectorProps {
  onSelect: (data: {
    title: string;
    description?: string;
    estimated_duration: number;
    tags: string[];
    priority: number;
  }) => void;
  onClose: () => void;
  onCreateNew?: () => void;
  showGrouped?: boolean;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  onClose,
  onCreateNew,
  showGrouped = false,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(
    null,
  );
  const [placeholderValues, setPlaceholderValues] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await taskTemplatesApi.getTemplates();
      if (response.success) {
        setTemplates(response.data || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await taskTemplatesApi.getCategories();
      if (response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description &&
          t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === "all" || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const groupedTemplates = useMemo(() => {
    if (!showGrouped) return {};
    return filteredTemplates.reduce((acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    }, {} as Record<string, TaskTemplate[]>);
  }, [filteredTemplates, showGrouped]);

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    const placeholders = extractPlaceholders(template);
    const initialValues: Record<string, string> = {};
    placeholders.forEach((p: string) => {
      initialValues[p] = "";
    });
    setPlaceholderValues(initialValues);
  };

  const handleApply = () => {
    if (!selectedTemplate) return;

    const { title, description } = applyTemplatePlaceholders(
      selectedTemplate,
      placeholderValues,
    );
    onSelect({
      title,
      description,
      estimated_duration: selectedTemplate.estimated_duration,
      tags: selectedTemplate.tags || [],
      priority: selectedTemplate.priority,
    });
    onClose();
  };

  const getPreview = () => {
    if (!selectedTemplate) return { title: "", description: "" };
    return applyTemplatePlaceholders(selectedTemplate, placeholderValues);
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
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            从模板创建任务
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* 左侧：模板列表 */}
          <div
            className={`w-1/2 border-r ${isDark ? "border-slate-700" : "border-slate-200"}`}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-500">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="搜索模板..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-primary-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 focus:border-primary-500"
                    }`}
                  />
                </div>
                {onCreateNew && (
                  <button
                    onClick={onCreateNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-400 hover:to-primary-500 transition-all"
                  >
                    <Plus size={16} />
                    新建
                  </button>
                )}
              </div>
              <div className="flex gap-1 mt-2 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === "all"
                      ? "bg-primary-600 text-white"
                      : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  全部
                </button>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat.value
                          ? `${getCategoryBgClass(cat.value)} ${getCategoryTextClass(cat.value)}`
                          : isDark
                            ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))
                ) : (
                  ["study", "work", "life", "health", "custom"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? "bg-primary-600 text-white"
                          : isDark
                            ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {categoryLabels[cat]}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="overflow-y-auto h-[calc(100%-100px)]">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-primary-500" size={24} />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <EmptyState
                  icon={<FileQuestion className="w-12 h-12 text-gray-400" />}
                  title={t('scheduler.templateSelector.empty')}
                />
              ) : showGrouped ? (
                <div className="p-2 space-y-4">
                  {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                    <div key={category}>
                      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                        <span>{categoryIcons[category]}</span>
                        {categoryLabels[category] || category}
                        <span className="text-slate-400 dark:text-slate-500">
                          ({categoryTemplates.length})
                        </span>
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {categoryTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              selectedTemplate?.id === template.id
                                ? "bg-primary-100 dark:bg-primary-500/20 border border-primary-300 dark:border-primary-500/50"
                                : isDark
                                  ? "hover:bg-slate-700"
                                  : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`p-1 rounded ${
                                  template.category === "study"
                                    ? "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"
                                    : template.category === "work"
                                      ? "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"
                                      : template.category === "life"
                                        ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                                        : template.category === "health"
                                          ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                                          : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                }`}
                              >
                                {categoryIcons[template.category]}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`font-medium truncate text-sm ${isDark ? "text-white" : "text-slate-900"}`}
                                >
                                  {template.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {template.title_template}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                {template.estimated_duration && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {template.estimated_duration}m
                                  </span>
                                )}
                                {template.tags && template.tags.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Tag size={12} />
                                    {template.tags.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedTemplate?.id === template.id
                          ? "bg-primary-100 dark:bg-primary-500/20 border border-primary-300 dark:border-primary-500/50"
                          : isDark
                            ? "hover:bg-slate-700"
                            : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`p-1 rounded ${
                            template.category === "study"
                              ? "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"
                              : template.category === "work"
                                ? "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400"
                                : template.category === "life"
                                  ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                                  : template.category === "health"
                                    ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                                    : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                          }`}
                        >
                          {categoryIcons[template.category]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}
                          >
                            {template.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {template.title_template}
                          </p>
                        </div>
                        {template.estimated_duration && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock size={12} />
                            {template.estimated_duration}m
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：模板详情和变量填充 */}
          <div
            className={`w-1/2 flex flex-col ${isDark ? "bg-slate-900" : "bg-slate-50"}`}
          >
            {selectedTemplate ? (
              <>
                <div className="p-4 flex-1 overflow-y-auto">
                  <h4
                    className={`font-semibold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}
                  >
                    {selectedTemplate.name}
                  </h4>
                  <p
                    className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                  >
                    {selectedTemplate.description}
                  </p>

                  {extractPlaceholders(selectedTemplate).length > 0 && (
                    <div className="mb-4">
                      <h5
                        className={`text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
                      >
                        填写变量
                      </h5>
                      <div className="space-y-2">
                        {extractPlaceholders(selectedTemplate).map(
                          (placeholder: string) => (
                            <div key={placeholder}>
                              <label
                                className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}
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
                                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                                  isDark
                                    ? "bg-slate-800 border-slate-700 text-white focus:border-primary-500"
                                    : "bg-white border-slate-200 text-slate-900 focus:border-primary-500"
                                }`}
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-lg ${isDark ? "bg-slate-800" : "bg-white"}`}
                  >
                    <h5
                      className={`text-xs font-medium mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      预览
                    </h5>
                    <p
                      className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      {getPreview().title}
                    </p>
                    {getPreview().description && (
                      <p
                        className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
                      >
                        {getPreview().description}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {selectedTemplate.estimated_duration}分钟
                      </span>
                      <span>优先级: {selectedTemplate.priority}</span>
                      {selectedTemplate.tags &&
                        selectedTemplate.tags.length > 0 && (
                          <span>标签: {selectedTemplate.tags.join(", ")}</span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-500">
                  <button
                    onClick={handleApply}
                    className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    使用此模板
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <p>选择一个模板查看详情</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useTemplates,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} from "../hooks/useQueries";
import { Template, TemplateCategory } from "../types";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  BookOpen,
  FileText,
  Briefcase,
  PieChart,
  Sparkles,
} from "lucide-react";
import { useMessageStore } from "../store/useMessageStore";
import { useTheme } from "../hooks/useTheme";

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  learning: <BookOpen size={20} />,
  story: <FileText size={20} />,
  project: <Briefcase size={20} />,
  analysis: <PieChart size={20} />,
  custom: <Sparkles size={20} />,
};

const categoryLabels: Record<TemplateCategory, string> = {
  learning: "学习",
  story: "故事",
  project: "项目",
  analysis: "分析",
  custom: "自定义",
};

export const Templates = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplateMutation = useCreateTemplateMutation();
  const updateTemplateMutation = useUpdateTemplateMutation();
  const deleteTemplateMutation = useDeleteTemplateMutation();
  const { addMessage } = useMessageStore();

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
    useState<TemplateCategory>("learning");

  const filteredTemplates = templates.filter((t: Template) => {
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
            title: "主题",
            level: "root",
          },
          {
            id: "node-2",
            title: "子主题",
            level: "core",
            parentId: "node-1",
          },
        ],
        edges: [{ source: "node-1", target: "node-2" }],
      });
      setNewTemplateName("");
      setNewTemplateDescription("");
      setIsCreating(false);
      addMessage({ type: "success", content: "模板创建成功!" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "创建模板失败" });
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (template.is_system) {
      addMessage({ type: "error", content: "系统预设模板不能删除" });
      return;
    }

    if (!confirm(`确定要删除模板 "${template.name}" 吗？`)) return;

    try {
      await deleteTemplateMutation.mutateAsync(template.id);
      addMessage({ type: "success", content: "模板已删除" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "删除模板失败" });
    }
  };

  const handleEditTemplate = (template: Template) => {
    if (template.is_system) {
      addMessage({ type: "error", content: "系统预设模板不能编辑" });
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
      addMessage({ type: "success", content: "模板更新成功!" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "更新模板失败" });
    }
  };

  const handleUseTemplate = (template: Template) => {
    navigate("/dashboard", { state: { templateId: template.id } });
  };

  return (
    <div className={`h-full overflow-y-auto ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1
            className={`text-3xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            模板管理
          </h1>
          <button
            onClick={() => {
              setNewTemplateName("");
              setNewTemplateDescription("");
              setNewTemplateCategory("learning");
              setIsCreating(true);
            }}
            className="px-5 py-2.5 rounded-xl flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-medium"
          >
            <Plus size={20} />
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
              placeholder="搜索模板..."
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
            {(
              [
                "all",
                "learning",
                "story",
                "project",
                "analysis",
                "custom",
              ] as const
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-xl font-medium transition-all ${
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <p className="text-lg mb-2">未找到匹配的模板</p>
            <p className="text-sm">尝试更换搜索关键词或分类</p>
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
                        template.category === "learning"
                          ? "bg-blue-50 text-blue-600"
                          : template.category === "story"
                          ? "bg-purple-50 text-purple-600"
                          : template.category === "project"
                          ? "bg-green-50 text-green-600"
                          : template.category === "analysis"
                          ? "bg-orange-50 text-orange-600"
                          : "bg-pink-50 text-pink-600"
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
                        {categoryLabels[template.category as TemplateCategory]}
                        模板
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!template.is_system && (
                      <>
                        <button
                          onClick={() => handleEditTemplate(template)}
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
                    {template.is_system && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        系统预设
                      </span>
                    )}
                  </div>
                </div>

                <p
                  className={`text-sm mb-4 line-clamp-2 ${
                    isDark ? "text-slate-300" : "text-gray-600"
                  }`}
                >
                  {template.description || "暂无描述"}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>{template.nodes?.length ?? 0} 个节点</span>
                  {template.layout && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700">
                      {template.layout.type}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleUseTemplate(template)}
                  className="w-full px-4 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  使用此模板
                </button>
              </div>
            ))}
          </div>
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
              <h3 className="text-xl font-bold">创建新模板</h3>
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
                  模板名称
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="例如：我的学习模板"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  描述（可选）
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="简要描述该模板的用途..."
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  分类
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) =>
                    setNewTemplateCategory(e.target.value as TemplateCategory)
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                >
                  <option value="learning">学习</option>
                  <option value="story">故事</option>
                  <option value="project">项目</option>
                  <option value="analysis">分析</option>
                  <option value="custom">自定义</option>
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
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={
                    createTemplateMutation.isPending || !newTemplateName
                  }
                >
                  {createTemplateMutation.isPending ? "创建中..." : "立即创建"}
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
              <h3 className="text-xl font-bold">编辑模板</h3>
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
                  模板名称
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={editingTemplate.name}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  描述（可选）
                </label>
                <textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder={
                    editingTemplate.description || "简要描述该模板的用途..."
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  分类
                </label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) =>
                    setNewTemplateCategory(e.target.value as TemplateCategory)
                  }
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  }`}
                >
                  <option value="learning">学习</option>
                  <option value="story">故事</option>
                  <option value="project">项目</option>
                  <option value="analysis">分析</option>
                  <option value="custom">自定义</option>
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
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={
                    updateTemplateMutation.isPending || !newTemplateName
                  }
                >
                  {updateTemplateMutation.isPending ? "更新中..." : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

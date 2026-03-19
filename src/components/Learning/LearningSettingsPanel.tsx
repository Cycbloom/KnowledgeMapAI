import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Type,
  BookOpen,
  RefreshCcw,
  Sun,
  Eye,
  Moon,
  Scroll,
  FileText,
  Settings,
  Zap,
  Edit,
  Globe,
  User,
  Network,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { useLearningSettingsStore } from "../../store/useLearningSettingsStore";
import { PromptEditor } from "../GraphEditor/panels/PromptEditor";
import {
  PROMPT_SCENARIOS,
  getScenarioById,
  type PromptScenario,
} from "../PromptConfig/promptScenarios";
import { useStore } from "../../store/useStore";
import { useMessageStore } from "../../store/useMessageStore";
import { api } from "../../services/api";

interface PromptTemplate {
  id: string;
  code: string;
  scope: "system" | "user" | "graph";
  user_id?: string;
  graph_id?: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

type TemplateScope = "system" | "user" | "graph";

interface LearningSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialScenarioId?: string;
  graphId?: string;
}

type ActiveTab = "reading" | "prompt";

export const LearningSettingsPanel: React.FC<LearningSettingsPanelProps> = ({
  isOpen,
  onClose,
  initialScenarioId,
  graphId,
}) => {
  const {
    fontSize,
    readingMode,
    paginationMode,
    setFontSize,
    setReadingMode,
    setPaginationMode,
    resetSettings,
  } = useLearningSettingsStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("reading");

  const { token } = useStore();
  const { addMessage } = useMessageStore();

  const [selectedScenario, setSelectedScenario] =
    useState<PromptScenario | null>(null);
  const [editingScope, setEditingScope] = useState<TemplateScope | null>(null);
  const [editedTemplate, setEditedTemplate] = useState("");
  const [templates, setTemplates] = useState<{
    system: PromptTemplate[];
    user: PromptTemplate[];
    graph: PromptTemplate[];
  }>({ system: [], user: [], graph: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [showScopeInfo, setShowScopeInfo] = useState(false);

  useEffect(() => {
    if (initialScenarioId) {
      const scenario = getScenarioById(initialScenarioId);
      if (scenario) {
        setSelectedScenario(scenario);
      }
    }
  }, [initialScenarioId]);

  useEffect(() => {
    if (isOpen && token) {
      loadTemplates();
    }
  }, [isOpen, token, graphId]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await api.prompts.list(graphId);
      setTemplates(
        result as {
          system: PromptTemplate[];
          user: PromptTemplate[];
          graph: PromptTemplate[];
        },
      );
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTemplateContent = (code: string, scope: TemplateScope): string => {
    const templateList = templates[scope];
    const template = templateList.find((t) => t.code === code);
    return template?.template_content || "";
  };

  const getEffectiveTemplate = (
    code: string,
  ): { content: string; scope: TemplateScope } => {
    if (graphId) {
      const graphTemplate = getTemplateContent(code, "graph");
      if (graphTemplate) {
        return { content: graphTemplate, scope: "graph" };
      }
    }
    const userTemplate = getTemplateContent(code, "user");
    if (userTemplate) {
      return { content: userTemplate, scope: "user" };
    }
    const scenario = PROMPT_SCENARIOS.find((s) => s.id === code);
    return { content: scenario?.defaultTemplate || "", scope: "system" };
  };

  useEffect(() => {
    if (selectedScenario && !editingScope) {
      const { content } = getEffectiveTemplate(selectedScenario.id);
      setEditedTemplate(content);
    }
  }, [selectedScenario, templates, editingScope]);

  const handleStartEdit = (scope: TemplateScope) => {
    if (!selectedScenario) return;
    const content = getTemplateContent(selectedScenario.id, scope);
    setEditedTemplate(content || selectedScenario.defaultTemplate);
    setEditingScope(scope);
  };

  const handleSave = async (content: string) => {
    if (!selectedScenario || !editingScope) return;

    try {
      if (editingScope === "system") {
        addMessage({ type: "error", content: "系统级模板不可修改" });
        return;
      }

      await api.prompts.save({
        code: selectedScenario.id,
        scope: editingScope,
        template_content: content,
        graph_id: editingScope === "graph" ? graphId : undefined,
      });

      addMessage({ type: "success", content: "Prompt配置已保存" });
      setEditingScope(null);
      await loadTemplates();
    } catch (error) {
      console.error("Failed to save prompt config:", error);
      addMessage({ type: "error", content: "保存失败" });
    }
  };

  const handleCancel = () => {
    setEditingScope(null);
  };

  const handleResetToDefault = () => {
    if (!selectedScenario) return;
    setEditedTemplate(selectedScenario.defaultTemplate);
  };

  const handleDeleteTemplate = async (scope: TemplateScope) => {
    if (!selectedScenario) return;

    const template = templates[scope].find(
      (t) => t.code === selectedScenario.id,
    );
    if (!template) return;

    try {
      await api.prompts.reset(template.id);
      addMessage({ type: "success", content: "已重置为默认模板" });
      await loadTemplates();
    } catch (error) {
      console.error("Failed to reset template:", error);
      addMessage({ type: "error", content: "重置失败" });
    }
  };

  const getScopeLabel = (scope: TemplateScope) => {
    switch (scope) {
      case "system":
        return "系统级";
      case "user":
        return "用户级";
      case "graph":
        return "图谱级";
    }
  };

  const getScopeDescription = (scope: TemplateScope) => {
    switch (scope) {
      case "system":
        return "全局默认模板，所有用户共享";
      case "user":
        return "您的个人模板，全局生效";
      case "graph":
        return "当前图谱专用模板，优先级最高";
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none"
          >
            <div className="w-full max-w-4xl h-[80vh] pointer-events-auto">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-500/20">
                      <Settings
                        size={18}
                        className="text-cyan-600 dark:text-cyan-400"
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                      设置
                    </h3>
                  </div>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setActiveTab("reading")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                      activeTab === "reading"
                        ? "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Type size={16} />
                    阅读设置
                  </button>
                  <button
                    onClick={() => setActiveTab("prompt")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                      activeTab === "prompt"
                        ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-b-2 border-purple-500"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Zap size={16} />
                    配置生成模板
                  </button>
                </div>

                <div className="flex-1 overflow-hidden">
                  {activeTab === "reading" ? (
                    <div className="p-6 space-y-6 overflow-y-auto h-full">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Type
                            size={16}
                            className="text-slate-500 dark:text-slate-400"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            字体大小
                          </span>
                          <span className="ml-auto text-sm font-mono text-cyan-600 dark:text-cyan-400">
                            {fontSize}px
                          </span>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="range"
                            min="12"
                            max="24"
                            step="1"
                            value={fontSize}
                            onChange={(e) =>
                              setFontSize(parseInt(e.target.value))
                            }
                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                          />
                          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                            <span>12px</span>
                            <span>16px</span>
                            <span>20px</span>
                            <span>24px</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <BookOpen
                            size={16}
                            className="text-slate-500 dark:text-slate-400"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            阅读模式
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              {
                                id: "default",
                                label: "默认",
                                icon: Sun,
                                color:
                                  "from-slate-100 to-white dark:from-slate-700 dark:to-slate-800",
                              },
                              {
                                id: "eye-care",
                                label: "护眼",
                                icon: Eye,
                                color:
                                  "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
                              },
                              {
                                id: "dark",
                                label: "深色",
                                icon: Moon,
                                color:
                                  "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
                              },
                            ] as const
                          ).map((mode) => (
                            <motion.button
                              key={mode.id}
                              onClick={() => setReadingMode(mode.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                readingMode === mode.id
                                  ? "border-cyan-500 bg-gradient-to-br " +
                                    mode.color
                                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                              }`}
                            >
                              <mode.icon
                                size={20}
                                className={
                                  readingMode === mode.id
                                    ? "text-cyan-600 dark:text-cyan-400"
                                    : "text-slate-400 dark:text-slate-500"
                                }
                              />
                              <span
                                className={`text-xs font-medium ${
                                  readingMode === mode.id
                                    ? "text-cyan-700 dark:text-cyan-300"
                                    : "text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {mode.label}
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Scroll
                            size={16}
                            className="text-slate-500 dark:text-slate-400"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            分页方式
                          </span>
                        </div>
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                          {(
                            [
                              { id: "scroll", label: "滚动", icon: Scroll },
                              {
                                id: "pagination",
                                label: "翻页",
                                icon: FileText,
                              },
                            ] as const
                          ).map((mode) => (
                            <motion.button
                              key={mode.id}
                              onClick={() => setPaginationMode(mode.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                paginationMode === mode.id
                                  ? "bg-white dark:bg-slate-600 text-cyan-600 dark:text-cyan-400 shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                              }`}
                            >
                              <mode.icon size={16} />
                              {mode.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <motion.button
                          onClick={resetSettings}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <RefreshCcw size={16} />
                          <span className="text-sm font-medium">
                            重置默认设置
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 overflow-hidden">
                      <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                          配置场景
                        </h3>
                        <div className="space-y-2">
                          {PROMPT_SCENARIOS.map((scenario) => {
                            const isSelected =
                              selectedScenario?.id === scenario.id;
                            const effective = getEffectiveTemplate(scenario.id);

                            return (
                              <button
                                key={scenario.id}
                                onClick={() => {
                                  setSelectedScenario(scenario);
                                  setEditingScope(null);
                                }}
                                className={`w-full p-3 rounded-lg border text-left transition-all ${
                                  isSelected
                                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div
                                    className={`p-1.5 rounded ${
                                      isSelected
                                        ? "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                    }`}
                                  >
                                    {scenario.icon}
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                                    {scenario.name}
                                  </span>
                                  {effective.scope !== "system" && (
                                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                                      {getScopeLabel(effective.scope)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                                  {scenario.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4">
                        {isLoading ? (
                          <div className="h-full flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                          </div>
                        ) : editingScope ? (
                          <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-600 dark:text-purple-400">
                                  {selectedScenario?.icon}
                                </div>
                                <div>
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {selectedScenario?.name} -{" "}
                                    {getScopeLabel(editingScope)}模板
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {getScopeDescription(editingScope)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={handleResetToDefault}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                重置为默认
                              </button>
                            </div>
                            <div className="flex-1 min-h-0">
                              <PromptEditor
                                initialContent={editedTemplate}
                                variables={selectedScenario?.variables || []}
                                onSave={handleSave}
                                onCancel={handleCancel}
                                title=""
                              />
                            </div>
                          </div>
                        ) : selectedScenario ? (
                          <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-600 dark:text-purple-400">
                                  {selectedScenario.icon}
                                </div>
                                <div>
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {selectedScenario.name}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {selectedScenario.description}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="mb-4">
                              <button
                                onClick={() => setShowScopeInfo(!showScopeInfo)}
                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                {showScopeInfo ? (
                                  <ChevronUp size={16} />
                                ) : (
                                  <ChevronDown size={16} />
                                )}
                                模板优先级说明
                              </button>
                              {showScopeInfo && (
                                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                                  <p className="mb-2">
                                    模板按以下优先级生效：
                                    <strong>
                                      图谱级 {">"} 用户级 {">"} 系统级
                                    </strong>
                                  </p>
                                  <ul className="space-y-1 text-xs">
                                    <li className="flex items-center gap-2">
                                      <Network
                                        size={12}
                                        className="text-purple-500"
                                      />
                                      <span>
                                        <strong>图谱级</strong>
                                        ：仅对当前图谱生效，优先级最高
                                      </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                      <User
                                        size={12}
                                        className="text-blue-500"
                                      />
                                      <span>
                                        <strong>用户级</strong>
                                        ：对您的所有图谱生效
                                      </span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                      <Globe
                                        size={12}
                                        className="text-gray-500"
                                      />
                                      <span>
                                        <strong>系统级</strong>
                                        ：全局默认模板，不可修改
                                      </span>
                                    </li>
                                  </ul>
                                </div>
                              )}
                            </div>

                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                可用变量
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedScenario.variables.map((variable) => (
                                  <span
                                    key={variable}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-300"
                                  >
                                    {`{{${variable}}}`}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4">
                              {graphId && (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20">
                                    <div className="flex items-center gap-2">
                                      <Network
                                        size={16}
                                        className="text-purple-600 dark:text-purple-400"
                                      />
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        图谱级模板
                                      </span>
                                      <span className="text-xs text-purple-600 dark:text-purple-400">
                                        最高优先级
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {getTemplateContent(
                                        selectedScenario.id,
                                        "graph",
                                      ) && (
                                        <button
                                          onClick={() =>
                                            handleDeleteTemplate("graph")
                                          }
                                          className="text-xs text-red-500 hover:text-red-700"
                                        >
                                          删除
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleStartEdit("graph")}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                      >
                                        <Edit size={12} />
                                        {getTemplateContent(
                                          selectedScenario.id,
                                          "graph",
                                        )
                                          ? "编辑"
                                          : "创建"}
                                      </button>
                                    </div>
                                  </div>
                                  {getTemplateContent(
                                    selectedScenario.id,
                                    "graph",
                                  ) && (
                                    <div className="p-3 bg-white dark:bg-slate-900">
                                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                        {getTemplateContent(
                                          selectedScenario.id,
                                          "graph",
                                        )}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20">
                                  <div className="flex items-center gap-2">
                                    <User
                                      size={16}
                                      className="text-blue-600 dark:text-blue-400"
                                    />
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      用户级模板
                                    </span>
                                    <span className="text-xs text-blue-600 dark:text-blue-400">
                                      全局生效
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getTemplateContent(
                                      selectedScenario.id,
                                      "user",
                                    ) && (
                                      <button
                                        onClick={() =>
                                          handleDeleteTemplate("user")
                                        }
                                        className="text-xs text-red-500 hover:text-red-700"
                                      >
                                        删除
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleStartEdit("user")}
                                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                      <Edit size={12} />
                                      {getTemplateContent(
                                        selectedScenario.id,
                                        "user",
                                      )
                                        ? "编辑"
                                        : "创建"}
                                    </button>
                                  </div>
                                </div>
                                {getTemplateContent(
                                  selectedScenario.id,
                                  "user",
                                ) && (
                                  <div className="p-3 bg-white dark:bg-slate-900">
                                    <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                      {getTemplateContent(
                                        selectedScenario.id,
                                        "user",
                                      )}
                                    </pre>
                                  </div>
                                )}
                              </div>

                              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden opacity-75">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50">
                                  <div className="flex items-center gap-2">
                                    <Globe
                                      size={16}
                                      className="text-gray-500"
                                    />
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      系统级模板
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      默认模板
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    不可修改
                                  </span>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900">
                                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                                    {selectedScenario.defaultTemplate}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <div className="text-center">
                              <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>请从左侧选择一个配置场景</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

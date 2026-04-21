import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  GripHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useLearningSettingsStore } from "../../store/useLearningSettingsStore";
import { PromptEditor } from "../GraphEditor/panels/PromptEditor";
import {
  PROMPT_SCENARIOS,
  getScenarioById,
  type PromptScenario,
} from "../PromptConfig/promptScenarios";
import { useStore } from "../../store/useStore";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { api } from "../../services/api";
import { useIsMobile } from "../../hooks";

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
    contentWidthMode,
    setFontSize,
    setReadingMode,
    setPaginationMode,
    setContentWidthMode,
    resetSettings,
  } = useLearningSettingsStore();

  const { t } = useTranslation();

  const { isMobile } = useIsMobile();
  const [activeTab, setActiveTab] = useState<ActiveTab>("reading");

  const { token } = useStore();

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
        frontendEventBus.publish("message_show", {
          type: "error",
          content: "系统级模板不可修改",
        });
        return;
      }

      await api.prompts.save({
        code: selectedScenario.id,
        scope: editingScope,
        template_content: content,
        graph_id: editingScope === "graph" ? graphId : undefined,
      });

      frontendEventBus.publish("message_show", {
        type: "success",
        content: "Prompt配置已保存",
      });
      setEditingScope(null);
      await loadTemplates();
    } catch (error) {
      console.error("Failed to save prompt config:", error);
      frontendEventBus.publish("message_show", {
        type: "error",
        content: "保存失败",
      });
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
      frontendEventBus.publish("message_show", {
        type: "success",
        content: "已重置为默认模板",
      });
      await loadTemplates();
    } catch (error) {
      console.error("Failed to reset template:", error);
      frontendEventBus.publish("message_show", {
        type: "error",
        content: "重置失败",
      });
    }
  };

  const getScopeLabel = (scope: TemplateScope) => {
    switch (scope) {
      case "system":
        return t("learning.settings.scopeSystem");
      case "user":
        return t("learning.settings.scopeUser");
      case "graph":
        return t("learning.settings.scopeGraph");
    }
  };

  const getScopeDescription = (scope: TemplateScope) => {
    switch (scope) {
      case "system":
        return t("learning.settings.scopeSystemDesc");
      case "user":
        return t("learning.settings.scopeUserDesc");
      case "graph":
        return t("learning.settings.scopeGraphDesc");
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderContent = () => (
    <>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-500/20">
            <Settings size={18} className="text-primary-600 dark:text-primary-400" />
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
              ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          }`}
        >
          <Type size={16} />
          {t("learning.settings.readingSettings")}
        </button>
        <button
          onClick={() => setActiveTab("prompt")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
            activeTab === "prompt"
              ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          }`}
        >
          <Zap size={16} />
          {t("learning.settings.promptSettings")}
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
                  {t("learning.settings.fontSize")}
                </span>
                <span className="ml-auto text-sm font-mono text-primary-600 dark:text-primary-400">
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
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500"
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
                  {t("learning.settings.readingMode")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: "default",
                      label: t("learning.settings.modeDefault"),
                      icon: Sun,
                      color:
                        "from-slate-100 to-white dark:from-slate-700 dark:to-slate-800",
                    },
                    {
                      id: "eye-care",
                      label: t("learning.settings.modeEyeCare"),
                      icon: Eye,
                      color:
                        "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
                    },
                    {
                      id: "dark",
                      label: t("learning.settings.modeDark"),
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
                        ? "border-primary-500 bg-gradient-to-br " + mode.color
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <mode.icon
                      size={20}
                      className={
                        readingMode === mode.id
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    />
                    <span
                      className={`text-xs font-medium ${
                        readingMode === mode.id
                          ? "text-primary-700 dark:text-primary-300"
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
                  {t("learning.settings.pagination")}
                </span>
              </div>
              <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                {(
                  [
                    {
                      id: "scroll",
                      label: t("learning.settings.scroll"),
                      icon: Scroll,
                    },
                    {
                      id: "pagination",
                      label: t("learning.settings.page"),
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
                        ? "bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <mode.icon size={16} />
                    {mode.label}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText
                  size={16}
                  className="text-slate-500 dark:text-slate-400"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("learning.settings.contentWidth")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: "full",
                      label: t("learning.settings.widthFull"),
                      icon: Maximize2,
                      color:
                        "from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20",
                    },
                    {
                      id: "comfortable",
                      label: t("learning.settings.widthComfortable"),
                      icon: FileText,
                      color:
                        "from-violet-50 to-primary-50 dark:from-violet-900/20 dark:to-primary-900/20",
                    },
                    {
                      id: "narrow",
                      label: t("learning.settings.widthNarrow"),
                      icon: Minimize2,
                      color:
                        "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
                    },
                  ] as const
                ).map((mode) => (
                  <motion.button
                    key={mode.id}
                    onClick={() => setContentWidthMode(mode.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      contentWidthMode === mode.id
                        ? "border-primary-500 bg-gradient-to-br " + mode.color
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <mode.icon
                      size={20}
                      className={
                        contentWidthMode === mode.id
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    />
                    <span
                      className={`text-xs font-medium ${
                        contentWidthMode === mode.id
                          ? "text-primary-700 dark:text-primary-300"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {mode.label}
                    </span>
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
                  {t("learning.settings.resetSettings")}
                </span>
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 h-full">
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                {t("learning.settings.configScenarios")}
              </h3>
              <div className="space-y-2">
                {PROMPT_SCENARIOS.map((scenario) => {
                  const isSelected = selectedScenario?.id === scenario.id;
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
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`p-1.5 rounded ${
                            isSelected
                              ? "bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {scenario.icon}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {scenario.name}
                        </span>
                        {effective.scope !== "system" && (
                          <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
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
                      <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded text-primary-600 dark:text-primary-400">
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
                      {t("learning.settings.resetToDefault")}
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
                      <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded text-primary-600 dark:text-primary-400">
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
                      {t("learning.settings.templatePriority")}
                    </button>
                    {showScopeInfo && (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                        <p className="mb-2">
                          {t("learning.settings.priorityOrder")}
                          <strong>
                            {t("learning.settings.priorityGraph")}
                          </strong>
                        </p>
                        <ul className="space-y-1 text-xs">
                          <li className="flex items-center gap-2">
                            <Network size={12} className="text-primary-500" />
                            <span>
                              <strong>
                                {t("learning.settings.scopeGraph")}
                              </strong>
                              ：{t("learning.settings.scopeGraphDesc")}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <User size={12} className="text-primary-500" />
                            <span>
                              <strong>
                                {t("learning.settings.scopeUser")}
                              </strong>
                              ：{t("learning.settings.scopeUserDesc")}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Globe size={12} className="text-gray-500" />
                            <span>
                              <strong>
                                {t("learning.settings.scopeSystem")}
                              </strong>
                              ：{t("learning.settings.scopeSystemDesc")}
                            </span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t("learning.settings.availableVariables")}
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
                        <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20">
                          <div className="flex items-center gap-2">
                            <Network
                              size={16}
                              className="text-primary-600 dark:text-primary-400"
                            />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {t("learning.settings.graphLevelTemplate")}
                            </span>
                            <span className="text-xs text-primary-600 dark:text-primary-400">
                              {t("learning.settings.highestPriority")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTemplateContent(
                              selectedScenario.id,
                              "graph",
                            ) && (
                              <button
                                onClick={() => handleDeleteTemplate("graph")}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                {t("learning.settings.delete")}
                              </button>
                            )}
                            <button
                              onClick={() => handleStartEdit("graph")}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                            >
                              <Edit size={12} />
                              {getTemplateContent(selectedScenario.id, "graph")
                                ? t("learning.settings.edit")
                                : t("learning.settings.create")}
                            </button>
                          </div>
                        </div>
                        {getTemplateContent(selectedScenario.id, "graph") && (
                          <div className="p-3 bg-white dark:bg-slate-900">
                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                              {getTemplateContent(selectedScenario.id, "graph")}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20">
                        <div className="flex items-center gap-2">
                          <User
                            size={16}
                            className="text-primary-600 dark:text-primary-400"
                          />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {t("learning.settings.userLevelTemplate")}
                          </span>
                          <span className="text-xs text-primary-600 dark:text-primary-400">
                            {t("learning.settings.globalEffect")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTemplateContent(selectedScenario.id, "user") && (
                            <button
                              onClick={() => handleDeleteTemplate("user")}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              {t("learning.settings.delete")}
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit("user")}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            <Edit size={12} />
                            {getTemplateContent(selectedScenario.id, "user")
                              ? t("learning.settings.edit")
                              : t("learning.settings.create")}
                          </button>
                        </div>
                      </div>
                      {getTemplateContent(selectedScenario.id, "user") && (
                        <div className="p-3 bg-white dark:bg-slate-900">
                          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                            {getTemplateContent(selectedScenario.id, "user")}
                          </pre>
                        </div>
                      )}
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden opacity-75">
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-2">
                          <Globe size={16} className="text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {t("learning.settings.systemLevelTemplate")}
                          </span>
                          <span className="text-xs text-gray-500">
                            {t("learning.settings.defaultTemplate")}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {t("learning.settings.cannotModify")}
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
                    <p>{t("learning.settings.selectScenario")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
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
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[101] max-h-[90dvh] flex flex-col"
            >
              <div className="bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-700 overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-center py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <GripHorizontal
                    className="text-gray-400 dark:text-gray-500"
                    size={24}
                  />
                </div>
                {renderContent()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

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
                {renderContent()}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

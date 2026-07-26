import React, { useState, useEffect, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  GraduationCap,
  Briefcase,
  Search,
  Layers,
  FileText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { PromptEditor } from "../GraphEditor/panels/PromptEditor";
import { useStore } from "../../store/useStore";
import { message } from "../../utils/messageHelper";
import { api } from "../../services/api";
import { getScenarioById } from "../PromptConfig/promptScenarios";
import {
  TEMPLATE_CATEGORY_TYPES,
  type TemplateType,
  type TemplateCategory,
} from "@shared/types/graph";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";

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

interface TemplatePromptConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  graphId?: string;
  initialSelectedType?: TemplateType;
}

const CATEGORIES: TemplateCategory[] = [
  "knowledge",
  "project",
  "analysis",
  "architecture",
  "creative",
];

const CATEGORY_CONFIG = {
  knowledge: {
    icon: <GraduationCap size={16} />,
    labelKey: "templates.category.knowledge",
    color: "text-primary-600 dark:text-primary-400",
    iconBg: "bg-primary-100 dark:bg-primary-800/40",
    textColor: "text-primary-600 dark:text-primary-400",
  },
  project: {
    icon: <Briefcase size={16} />,
    labelKey: "templates.category.project",
    color: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-800/40",
    textColor: "text-green-600 dark:text-green-400",
  },
  analysis: {
    icon: <Search size={16} />,
    labelKey: "templates.category.analysis",
    color: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800/40",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  architecture: {
    icon: <Layers size={16} />,
    labelKey: "templates.category.architecture",
    color: "text-primary-600 dark:text-primary-400",
    iconBg: "bg-primary-100 dark:bg-primary-800/40",
    textColor: "text-primary-600 dark:text-primary-400",
  },
  creative: {
    icon: <Sparkles size={16} />,
    labelKey: "templates.category.creative",
    color: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-100 dark:bg-pink-800/40",
    textColor: "text-pink-600 dark:text-pink-400",
  },
} as const satisfies Record<
  TemplateCategory,
  {
    icon: React.ReactNode;
    labelKey: string;
    color: string;
    iconBg: string;
    textColor: string;
  }
>;

export const TemplatePromptConfigPanel: React.FC<
  TemplatePromptConfigPanelProps
> = ({ isOpen, onClose, graphId, initialSelectedType }) => {
  const { t } = useTranslation();
  const { token } = useStore();

  const [selectedType, setSelectedType] = useState<TemplateType | null>(
    initialSelectedType ?? null,
  );
  const [templates, setTemplates] = useState<{
    system: PromptTemplate[];
    user: PromptTemplate[];
    graph: PromptTemplate[];
  }>({ system: [], user: [], graph: [] });
  const [editingContent, setEditingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialSelectedType) {
      setSelectedType(initialSelectedType);
    }
  }, [initialSelectedType]);

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

  const getTemplateContent = useCallback(
    (type: TemplateType, scope: "system" | "user" | "graph"): string => {
      const code = `template_type_${type}`;
      const templateList = templates[scope];
      const template = templateList?.find((t) => t.code === code);
      return template?.template_content || "";
    },
    [templates],
  );

  const getEffectiveContent = useCallback(
    (type: TemplateType): string => {
      if (graphId) {
        const graphContent = getTemplateContent(type, "graph");
        if (graphContent) return graphContent;
      }
      const userContent = getTemplateContent(type, "user");
      if (userContent) return userContent;
      const scenario = getScenarioById(`template_type_${type}`);
      return scenario?.defaultTemplate || "";
    },
    [graphId, getTemplateContent],
  );

  const hasCustomPrompt = useCallback(
    (type: TemplateType): boolean => {
      if (graphId && getTemplateContent(type, "graph")) return true;
      return !!getTemplateContent(type, "user");
    },
    [graphId, getTemplateContent],
  );

  useEffect(() => {
    if (selectedType) {
      setEditingContent(getEffectiveContent(selectedType));
    }
  }, [selectedType, templates]);

  const handleSelectType = (type: TemplateType) => {
    setSelectedType(type);
  };

  const handleSave = async (content: string) => {
    if (!selectedType) return;

    try {
      await api.prompts.save({
        code: `template_type_${selectedType}`,
        scope: graphId ? "graph" : "user",
        template_content: content,
        graph_id: graphId,
      });
      message.success(t("toast.autoGraph.promptSaved"));
      await loadTemplates();
    } catch (error) {
      console.error("Failed to save prompt:", error);
      message.error(t("toast.autoGraph.promptSaveFailed"));
    }
  };

  const handleClose = () => {
    setSelectedType(initialSelectedType ?? null);
    setEditingContent("");
    onClose();
  };

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => handleClose(), isOpen);
  const titleId = useId();

  if (!isOpen) return null;

  const selectedScenario = selectedType
    ? getScenarioById(`template_type_${selectedType}`)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4 backdrop-blur-sm">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("autoGraph.templatePromptConfig")}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-3">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400 dark:text-gray-500" />
              </div>
            )}

            {CATEGORIES.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              return (
                <div key={cat} className="mb-3">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${config.textColor}`}
                  >
                    <div className={`p-1 rounded ${config.iconBg}`}>
                      {config.icon}
                    </div>
                    {t(config.labelKey)}
                  </div>
                  <div className="space-y-0.5">
                    {TEMPLATE_CATEGORY_TYPES[cat].map((type) => {
                      const isSelected = selectedType === type;
                      const isCustom = hasCustomPrompt(type);
                      return (
                        <button
                          key={type}
                          onClick={() => handleSelectType(type)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-sm ${
                            isSelected
                              ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                          }`}
                        >
                          {isCustom && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                          )}
                          {!isCustom && (
                            <span className="w-1.5 h-1.5 flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {t(`templates.templateType.${type}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <div className="p-1 rounded bg-gray-100 dark:bg-gray-700">
                  <FileText
                    size={16}
                    className="text-gray-500 dark:text-gray-400"
                  />
                </div>
                {t("templates.templateType.blank")}
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => handleSelectType("blank")}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-sm ${
                    selectedType === "blank"
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {hasCustomPrompt("blank") && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                  )}
                  {!hasCustomPrompt("blank") && (
                    <span className="w-1.5 h-1.5 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {t("templates.templateType.blank")}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedType ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded text-primary-600 dark:text-primary-400">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {t(`templates.templateType.${selectedType}`)}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t(`templates.templateTypeDescription.${selectedType}`)}
                    </p>
                  </div>
                  {hasCustomPrompt(selectedType) && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400">
                      {graphId
                        ? t("autoGraph.graphLevel")
                        : t("autoGraph.userLevel")}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <PromptEditor
                    key={selectedType}
                    initialContent={editingContent}
                    variables={selectedScenario?.variables || ["topic"]}
                    onSave={handleSave}
                    onCancel={handleClose}
                    title=""
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t("autoGraph.selectTemplateType")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

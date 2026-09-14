import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { formatDate } from "@/utils/formatters";
import { message } from "../../../utils/messageHelper";
import { PromptEditor, type PromptEditorSaveOptions } from "./PromptEditor";
import { DEFAULT_PROMPTS as FALLBACK_DEFAULTS } from "../../../services/prompt";
import {
  Edit,
  RotateCcw,
  Network,
  Layers,
  MessageSquare,
  Wrench,
  ChevronDown,
  LayoutTemplate,
  Route,
  FileText,
  PenLine,
  Search,
  ScrollText,
} from "lucide-react";

interface PromptSettingsPanelProps {
  graphId?: string;
  scope: "user" | "graph";
}

interface PromptTemplateEntry {
  code: string;
  template_content?: string;
  [key: string]: unknown;
}

interface PromptTemplates {
  system: PromptTemplateEntry[];
  user: PromptTemplateEntry[];
  graph: PromptTemplateEntry[];
}

const PROMPT_CATEGORIES = [
  {
    id: "graph_building",
    icon: Network,
    color: "emerald",
    codes: [
      "text_to_graph",
      "document_to_graph",
      "image_to_graph",
      "auto_graph_init",
      "auto_graph_expand",
      "infinite_graph_expansion",
      "branch_suggestions",
      "recommend_connections",
      "node_relation_discovery",
      "discover_graph_relations",
      "cross_graph_connection_analysis",
      "auto_domain_classify",
      "concept_hierarchy",
      "knowledge_gap_analysis",
      "deep_analysis",
      "backbone_generation",
    ],
  },
  {
    id: "card_generation",
    icon: Layers,
    color: "violet",
    codes: [
      "generate_cards",
      "generate_cards_qa",
      "generate_cards_choice",
      "generate_cards_true_false",
      "generate_cards_multi_choice",
      "generate_cards_fill_blank",
      "generate_cards_essay",
      "generate_cards_cloze",
      "generate_cards_select_from_options",
      "generate_cards_matching",
      "generate_cards_ordering",
    ],
  },
  {
    id: "ai_chat",
    icon: MessageSquare,
    color: "amber",
    codes: ["chat", "tutor_chat", "rag_chat", "suggest_questions", "suggest_next_topic"],
  },
  {
    id: "learning_path",
    icon: Route,
    color: "sky",
    codes: [
      "learning_path_generate",
      "learning_path_questions",
      "cross_graph_goal_dialog",
      "cross_graph_goal_suggest",
      "cross_graph_path_variants",
    ],
  },
  {
    id: "content_generation",
    icon: FileText,
    color: "indigo",
    codes: [
      "learning_material",
      "learning_schema_assist",
      "podcast_script",
      "podcast_system",
      "generate_content",
      "generate_task_details",
      "template_application",
    ],
  },
  {
    id: "template_generation",
    icon: LayoutTemplate,
    color: "rose",
    codes: [
      "template_generation",
      "template_type_knowledge_tree",
      "template_type_skill_map",
      "template_type_concept_network",
      "template_type_learning_path",
      "template_type_topic_research",
      "template_type_project_lifecycle",
      "template_type_dev_workflow",
      "template_type_task_breakdown",
      "template_type_sprint_planning",
      "template_type_root_cause",
      "template_type_swot",
      "template_type_comparison",
      "template_type_decision_tree",
      "template_type_tech_ecosystem",
      "template_type_org_structure",
      "template_type_system_architecture",
      "template_type_knowledge_system",
      "template_type_blank",
    ],
  },
  {
    id: "literature_analysis",
    icon: ScrollText,
    color: "blue",
    codes: [
      "literature_concept_extraction",
      "literature_metadata_extraction",
      "literature_relation_inference",
    ],
  },
  {
    id: "notes_writing",
    icon: PenLine,
    color: "teal",
    codes: [
      "notes_daily_summary",
      "notes_extract_concepts",
      "notes_writing_continue",
      "notes_writing_rewrite",
      "notes_writing_expand",
    ],
  },
  {
    id: "rag_retrieval",
    icon: Search,
    color: "cyan",
    codes: ["query_rewrite", "chunk_contextualize"],
  },
  {
    id: "system_tools",
    icon: Wrench,
    color: "slate",
    codes: ["optimize_prompt", "grade_answer", "term_annotation"],
  },
];

const CATEGORY_COLOR_MAP: Record<
  string,
  { bg: string; bgHover: string; icon: string; border: string }
> = {
  emerald: {
    bg: "bg-emerald-50/70 dark:bg-emerald-900/30",
    bgHover: "hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50",
    icon: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-700",
  },
  violet: {
    bg: "bg-violet-50/70 dark:bg-violet-900/30",
    bgHover: "hover:bg-violet-100/80 dark:hover:bg-violet-900/50",
    icon: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-700",
  },
  amber: {
    bg: "bg-amber-50/70 dark:bg-amber-900/30",
    bgHover: "hover:bg-amber-100/80 dark:hover:bg-amber-900/50",
    icon: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-700",
  },
  cyan: {
    bg: "bg-primary-50/70 dark:bg-primary-900/30",
    bgHover: "hover:bg-primary-100/80 dark:hover:bg-primary-900/50",
    icon: "text-primary-600 dark:text-primary-400",
    border: "border-primary-200 dark:border-primary-700",
  },
  blue: {
    bg: "bg-blue-50/70 dark:bg-blue-900/30",
    bgHover: "hover:bg-blue-100/80 dark:hover:bg-blue-900/50",
    icon: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-700",
  },
  rose: {
    bg: "bg-rose-50/70 dark:bg-rose-900/30",
    bgHover: "hover:bg-rose-100/80 dark:hover:bg-rose-900/50",
    icon: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-700",
  },
  slate: {
    bg: "bg-slate-50/70 dark:bg-slate-900/30",
    bgHover: "hover:bg-slate-100/80 dark:hover:bg-slate-900/50",
    icon: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-500",
  },
  sky: {
    bg: "bg-sky-50/70 dark:bg-sky-900/30",
    bgHover: "hover:bg-sky-100/80 dark:hover:bg-sky-900/50",
    icon: "text-sky-600 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-700",
  },
  indigo: {
    bg: "bg-indigo-50/70 dark:bg-indigo-900/30",
    bgHover: "hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50",
    icon: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-700",
  },
  teal: {
    bg: "bg-teal-50/70 dark:bg-teal-900/30",
    bgHover: "hover:bg-teal-100/80 dark:hover:bg-teal-900/50",
    icon: "text-teal-600 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-700",
  },
};

export const PromptSettingsPanel: React.FC<PromptSettingsPanelProps> = ({
  graphId,
  scope,
}) => {
  const { t, i18n } = useTranslation();
  const [templates, setTemplates] = useState<PromptTemplates>({
    system: [],
    user: [],
    graph: [],
  });
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const getPromptTypeLabel = useCallback((code: string): string => {
    return t(`graphEditor.promptSettings.promptTypes.${code}`, {
      defaultValue: code,
    });
  }, [t]);

  const getSourceName = useCallback((source: string): string => {
    const lowerSource = source.toLowerCase();
    return t(`graphEditor.promptSettings.scopes.${lowerSource}`, {
      defaultValue: source,
    });
  }, [t]);

  // 从 DB 的 description（JSONB {zh,en}）中按当前界面语言取用途描述
  const getPromptDescription = useCallback(
    (tpl: PromptTemplateEntry): string | undefined => {
      const desc = tpl?.description as
        | { zh?: string; en?: string }
        | null
        | undefined;
      if (!desc) return undefined;
      const lang = i18n.language?.toLowerCase().startsWith("en")
        ? "en"
        : "zh";
      return desc[lang] ?? desc.zh ?? desc.en;
    },
    [i18n.language],
  );

  const categories = useMemo(() => {
    return PROMPT_CATEGORIES.map((category) => ({
      ...category,
      name: t(`graphEditor.promptSettings.categories.${category.id}`, {
        defaultValue: category.id,
      }),
    }));
  }, [t]);

  // 预构建各作用域模板的 code 索引，避免渲染循环中对每个 code 做线性 find
  const templateMaps = useMemo(
    () => ({
      graph: new Map(templates.graph.map((t) => [t.code, t])),
      user: new Map(templates.user.map((t) => [t.code, t])),
      system: new Map(templates.system.map((t) => [t.code, t])),
    }),
    [templates],
  );

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.prompts.list(graphId);
      setTemplates(data as PromptTemplates);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [graphId]);

  useEffect(() => {
    fetchTemplates();
  }, [graphId, scope, fetchTemplates]);

  const getEffectiveTemplate = (code: string): PromptTemplateEntry & { source: string } => {
    // If scope is graph, check graph -> user -> system
    if (scope === "graph") {
      const graphTemp = templateMaps.graph.get(code);
      if (graphTemp && graphTemp.template_content && graphTemp.template_content.trim()) {
        return { ...graphTemp, source: "Graph" };
      }
    }

    // If scope is user (or fallback for graph), check user -> system
    const userTemp = templateMaps.user.get(code);
    if (userTemp && userTemp.template_content && userTemp.template_content.trim()) {
      return { ...userTemp, source: "User" };
    }

    const sysTemp = templateMaps.system.get(code);
    if (sysTemp && sysTemp.template_content && sysTemp.template_content.trim()) {
      return { ...sysTemp, source: "System" };
    }

    // 终极兜底：后端未从 DB/DEFAULT 补齐时（极端情况），用前端 mobile 包
    // 的 DEFAULT_PROMPTS 回退，避免空内容进入编辑→保存空字符串失败
    const fallback = FALLBACK_DEFAULTS[code];
    if (fallback) {
      return { code, template_content: fallback, source: "System" };
    }

    return { code, template_content: "", source: "System" };
  };

  const handleSave = async (
    content: string,
    options?: PromptEditorSaveOptions,
  ) => {
    if (!editingCode) return;
    // 阻止保存空内容（后端会拒绝），提前给用户明确提示
    if (!content || !content.trim()) {
      message.error(t("graphEditor.promptSettings.contentEmpty"));
      return;
    }
    await api.prompts.save({
      code: editingCode,
      scope,
      template_content: content,
      graph_id: scope === "graph" ? graphId : undefined,
    });
    // 自动保存：静默且保留编辑状态，不打断用户输入
    if (!options?.auto) {
      message.success(t("graphEditor.promptSettings.saveSuccess"));
    }
    if (!options?.auto) {
      setEditingCode(null);
    }
    fetchTemplates();
  };

  const handleReset = async (code: string) => {
    const effective = getEffectiveTemplate(code);
    const canReset =
      (scope === "graph" && effective.source === "Graph") ||
      (scope === "user" && effective.source === "User");

    if (canReset && effective.id) {
      if (
        await asyncConfirm({
          title: t('common.confirm.resetTitle'),
          message: t('common.confirm.resetMessage'),
          isDangerous: true,
        })
      ) {
        await api.prompts.reset(effective.id as string);
        fetchTemplates();
      }
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const variableMap: Record<string, string[]> = {
    generate_cards: [
      "count",
      "context",
      "allowedTypes",
      "includesQA",
      "includesChoice",
    ],
    branch_suggestions: ["isRootOrCore", "isLeaf", "topic"],
    generate_content: ["topic", "context", "isRoot", "isLeaf", "isNormal"],
    chat: ["contextText"],
    text_to_graph: [],
    recommend_connections: [
      "node_title",
      "node_content",
      "existing_nodes_json",
    ],
    tutor_chat: [
      "isGuided",
      "currentNodeId",
      "currentNodeTitle",
      "currentNodeContent",
      "existingNodes",
    ],
    document_to_graph: [],
    term_annotation: [],
    infinite_graph_expansion: [
      "domainTitle",
      "domainDescription",
      "maxGraphsPerLevel",
    ],
    auto_graph_init: [
      "topic",
      "isCustom",
      "customPrompt",
      "isAcademic",
      "isPractical",
      "isBeginner",
      "hasSources",
      "sources",
      "outputLanguage",
    ],
    auto_graph_expand: [
      "nodeTitle",
      "nodeContent",
      "nodeLevel",
      "minCount",
      "maxCount",
      "useLevelStrategy",
      "isRootOrCore",
      "isLeaf",
      "isCustom",
      "customPrompt",
      "isAcademic",
      "isPractical",
      "isBeginner",
      "existingChildren",
      "existingNodesInGraph",
    ],
    literature_concept_extraction: ["title", "authors", "abstract", "content"],
    literature_relation_inference: ["title", "concepts", "existingNodes"],
    learning_material: ["outputLanguage", "categoryOptions"],
    learning_schema_assist: ["outputLanguage"],
    cross_graph_goal_dialog: ["outputLanguage"],
    cross_graph_path_variants: ["outputLanguage"],
    cross_graph_goal_suggest: ["outputLanguage"],
    podcast_script: ["outputLanguage"],
  };

  if (editingCode) {
    const currentTemp = getEffectiveTemplate(editingCode);
    const displayName = getPromptTypeLabel(editingCode);
    return (
      <div className="h-[600px]">
        <PromptEditor
          initialContent={currentTemp?.template_content || ""}
          variables={variableMap[editingCode] || []}
          onSave={handleSave}
          onCancel={() => setEditingCode(null)}
          title={t("profile.promptSettings.editTemplate", {
            name: displayName,
            scope:
              scope === "graph"
                ? t("profile.promptSettings.graphScope")
                : t("profile.promptSettings.userScope"),
          })}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        {t("profile.promptSettings.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const isExpanded = expandedCategories.has(category.id);
        const IconComponent = category.icon;
        const colorStyle =
          CATEGORY_COLOR_MAP[category.color] || CATEGORY_COLOR_MAP.emerald;

        return (
          <div
            key={category.id}
            className={`border rounded-lg overflow-hidden transition-all duration-300 ${colorStyle.border}`}
          >
            <button
              onClick={() => toggleCategory(category.id)}
              className={`w-full flex items-center justify-between p-4 transition-all duration-200 ${colorStyle.bg} ${colorStyle.bgHover}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg bg-white/50 dark:bg-black/20 ${colorStyle.icon}`}
                >
                  <IconComponent size={18} />
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {category.name}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({category.codes.length})
                </span>
              </div>
              <div
                className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
              >
                <ChevronDown size={20} className="text-gray-500" />
              </div>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
            >
              <div className="divide-y dark:divide-gray-700">
                {category.codes.map((code) => {
                  const effective = getEffectiveTemplate(code);
                  const isCustomizedAtScope =
                    (scope === "graph" && effective.source === "Graph") ||
                    (scope === "user" && effective.source === "User");

                  return (
                    <div
                      key={code}
                      className="p-4 flex items-center justify-between bg-white/80 hover:bg-gray-50/80 transition-colors dark:bg-gray-800/80 dark:hover:bg-gray-750/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {getPromptTypeLabel(code)}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-xs ${
                              effective.source === "Graph"
                                ? "bg-primary-50 text-primary-700 border-primary-200"
                                : effective.source === "User"
                                  ? "bg-primary-50 text-primary-700 border-primary-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                            }`}
                          >
                            {getSourceName(effective.source)}
                          </span>
                          {typeof effective.updated_at === 'string' && effective.updated_at && (
                            <span className="text-xs text-gray-400">
                              {t('graphEditor.promptSettings.updatedAt')}{" "}
                              {formatDate(effective.updated_at as string, "short")}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 min-w-0">
                          {getPromptDescription(effective) && (
                            <p
                              className="text-xs text-gray-500 dark:text-gray-400 truncate"
                              title={getPromptDescription(effective)}
                            >
                              {getPromptDescription(effective)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCustomizedAtScope && (
                          <button
                            onClick={() => handleReset(code)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title={t("profile.promptSettings.reset")}
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingCode(code)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                          title={t("profile.promptSettings.customize")}
                        >
                          <Edit size={16} />
                          {isCustomizedAtScope
                            ? t("profile.promptSettings.edit")
                            : t("profile.promptSettings.customize")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

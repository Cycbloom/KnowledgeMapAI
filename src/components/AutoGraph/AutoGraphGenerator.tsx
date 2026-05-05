import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  BookOpen,
  Briefcase,
  GraduationCap,
  Layers,
  ChevronRight,
  X,
  PenTool,
  AlertCircle,
  Search,
  Settings2,
} from "lucide-react";
import { api } from "../../services/api";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { useErrorHandler, useIsMobile } from "../../hooks";
import { useTopicCheck } from "../../hooks";
import type { TemplateType, TemplateCategory } from "@shared/types/graph";
import { TEMPLATE_CATEGORY_TYPES } from "@shared/types/graph";
import { TemplatePromptConfigPanel } from "./TemplatePromptConfigPanel";

interface AutoGraphGeneratorProps {
  graphId?: string;
  onGraphGenerated?: (nodes: any[], edges: any[]) => void;
  onClose?: () => void;
}

interface GeneratedNode {
  title: string;
  content: string;
  level?: string;
}

interface TreeNode extends GeneratedNode {
  id: string;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

const CATEGORIES: TemplateCategory[] = [
  "knowledge",
  "project",
  "analysis",
  "architecture",
];

const getCategoryIcon = (cat: TemplateCategory, isMobile: boolean) => {
  const size = isMobile ? 18 : 20;
  switch (cat) {
    case "knowledge":
      return <GraduationCap size={size} />;
    case "project":
      return <Briefcase size={size} />;
    case "analysis":
      return <Search size={size} />;
    case "architecture":
      return <Layers size={size} />;
  }
};

const categoryColorMap: Record<
  TemplateCategory,
  { border: string; bg: string; text: string; iconBg: string }
> = {
  knowledge: {
    border: "border-primary-500",
    bg: "bg-primary-50 dark:bg-primary-900/20",
    text: "text-primary-600 dark:text-primary-400",
    iconBg: "bg-primary-100 dark:bg-primary-800/40",
  },
  project: {
    border: "border-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-800/40",
  },
  analysis: {
    border: "border-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-800/40",
  },
  architecture: {
    border: "border-primary-500",
    bg: "bg-primary-50 dark:bg-primary-900/20",
    text: "text-primary-600 dark:text-primary-400",
    iconBg: "bg-primary-100 dark:bg-primary-800/40",
  },
};

const getLevelColor = (level?: string) => {
  switch (level) {
    case "root":
      return "bg-primary-600 text-white border-primary-700 dark:bg-primary-500 dark:text-white dark:border-primary-400";
    case "core":
      return "bg-primary-200 text-primary-900 border-primary-300 dark:bg-primary-800 dark:text-primary-100 dark:border-primary-600";
    case "sub":
      return "bg-secondary-200 text-secondary-800 border-secondary-300 dark:bg-secondary-800 dark:text-secondary-100 dark:border-secondary-600";
    case "normal":
      return "bg-tertiary-100 text-tertiary-800 border-tertiary-200 dark:bg-tertiary-900 dark:text-tertiary-200 dark:border-tertiary-700";
    case "leaf":
      return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
  }
};

const getNextLevel = (currentLevel?: string): string => {
  switch (currentLevel) {
    case "root":
      return "core";
    case "core":
      return "sub";
    case "sub":
      return "normal";
    case "normal":
      return "leaf";
    default:
      return "leaf";
  }
};

let nodeIdCounter = 0;
const generateNodeId = () => `node-${++nodeIdCounter}`;

interface NodeItemProps {
  node: TreeNode;
  depth: number;
  style: "academic" | "practical" | "beginner" | "custom";
  graphId?: string;
  isMobile?: boolean;
  t: (key: string) => string;
  onExpand: (nodeId: string) => Promise<TreeNode[] | null>;
  onNodeUpdate: (nodeId: string, updates: Partial<TreeNode>) => void;
}

const NodeItem: React.FC<NodeItemProps> = ({
  node,
  depth,
  style,
  graphId,
  isMobile,
  t,
  onExpand,
  onNodeUpdate,
}) => {
  const [isExpanding, setIsExpanding] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isLoading || isExpanding) return;

    setIsExpanding(true);
    onNodeUpdate(node.id, { isLoading: true });

    try {
      const children = await onExpand(node.id);
      if (children && children.length > 0) {
        onNodeUpdate(node.id, {
          children,
          isExpanded: true,
          isLoading: false,
        });
      } else {
        onNodeUpdate(node.id, { isLoading: false });
      }
    } catch (error) {
      onNodeUpdate(node.id, { isLoading: false });
    } finally {
      setIsExpanding(false);
    }
  };

  const toggleExpand = () => {
    onNodeUpdate(node.id, { isExpanded: !node.isExpanded });
  };

  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * (isMobile ? 12 : 16);

  return (
    <div className="node-item">
      <div
        className={`${isMobile ? "p-2" : "p-3"} rounded-lg border cursor-pointer hover:shadow-sm transition-all ${getLevelColor(node.level)}`}
        style={{ marginLeft: `${indent}px` }}
        onClick={toggleExpand}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={`font-medium truncate ${isMobile ? "text-sm" : ""}`}
            >
              {node.title}
            </div>
            <p
              className={`${isMobile ? "text-xs" : "text-sm"} mt-1 opacity-70 line-clamp-1`}
            >
              {node.content}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleExpand}
              disabled={node.isLoading || isExpanding}
              className={`${isMobile ? "p-1" : "p-1.5"} bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 transition-colors`}
              title={t("autoGraph.aiExpandNode")}
            >
              {node.isLoading || isExpanding ? (
                <Loader2 size={isMobile ? 12 : 14} className="animate-spin" />
              ) : (
                <Sparkles size={isMobile ? 12 : 14} />
              )}
            </button>
            {hasChildren && (
              <ChevronRight
                size={isMobile ? 14 : 16}
                className={`transition-transform ${node.isExpanded ? "rotate-90" : ""}`}
              />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {node.isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="children-container"
          >
            {node.children!.map((child) => (
              <NodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                style={style}
                graphId={graphId}
                isMobile={isMobile}
                t={t}
                onExpand={onExpand}
                onNodeUpdate={onNodeUpdate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const styleIcons = {
  academic: GraduationCap,
  practical: Briefcase,
  beginner: BookOpen,
  custom: PenTool,
};

export const AutoGraphGenerator: React.FC<AutoGraphGeneratorProps> = ({
  graphId,
  onGraphGenerated,
  onClose,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<TemplateType>("blank");
  const [expandedCategory, setExpandedCategory] =
    useState<TemplateCategory | null>(null);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [showTemplatePromptConfig, setShowTemplatePromptConfig] =
    useState(false);

  const [topic, setTopic] = useState("");
  const [backgroundInfo, setBackgroundInfo] = useState("");
  const [style, setStyle] = useState<
    "academic" | "practical" | "beginner" | "custom"
  >("academic");
  const [customPrompt, setCustomPrompt] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);

  const [rootNode, setRootNode] = useState<TreeNode | null>(null);
  const [createdGraphId, setCreatedGraphId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { handleError } = useErrorHandler();

  const {
    isChecking,
    isDuplicate,
    similarGraphs,
    checkTopic,
    reset: resetTopicCheck,
  } = useTopicCheck({
    debounceMs: 500,
    excludeGraphId: graphId,
  });

  useEffect(() => {
    if (topic.trim().length >= 2 && !graphId) {
      checkTopic(topic);
    } else {
      resetTopicCheck();
    }
  }, [topic, checkTopic, resetTopicCheck, graphId]);

  const handleAddSource = useCallback(() => {
    if (newSource.trim()) {
      setSources((prev) => [...prev, newSource.trim()]);
      setNewSource("");
    }
  }, [newSource]);

  const handleRemoveSource = useCallback((index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleInitialize = useCallback(async () => {
    if (!topic.trim()) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("autoGraph.topicRequired"),
      });
      return;
    }

    if (!graphId && isDuplicate) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("autoGraph.topicDuplicate"),
      });
      return;
    }

    if (style === "custom" && !customPrompt.trim()) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("autoGraph.enterCustomRules"),
      });
      return;
    }

    setIsInitializing(true);
    setRootNode(null);
    nodeIdCounter = 0;

    try {
      const result = await api.autoGraph.init({
        topic,
        style,
        customPrompt: style === "custom" ? customPrompt : undefined,
        sources: sources.length > 0 ? sources : undefined,
        graph_id: graphId,
        template_type: selectedTemplateType !== "blank" ? selectedTemplateType : undefined,
      });

      setSessionId(result.sessionId);

      const root: TreeNode = {
        id: generateNodeId(),
        title: result.root.title,
        content: result.root.content,
        level: "root",
        children: result.coreNodes.map((n: any) => ({
          id: generateNodeId(),
          title: n.title,
          content: n.content,
          level: "core",
          children: [],
          isExpanded: false,
        })),
        isExpanded: true,
      };

      setRootNode(root);
      setIsInputCollapsed(true);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("autoGraph.initSuccess"),
      });
    } catch (error) {
      handleError(error, {
        context: "AutoGraphInit",
        fallbackMessage: t("autoGraph.initFailed"),
      });
    } finally {
      setIsInitializing(false);
    }
  }, [topic, style, sources, graphId, handleError, isDuplicate, t]);

  const handleExpandNode = useCallback(
    async (nodeId: string, node: TreeNode): Promise<TreeNode[] | null> => {
      try {
        const result = await api.autoGraph.expand({
          node_id: nodeId,
          node_title: node.title,
          node_content: node.content,
          node_level: node.level,
          graph_id: createdGraphId || graphId || "temp",
          style,
          customPrompt: style === "custom" ? customPrompt : undefined,
          existing_children: node.children?.map((c) => ({ title: c.title })),
          session_id: sessionId || undefined,
        });

        const childLevel = getNextLevel(node.level);
        return result.children.map((n: any) => ({
          id: generateNodeId(),
          title: n.title,
          content: n.content,
          level: childLevel,
          children: [],
          isExpanded: false,
        }));
      } catch (error) {
        handleError(error, {
          context: "ExpandNode",
          fallbackMessage: t("autoGraph.expandFailed"),
        });
        return null;
      }
    },
    [createdGraphId, graphId, style, customPrompt, sessionId, handleError, t],
  );

  const updateNodeInTree = useCallback(
    (node: TreeNode, nodeId: string, updates: Partial<TreeNode>): TreeNode => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map((child) =>
            updateNodeInTree(child, nodeId, updates),
          ),
        };
      }
      return node;
    },
    [],
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<TreeNode>) => {
      setRootNode((prev) => {
        if (!prev) return prev;
        return updateNodeInTree(prev, nodeId, updates);
      });
    },
    [updateNodeInTree],
  );

  const hasAnyNodeLoading = useCallback((node: TreeNode): boolean => {
    if (node.isLoading) return true;
    if (node.children) {
      return node.children.some((child) => hasAnyNodeLoading(child));
    }
    return false;
  }, []);

  const handleExpandWrapper = useCallback(
    (nodeId: string): Promise<TreeNode[] | null> => {
      const findNode = (node: TreeNode, id: string): TreeNode | null => {
        if (node.id === id) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child, id);
            if (found) return found;
          }
        }
        return null;
      };

      if (!rootNode) return Promise.resolve(null);
      const node = findNode(rootNode, nodeId);
      if (!node) return Promise.resolve(null);

      return handleExpandNode(nodeId, node);
    },
    [rootNode, handleExpandNode],
  );

  const collectAllNodes = useCallback(
    (node: TreeNode, parentId?: string): any[] => {
      const nodes = [
        {
          id: node.id,
          title: node.title,
          content: node.content,
          level: node.level,
          parentId,
        },
      ];
      if (node.children) {
        node.children.forEach((child) => {
          nodes.push(...collectAllNodes(child, node.id));
        });
      }
      return nodes;
    },
    [],
  );

  const handleSaveToGraph = useCallback(async () => {
    if (!rootNode) return;

    setIsSaving(true);

    try {
      let targetGraphId: string | undefined = graphId;

      if (!targetGraphId) {
        const createResult = await api.graphs.create({
          title: topic,
          description: rootNode.content,
          template_type: selectedTemplateType !== "blank" ? selectedTemplateType : undefined,
        });
        targetGraphId = createResult.id;
        if (targetGraphId) {
          setCreatedGraphId(targetGraphId);
        }
      }

      if (!targetGraphId) {
        handleError(new Error("Failed to create graph"), {
          context: "SaveGraph",
          fallbackMessage: t("autoGraph.createGraphFailed"),
        });
        return;
      }

      const allNodes = collectAllNodes(rootNode);

      await api.autoGraph.saveNodes({
        graph_id: targetGraphId,
        nodes: allNodes,
      });

      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("autoGraph.graphSaved"),
      });
      onGraphGenerated?.(allNodes, []);
      onClose?.();
    } catch (error) {
      handleError(error, {
        context: "SaveGraph",
        fallbackMessage: t("autoGraph.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    graphId,
    rootNode,
    topic,
    collectAllNodes,
    onGraphGenerated,
    onClose,
    handleError,
    t,
  ]);

  const styleOptions = [
    {
      value: "academic" as const,
      labelKey: "autoGraph.styleLabels.academic",
      detailsKey: "autoGraph.academicStyleDesc",
    },
    {
      value: "practical" as const,
      labelKey: "autoGraph.styleLabels.practical",
      detailsKey: "autoGraph.practicalStyleDesc",
    },
    {
      value: "beginner" as const,
      labelKey: "autoGraph.styleLabels.beginner",
      detailsKey: "autoGraph.beginnerStyleDesc",
    },
    {
      value: "custom" as const,
      labelKey: "autoGraph.styleLabels.custom",
      detailsKey: "autoGraph.customStyleDesc",
    },
  ];

  const getStyleLabel = (styleValue: string) => {
    return t(`autoGraph.styleLabels.${styleValue}`);
  };

  const handleSelectTemplateType = (type: TemplateType) => {
    setSelectedTemplateType(type);
    setIsTemplateSelectorOpen(false);
    setExpandedCategory(null);
  };

  const renderTemplateSelector = () => (
    <div
      className={`rounded-xl border ${isMobile ? "" : ""} ${isTemplateSelectorOpen ? "border-primary-300 dark:border-primary-700" : "border-gray-200 dark:border-gray-700"}`}
    >
      <button
        onClick={() => setIsTemplateSelectorOpen(!isTemplateSelectorOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${isTemplateSelectorOpen ? "" : "hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}
      >
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-gray-400 dark:text-gray-500" />
          <span
            className={`font-medium ${isMobile ? "text-xs" : "text-sm"} text-gray-700 dark:text-gray-300`}
          >
            {t("autoGraph.templateType")}
          </span>
          {selectedTemplateType !== "blank" ? (
            <span
              className={`${isMobile ? "text-[10px]" : "text-xs"} px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300`}
            >
              {t(`templates.templateType.${selectedTemplateType}`)}
            </span>
          ) : (
            <span
              className={`${isMobile ? "text-[10px]" : "text-xs"} text-gray-400 dark:text-gray-500`}
            >
              {t("templates.templateType.blank")}
            </span>
          )}
          {!isTemplateSelectorOpen && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowTemplatePromptConfig(true);
              }}
              className={`p-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-pointer`}
              title={t("autoGraph.editPrompt")}
            >
              <Settings2
                size={14}
                className="text-gray-400 dark:text-gray-500"
              />
            </div>
          )}
        </div>
        {isTemplateSelectorOpen ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {isTemplateSelectorOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`p-3 border-t ${isTemplateSelectorOpen ? "border-primary-200 dark:border-primary-800" : "border-gray-200 dark:border-gray-700"}`}
            >
              <div className="grid grid-cols-2 gap-2 mb-2">
                {CATEGORIES.map((cat) => {
                  const colors = categoryColorMap[cat];
                  return (
                    <div key={cat}>
                      <button
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === cat ? null : cat,
                          )
                        }
                        className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                          expandedCategory === cat
                            ? `${colors.border} ${colors.bg}`
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`p-1 rounded ${colors.iconBg} ${colors.text}`}
                          >
                            {getCategoryIcon(cat, isMobile ?? false)}
                          </div>
                          <span
                            className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium text-gray-900 dark:text-white`}
                          >
                            {t(`templates.category.${cat}`)}
                          </span>
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedCategory === cat && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1 space-y-1">
                              {TEMPLATE_CATEGORY_TYPES[cat].map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleSelectTemplateType(type)}
                                  className={`w-full p-2 rounded-lg text-left transition-all ${
                                    selectedTemplateType === type
                                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700"
                                      : "hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400"
                                  }`}
                                >
                                  <span
                                    className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium`}
                                  >
                                    {t(`templates.templateType.${type}`)}
                                  </span>
                                  <span
                                    className={`${isMobile ? "text-[9px]" : "text-[10px]"} text-gray-400 dark:text-gray-500 ml-1.5`}
                                  >
                                    {t(
                                      `templates.templateTypeDescription.${type}`,
                                    )}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => handleSelectTemplateType("blank")}
                className={`w-full p-2 rounded-lg border-2 border-dashed text-center transition-all ${
                  selectedTemplateType === "blank"
                    ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <span
                  className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium`}
                >
                  {t("templates.templateType.blank")}
                </span>
                <span
                  className={`${isMobile ? "text-[9px]" : "text-[10px]"} ml-1.5`}
                >
                  {t("templates.templateTypeDescription.blank")}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderForm = () => (
    <div className="space-y-3 md:space-y-4">
      {renderTemplateSelector()}

      <div>
        <label
          className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}
        >
          {t("autoGraph.topic")} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("autoGraph.topicPlaceholder")}
            className={`w-full ${isMobile ? "px-3 py-2 text-sm" : "px-4 py-3"} border rounded-lg focus:ring-2 focus:border-transparent dark:bg-slate-700 dark:text-white ${
              isDuplicate
                ? "border-amber-500 focus:ring-amber-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-primary-500"
            }`}
            disabled={isInitializing}
          />
          {isChecking && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary-500" />
          )}
        </div>
        {isDuplicate && similarGraphs.length > 0 && !graphId && (
          <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <AlertCircle
              className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} mt-0.5 flex-shrink-0`}
            />
            <div className={`${isMobile ? "text-xs" : "text-sm"}`}>
              <p className="font-medium">
                {t("autoGraph.topicDuplicateWarning")}
              </p>
              <p className="mt-0.5">
                {t("autoGraph.similarToGraph", {
                  title: similarGraphs[0].title,
                  similarity: (similarGraphs[0].similarity * 100).toFixed(1),
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      <div>
        <label
          className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}
        >
          {t("templates.generator.backgroundInfo")}
        </label>
        <textarea
          value={backgroundInfo}
          onChange={(e) => setBackgroundInfo(e.target.value)}
          placeholder={t("templates.generator.backgroundPlaceholder")}
          className={`w-full ${isMobile ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white ${isMobile ? "min-h-[60px]" : "min-h-[80px]"} resize-y`}
          disabled={isInitializing}
        />
      </div>

      <div>
        <label
          className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}
        >
          {t("autoGraph.generationStyle")}
        </label>
        <div
          className={`grid ${isMobile ? "grid-cols-2 gap-1.5" : "grid-cols-4 gap-2"}`}
        >
          {styleOptions.map((option) => {
            const Icon = styleIcons[option.value];
            return (
              <button
                key={option.value}
                onClick={() => setStyle(option.value)}
                disabled={isInitializing}
                className={`${isMobile ? "p-2" : "p-2"} rounded-lg border-2 transition-all text-left ${
                  style === option.value
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                }`}
              >
                <div
                  className={`flex items-center gap-1 ${isMobile ? "mb-0.5" : "mb-0.5"}`}
                >
                  <Icon
                    className={`${isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} ${
                      style === option.value
                        ? "text-primary-500"
                        : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium ${
                      style === option.value
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {t(option.labelKey)}
                  </span>
                </div>
                <p
                  className={`${isMobile ? "text-[9px]" : "text-[10px]"} text-gray-500 dark:text-gray-400 line-clamp-1`}
                >
                  {t(option.detailsKey)}
                </p>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {style === "custom" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`flex items-center justify-between ${isMobile ? "mb-1.5 mt-2" : "mb-2 mt-3"}`}
              >
                <label
                  className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
                >
                  {t("autoGraph.customRules")}
                </label>
                <button
                  onClick={async () => {
                    if (!topic.trim()) {
                      frontendEventBus.publish("message_show", {
                        type: "warning",
                        content: t("autoGraph.topicRequired"),
                      });
                      return;
                    }
                    try {
                      const result = await api.autoGraph.optimizePrompt({
                        topic,
                        currentPrompt: customPrompt,
                      });
                      setCustomPrompt(result.optimizedPrompt);
                      frontendEventBus.publish("message_show", {
                        type: "success",
                        content: t("autoGraph.rulesOptimized"),
                      });
                    } catch (error) {
                      handleError(error, {
                        context: "OptimizePrompt",
                        fallbackMessage: t("autoGraph.optimizeFailed"),
                      });
                    }
                  }}
                  disabled={isInitializing}
                  className={`flex items-center gap-1 px-2 py-1 ${isMobile ? "text-[10px]" : "text-xs"} bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50 disabled:opacity-50`}
                >
                  <Sparkles size={isMobile ? 10 : 12} />
                  {t("autoGraph.aiOptimize")}
                </button>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={t("autoGraph.customRulesPlaceholder")}
                className={`w-full ${isMobile ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white ${isMobile ? "min-h-[80px]" : "min-h-[100px]"} resize-y`}
                disabled={isInitializing}
              />
              <p
                className={`${isMobile ? "text-[10px]" : "text-xs"} text-gray-400 mt-1`}
              >
                {t("autoGraph.customRulesDesc")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={`flex items-center gap-2 ${isMobile ? "text-xs" : "text-sm"} text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200`}
      >
        {showAdvanced ? (
          <ChevronUp size={isMobile ? 14 : 16} />
        ) : (
          <ChevronDown size={isMobile ? 14 : 16} />
        )}
        {t("autoGraph.referenceSources")}
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 md:space-y-3 overflow-hidden"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder={t("autoGraph.sourcePlaceholder")}
                className={`flex-1 ${isMobile ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white`}
                disabled={isInitializing}
              />
              <button
                onClick={handleAddSource}
                disabled={isInitializing || !newSource.trim()}
                className={`${isMobile ? "px-2 py-1.5" : "px-3 py-2"} bg-gray-100 dark:bg-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500 disabled:opacity-50`}
              >
                <Plus size={isMobile ? 14 : 16} />
              </button>
            </div>
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sources.map((source, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-600 rounded ${isMobile ? "text-[10px]" : "text-xs"}`}
                  >
                    {source.slice(0, 30)}...
                    <button
                      onClick={() => handleRemoveSource(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleInitialize}
        disabled={isInitializing || !topic.trim() || isChecking || isDuplicate}
        className={`w-full ${isMobile ? "py-2.5 px-3 text-sm" : "py-3 px-4"} bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium rounded-lg hover:from-primary-600 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
      >
        {isInitializing ? (
          <>
            <Loader2
              className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} animate-spin`}
            />
            {t("autoGraph.initializing")}
          </>
        ) : (
          <>
            <Sparkles className={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`} />
            {t("autoGraph.startGenerate")}
          </>
        )}
      </button>
    </div>
  );

  return (
    <div
      className={`auto-graph-generator bg-white dark:bg-slate-800 ${isMobile ? "rounded-none" : "rounded-xl"} shadow-lg ${isMobile ? "p-4" : "p-6"} w-full ${isMobile ? "h-full" : "max-w-2xl max-h-[90vh]"} overflow-y-auto`}
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div
            className={`${isMobile ? "p-1.5" : "p-2"} bg-gradient-to-br from-primary-500 to-primary-500 rounded-lg`}
          >
            <Layers
              className={`${isMobile ? "w-5 h-5" : "w-6 h-6"} text-white`}
            />
          </div>
          <div>
            <h2
              className={`${isMobile ? "text-lg" : "text-xl"} font-bold text-gray-900 dark:text-white`}
            >
              {t("autoGraph.title")}
            </h2>
            <p
              className={`${isMobile ? "text-xs" : "text-sm"} text-gray-500 dark:text-gray-400`}
            >
              {t("autoGraph.subtitle")}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X size={isMobile ? 18 : 20} />
          </button>
        )}
      </div>

      <div className="space-y-3 md:space-y-4">
        {!isInputCollapsed && renderForm()}

        {isInputCollapsed && rootNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-2 md:p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`${isMobile ? "text-xs" : "text-sm"} text-gray-600 dark:text-gray-300`}
                >
                  {t("autoGraph.topic")}:
                </span>
                <span
                  className={`font-medium text-gray-900 dark:text-white ${isMobile ? "text-sm" : ""}`}
                >
                  {topic}
                </span>
                <span
                  className={`${isMobile ? "text-[10px]" : "text-xs"} text-gray-400 dark:text-gray-500 px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded`}
                >
                  {getStyleLabel(style)}
                </span>
                {selectedTemplateType !== "blank" && (
                  <span
                    className={`${isMobile ? "text-[10px]" : "text-xs"} px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded`}
                  >
                    {t(`templates.templateType.${selectedTemplateType}`)}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setIsInputCollapsed(false);
                }}
                className={`${isMobile ? "text-[10px]" : "text-xs"} text-primary-500 hover:text-primary-600 flex items-center gap-1`}
              >
                <ChevronDown size={isMobile ? 12 : 14} />
                {t("autoGraph.modify")}
              </button>
            </div>
          </motion.div>
        )}

        {rootNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 md:space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3
                className={`${isMobile ? "text-base" : "text-lg"} font-semibold text-gray-900 dark:text-white`}
              >
                {t("autoGraph.generateResult")}
              </h3>
              <span
                className={`${isMobile ? "text-xs" : "text-sm"} text-gray-500`}
              >
                {t("autoGraph.clickToExpand")}
              </span>
            </div>

            <div
              className={`space-y-2 ${isMobile ? "max-h-[300px]" : "max-h-[400px]"} overflow-y-auto`}
            >
              <NodeItem
                node={rootNode}
                depth={0}
                style={style}
                graphId={createdGraphId || graphId}
                isMobile={isMobile}
                t={t}
                onExpand={handleExpandWrapper}
                onNodeUpdate={handleNodeUpdate}
              />
            </div>

            <button
              onClick={handleSaveToGraph}
              disabled={isSaving || (rootNode && hasAnyNodeLoading(rootNode))}
              className={`w-full ${isMobile ? "py-2 px-3 text-sm" : "py-2 px-4"} bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {isSaving ? (
                <Loader2
                  className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} animate-spin`}
                />
              ) : (
                <Check className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`} />
              )}
              {graphId
                ? t("autoGraph.saveToCurrentGraph")
                : t("autoGraph.createAndSave")}
            </button>
          </motion.div>
        )}
      </div>

      <TemplatePromptConfigPanel
        isOpen={showTemplatePromptConfig}
        onClose={() => setShowTemplatePromptConfig(false)}
        graphId={graphId}
        initialSelectedType={
          selectedTemplateType !== "blank" ? selectedTemplateType : undefined
        }
      />
    </div>
  );
};

export default AutoGraphGenerator;

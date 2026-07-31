import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, Check, X, RefreshCw, Info } from "lucide-react";
import { Node, BackboneModule } from "../../types";
import {
  BACKBONE_MODULE_TITLES,
  BACKBONE_MODULE_LABEL_I18N_KEYS,
  BACKBONE_MODULE_COLORS,
} from "@shared/types/graph";
import { api } from "../../services/api";
import { message } from "../../utils/messageHelper";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../../hooks";
import { useTranslation } from "react-i18next";

interface CompatibilityIssue {
  nodeId: string;
  nodeTitle: string;
  issueType: "missing_module" | "invalid_title" | "invalid_module";
  suggestedModule?: BackboneModule;
  suggestedTitle?: string;
  currentModule?: string;
}

interface BackboneCompatibilityCheckerProps {
  graphId: string;
  nodes: Node[];
  templateType?: string;
  onCheckComplete?: (hasIssues: boolean) => void;
}

const MODULE_KEYWORDS: Record<BackboneModule, string[]> = {
  [BackboneModule.RESEARCH_BACKGROUND]: [
    "背景",
    "历史",
    "发展",
    "现状",
    "起源",
    "演变",
    "概况",
    "介绍",
    "概述",
  ],
  [BackboneModule.LITERATURE_REVIEW]: [
    "文献",
    "理论",
    "综述",
    "评述",
    "相关研究",
    "前人研究",
    "相关工作",
  ],
  [BackboneModule.RESEARCH_METHODS]: [
    "方法",
    "方法论",
    "技术",
    "手段",
    "途径",
    "实验设计",
  ],
  [BackboneModule.CORE_CONCEPTS]: [
    "概念",
    "定义",
    "理论",
    "核心",
    "基础",
    "原理",
    "框架",
  ],
  [BackboneModule.APPLICATION_DOMAINS]: [
    "应用",
    "实践",
    "场景",
    "案例",
    "领域",
    "实施",
  ],
  [BackboneModule.FUTURE_DIRECTIONS]: [
    "未来",
    "趋势",
    "展望",
    "方向",
    "发展前景",
    "挑战",
  ],
};

const inferModuleFromTitle = (
  title: string,
): { module: BackboneModule; confidence: number } => {
  const normalizedTitle = title.trim().toLowerCase();

  for (const [module, standardTitle] of Object.entries(
    BACKBONE_MODULE_TITLES,
  )) {
    if (normalizedTitle === standardTitle.toLowerCase()) {
      return { module: module as BackboneModule, confidence: 1.0 };
    }
  }

  for (const [module, standardTitle] of Object.entries(
    BACKBONE_MODULE_TITLES,
  )) {
    if (normalizedTitle.includes(standardTitle.toLowerCase())) {
      return { module: module as BackboneModule, confidence: 0.9 };
    }
  }

  for (const [module, standardTitle] of Object.entries(
    BACKBONE_MODULE_TITLES,
  )) {
    if (standardTitle.toLowerCase().includes(normalizedTitle)) {
      return { module: module as BackboneModule, confidence: 0.8 };
    }
  }

  for (const [module, keywords] of Object.entries(MODULE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedTitle.includes(keyword.toLowerCase())) {
        return { module: module as BackboneModule, confidence: 0.7 };
      }
    }
  }

  return { module: BackboneModule.CORE_CONCEPTS, confidence: 0.3 };
};

const isStandardTitle = (
  title: string,
): { isValid: boolean; module?: BackboneModule } => {
  const normalizedTitle = title.trim().toLowerCase();

  for (const [module, standardTitle] of Object.entries(
    BACKBONE_MODULE_TITLES,
  )) {
    if (normalizedTitle === standardTitle.toLowerCase()) {
      return { isValid: true, module: module as BackboneModule };
    }
  }

  return { isValid: false };
};

const isValidBackboneModule = (module: unknown): module is BackboneModule => {
  return Object.values(BackboneModule).includes(module as BackboneModule);
};

export const BackboneCompatibilityChecker: React.FC<
  BackboneCompatibilityCheckerProps
> = ({ graphId, nodes, templateType, onCheckComplete }) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [issues, setIssues] = useState<CompatibilityIssue[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [hasChecked, setHasChecked] = useState(false);

  const isTopicResearch = templateType === "topic_research";

  const backboneNodes = useMemo(() => {
    if (!isTopicResearch) return [];

    return nodes.filter((node) => {
      const title = node.title?.trim().toLowerCase() || "";
      return Object.values(BACKBONE_MODULE_TITLES).some(
        (standardTitle) =>
          title === standardTitle.toLowerCase() ||
          title.includes(standardTitle.toLowerCase()),
      );
    });
  }, [nodes, isTopicResearch]);

  const checkCompatibility = useCallback(() => {
    if (!isTopicResearch) {
      setHasChecked(true);
      onCheckComplete?.(false);
      return;
    }

    const detectedIssues: CompatibilityIssue[] = [];

    for (const node of backboneNodes) {
      const currentModule = node.properties?.backboneModule;
      const titleValidation = isStandardTitle(node.title || "");

      if (!currentModule) {
        const { module } = inferModuleFromTitle(node.title || "");
        detectedIssues.push({
          nodeId: node.id,
          nodeTitle: node.title || "",
          issueType: "missing_module",
          suggestedModule: module,
        });
      } else if (!isValidBackboneModule(currentModule)) {
        const { module } = inferModuleFromTitle(node.title || "");
        detectedIssues.push({
          nodeId: node.id,
          nodeTitle: node.title || "",
          issueType: "invalid_module",
          currentModule: String(currentModule),
          suggestedModule: module,
        });
      } else if (!titleValidation.isValid && node.level === "root") {
        const standardTitle =
          BACKBONE_MODULE_TITLES[currentModule as BackboneModule];
        detectedIssues.push({
          nodeId: node.id,
          nodeTitle: node.title || "",
          issueType: "invalid_title",
          currentModule,
          suggestedModule: currentModule as BackboneModule,
          suggestedTitle: standardTitle,
        });
      }
    }

    setIssues(detectedIssues);
    setHasChecked(true);

    if (detectedIssues.length > 0) {
      setSelectedIssues(new Set(detectedIssues.map((i) => i.nodeId)));
      setIsOpen(true);
      onCheckComplete?.(true);
    } else {
      onCheckComplete?.(false);
    }
  }, [backboneNodes, isTopicResearch, onCheckComplete]);

  useEffect(() => {
    if (nodes.length > 0 && !hasChecked && isTopicResearch) {
      const timer = setTimeout(checkCompatibility, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes, hasChecked, isTopicResearch, checkCompatibility]);

  const handleToggleIssue = (nodeId: string) => {
    setSelectedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIssues.size === issues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(issues.map((i) => i.nodeId)));
    }
  };

  const handleAutoFix = async () => {
    if (selectedIssues.size === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const issue of issues) {
      if (!selectedIssues.has(issue.nodeId)) continue;

      try {
        const node = nodes.find((n) => n.id === issue.nodeId);
        if (!node) continue;

        const updateData: Record<string, unknown> = {
          properties: {
            ...node.properties,
            backboneModule: issue.suggestedModule,
          },
        };

        if (issue.suggestedTitle && issue.issueType === "invalid_title") {
          updateData.title = issue.suggestedTitle;
        }

        await api.nodes.update(issue.nodeId, updateData);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setIsProcessing(false);
    setIsOpen(false);

    if (successCount > 0) {
      await queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });
      message.success(t("graphEditor.backbone.fixSuccess", { count: successCount }));
    }

    if (errorCount > 0) {
      message.error(t("graphEditor.backbone.fixError", { count: errorCount }));
    }

    onCheckComplete?.(false);
  };

  const handleIgnore = () => {
    setIsOpen(false);
    onCheckComplete?.(false);
  };

  const getIssueDescription = (issue: CompatibilityIssue): string => {
    switch (issue.issueType) {
      case "missing_module": {
        const moduleLabel = issue.suggestedModule ? t(BACKBONE_MODULE_LABEL_I18N_KEYS[issue.suggestedModule]) : t("graphEditor.backbone.unknown");
        return t("graphEditor.backbone.missingModule", { module: moduleLabel });
      }
      case "invalid_module": {
        const moduleLabel = issue.suggestedModule ? t(BACKBONE_MODULE_LABEL_I18N_KEYS[issue.suggestedModule]) : t("graphEditor.backbone.unknown");
        return t("graphEditor.backbone.invalidModule", { current: issue.currentModule ?? "", suggested: moduleLabel });
      }
      case "invalid_title":
        return t("graphEditor.backbone.invalidTitle", { title: issue.suggestedTitle ?? "" });
      default:
        return t("graphEditor.backbone.unknownIssue");
    }
  };

  if (!isOpen || issues.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl ${
          isDark
            ? "bg-slate-800 border border-slate-700"
            : "bg-white border border-gray-200"
        }`}
      >
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isDark
                  ? "bg-amber-900/40 text-amber-400"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2
                className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {t("graphEditor.backbone.title")}
              </h2>
              <p
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {t("graphEditor.backbone.issuesFound", { count: issues.length })}
              </p>
            </div>
          </div>
          <button
            onClick={handleIgnore}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-700 text-slate-400"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`px-6 py-3 border-b ${
            isDark
              ? "border-slate-700 bg-slate-900/50"
              : "border-gray-100 bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Info
              size={16}
              className={isDark ? "text-slate-400" : "text-gray-500"}
            />
            <p
              className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              {t("graphEditor.backbone.infoMessage")}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3 px-2">
            <button
              onClick={handleSelectAll}
              className={`text-sm font-medium transition-colors ${
                isDark
                  ? "text-primary-400 hover:text-primary-300"
                  : "text-primary-600 hover:text-primary-700"
              }`}
            >
              {selectedIssues.size === issues.length ? t("graphEditor.backbone.deselectAll") : t("graphEditor.backbone.selectAll")}
            </button>
            <span
              className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {t("graphEditor.backbone.selectedCount", { selected: selectedIssues.size, total: issues.length })}
            </span>
          </div>

          <div className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue.nodeId}
                onClick={() => handleToggleIssue(issue.nodeId)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedIssues.has(issue.nodeId)
                    ? isDark
                      ? "border-primary-500 bg-primary-900/20"
                      : "border-primary-500 bg-primary-50"
                    : isDark
                      ? "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 transition-all flex items-center justify-center ${
                      selectedIssues.has(issue.nodeId)
                        ? "bg-primary-600 border-primary-600 text-white"
                        : isDark
                          ? "border-slate-600"
                          : "border-gray-300"
                    }`}
                  >
                    {selectedIssues.has(issue.nodeId) && <Check size={14} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`font-medium ${isDark ? "text-slate-100" : "text-gray-900"}`}
                      >
                        {issue.nodeTitle}
                      </h4>
                      {issue.suggestedModule && (
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `${BACKBONE_MODULE_COLORS[issue.suggestedModule]}20`,
                            color:
                              BACKBONE_MODULE_COLORS[issue.suggestedModule],
                          }}
                        >
                          {t(BACKBONE_MODULE_LABEL_I18N_KEYS[issue.suggestedModule])}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
                    >
                      {getIssueDescription(issue)}
                    </p>
                    {issue.issueType === "invalid_title" &&
                      issue.suggestedTitle && (
                        <div
                          className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}
                        >
                          <span className="line-through opacity-60">
                            {issue.nodeTitle}
                          </span>
                          <span className="mx-2">→</span>
                          <span
                            className={`font-medium ${isDark ? "text-primary-400" : "text-primary-600"}`}
                          >
                            {issue.suggestedTitle}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`px-6 py-4 border-t flex flex-col sm:flex-row gap-3 sm:justify-end ${
            isDark
              ? "border-slate-700 bg-slate-900/50"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <button
            onClick={handleIgnore}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            {t("graphEditor.backbone.ignore")}
          </button>
          <button
            onClick={handleAutoFix}
            disabled={isProcessing || selectedIssues.size === 0}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                {t("graphEditor.backbone.processing")}
              </>
            ) : (
              <>
                <Check size={16} />
                {t("graphEditor.backbone.autoFix", { count: selectedIssues.size })}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

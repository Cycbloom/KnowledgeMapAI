import React, { useState, useEffect, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  GitMerge,
  Network,
  Settings2,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Group,
} from "lucide-react";
import { api } from "../../services/api";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";
import type {
  AnalysisResult,
  ConceptGroup,
  HierarchyRelation,
  AnalyzeOptions,
} from "../../services/api/conceptAggregation";

type TabType = "aggregation" | "hierarchy" | "settings";

interface ConceptAggregationPanelProps {
  graphId: string;
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export const ConceptAggregationPanel: React.FC<ConceptAggregationPanelProps> = ({
  graphId,
  isOpen,
  onClose,
  embedded = false,
}) => {
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<TabType>("aggregation");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [settings, setSettings] = useState<AnalyzeOptions>({
    similarityThreshold: 0.8,
    hierarchyThreshold: 0.7,
  });
  const { t } = useTranslation();

  const isModalOpen = isOpen && !embedded;
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isModalOpen });
  useEscapeKey(() => onClose(), isModalOpen);

  const loadLatestResults = useCallback(async () => {
    try {
      const result = await api.conceptAggregation.getResults(graphId);
      if (result && result.status === "completed") {
        setAnalysisResult(result);
      }
    } catch {
      // ignore errors when loading latest results
    }
  }, [graphId]);

  useEffect(() => {
    if (isOpen && graphId) {
      loadLatestResults();
    }
  }, [isOpen, graphId]);

  useEffect(() => {
    if (currentJobId && isAnalyzing) {
      const pollInterval = setInterval(async () => {
        try {
          const result = await api.conceptAggregation.getResults(
            graphId,
            currentJobId,
          );
          setAnalysisResult(result);
          setProgress(result.progress ?? 0);

          if (result.status === "completed" || result.status === "failed") {
            setIsAnalyzing(false);
            clearInterval(pollInterval);
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [currentJobId, isAnalyzing, graphId]);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisResult(null);

    try {
      const response = await api.conceptAggregation.analyze(graphId, settings);
      setCurrentJobId(response.jobId);
      frontendEventBus.publish("message_show", {
        type: "info",
        content: response.message || "分析任务已启动",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "启动分析失败";
      frontendEventBus.publish("message_show", {
        type: "error",
        content: message,
      });
      setIsAnalyzing(false);
    }
  }, [graphId, settings]);

  if (!isOpen) return null;

  const renderAggregationTab = () => {
    const groups = analysisResult?.groups ?? [];

    if (isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            正在分析概念相似度...
          </p>
          <div className="w-full max-w-xs">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
              {Math.round(progress)}%
            </p>
          </div>
        </div>
      );
    }

    if (!analysisResult || groups.length === 0) {
      return (
        <EmptyState
          icon={<Group className="w-12 h-12 text-gray-400 dark:text-gray-500" />}
          title={t("common.conceptAggregation.noAggregationTitle")}
          description={t("common.conceptAggregation.noAggregationDesc")}
        />
      );
    }

    return (
      <div className="space-y-3">
        {groups.map((group: ConceptGroup, index: number) => (
          <div
            key={group.id || index}
            className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-primary-500" />
                <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                  {group.targetTitle}
                </span>
              </div>
              <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                {(group.similarity * 100).toFixed(0)}% 相似
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium">可合并:</span>{" "}
              {group.sourceTitles.join(", ")}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHierarchyTab = () => {
    const relations = analysisResult?.hierarchyRelations ?? [];

    if (isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            正在分析层次关系...
          </p>
        </div>
      );
    }

    if (!analysisResult || relations.length === 0) {
      return (
        <EmptyState
          icon={<Network className="w-12 h-12 text-gray-400 dark:text-gray-500" />}
          title={t("common.conceptAggregation.noHierarchyTitle")}
          description={t("common.conceptAggregation.noHierarchyDesc")}
        />
      );
    }

    return (
      <div className="space-y-3">
        {relations.map(
          (relation: HierarchyRelation, index: number) => (
            <div
              key={index}
              className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {relation.parentTitle}
                </span>
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  {relation.childTitle}
                </span>
                <span className="ml-auto text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                  {(relation.confidence * 100).toFixed(0)}%
                </span>
              </div>
              {relation.reason && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {relation.reason}
                </p>
              )}
            </div>
          ),
        )}
      </div>
    );
  };

  const renderSettingsTab = () => (
    <div className="space-y-6 p-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          相似度阈值
        </label>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.05"
          value={settings.similarityThreshold ?? 0.8}
          onChange={(e) =>
            setSettings((prev: AnalyzeOptions) => ({
              ...prev,
              similarityThreshold: parseFloat(e.target.value),
            }))
          }
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>宽松</span>
          <span className="font-medium text-primary-600 dark:text-primary-400">
            {(settings.similarityThreshold ?? 0.8) * 100}%
          </span>
          <span>严格</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          层次置信度阈值
        </label>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.05"
          value={settings.hierarchyThreshold ?? 0.7}
          onChange={(e) =>
            setSettings((prev: AnalyzeOptions) => ({
              ...prev,
              hierarchyThreshold: parseFloat(e.target.value),
            }))
          }
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>低</span>
          <span className="font-medium text-primary-600 dark:text-primary-400">
            {(settings.hierarchyThreshold ?? 0.7) * 100}%
          </span>
          <span>高</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          说明
        </h4>
        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li>• 相似度阈值：控制概念聚合的严格程度</li>
          <li>• 层次阈值：控制父子关系识别的可信度</li>
          <li>• 阈值越高，结果越精确但数量越少</li>
        </ul>
      </div>
    </div>
  );

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; count?: number }> = [
    {
      id: "aggregation",
      label: "聚合结果",
      icon: <GitMerge size={16} />,
      count: analysisResult?.groups?.length,
    },
    {
      id: "hierarchy",
      label: "层次树",
      icon: <Network size={16} />,
      count: analysisResult?.hierarchyRelations?.length,
    },
    { id: "settings", label: "设置", icon: <Settings2 size={16} /> },
  ];

  const panelContent = (
    <div
      className={`${
        embedded
          ? "h-full flex flex-col bg-white dark:bg-slate-800"
          : "bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary-500" size={20} />
          <h2 id={titleId} className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            概念聚合
          </h2>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            aria-label="关闭"
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        )}
      </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <Button
                variant="primary"
                size="sm"
                leftIcon={
                  isAnalyzing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )
                }
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "分析中..." : "开始分析"}
              </Button>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {analysisResult?.status === "completed" && (
                  <>
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>分析完成</span>
                  </>
                )}
                {analysisResult?.status === "failed" && (
                  <>
                    <AlertCircle size={14} className="text-red-500" />
                    <span>分析失败</span>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pt-2 pb-0">
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "aggregation" && renderAggregationTab()}
              {activeTab === "hierarchy" && renderHierarchyTab()}
              {activeTab === "settings" && renderSettingsTab()}
            </div>

            {/* Footer */}
            {analysisResult?.summary && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {analysisResult.summary.totalNodes}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      总节点数
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                      {analysisResult.summary.groupCount}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      聚合组数
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {analysisResult.summary.hierarchyCount}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      层次关系
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {((analysisResult.summary.avgSimilarity ?? 0) * 100).toFixed(
                        0,
                      )}
                      %
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      平均相似度
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      );

  if (!isOpen) return null;

  if (embedded) {
    return panelContent;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {panelContent}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export type { TabType };

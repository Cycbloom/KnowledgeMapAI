import React, { useEffect, useState, useCallback, useMemo, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Coins,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAiPerformanceLogs, useAiPerformanceStats, useClearAiPerformanceLogs } from "@/hooks/queries";
import { formatDurationMs as formatDuration, formatDate } from "@/utils/formatters";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { themeClasses } from "@/utils/themeClasses";
import type { AIPerformanceLog, AIProviderType } from "@shared/types";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";

interface PerformanceTabProps {
  isDark: boolean;
}

const EMPTY_LOGS: AIPerformanceLog[] = [];

const formatCost = (cost: number): string => {
  if (cost < 0.01) return `¥${cost.toFixed(4)}`;
  if (cost < 1) return `¥${cost.toFixed(3)}`;
  return `¥${cost.toFixed(2)}`;
};

const formatTokens = (tokens: number): string => {
  if (tokens < 1000) return String(tokens);
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
};

const formatTimestamp = (timestamp: number): string => {
  return formatDate(timestamp, "short-datetime");
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  isDark: boolean;
  color: string;
}> = ({ icon, label, value, subValue, isDark, color }) => (
  <div
    className={`flex items-center gap-2 p-2 rounded-lg ${
      isDark ? "bg-slate-800/50" : "bg-gray-50"
    }`}
  >
    <div className={`p-1.5 rounded-md ${color} shrink-0`}>{icon}</div>
    <div className="min-w-0">
      <div
        className={`text-[10px] ${themeClasses.textSecondary(isDark)}`}
      >
        {label}
      </div>
      <div
        className={`text-sm font-semibold truncate ${isDark ? "text-slate-200" : "text-gray-800"}`}
      >
        {value}
      </div>
      {subValue && (
        <div
          className={`text-[10px] truncate ${themeClasses.textMuted(isDark)}`}
        >
          {subValue}
        </div>
      )}
    </div>
  </div>
);

interface SessionGroupProps {
  logs: AIPerformanceLog[];
  isDark: boolean;
  onSelectLog: (log: AIPerformanceLog) => void;
  getOperationLabel: (operation: string) => string;
}

const getSessionName = (
  logs: AIPerformanceLog[],
  getOperationLabel: (operation: string) => string,
  t: TFunction,
): string => {
  const operations = new Set(logs.map((l) => l.operation));

  if (
    operations.has("auto_graph_init") ||
    operations.has("auto_graph_expand")
  ) {
    return t("console.performance.sessionName.autoGenerate");
  }
  if (
    operations.has("recursive_graph_init") ||
    operations.has("recursive_graph_expand_depth2") ||
    operations.has("recursive_graph_expand_depth3")
  ) {
    const graphIds = new Set(
      logs.map((l) => l.metadata?.graphId).filter(Boolean),
    );
    if (graphIds.size > 1) {
      return t("console.performance.sessionName.batchInit", {
        count: graphIds.size,
      });
    }
    return t("console.performance.sessionName.recursiveGenerate");
  }
  if (
    operations.has("generate_nodes_for_graph") ||
    operations.has("expand_node_for_graph")
  ) {
    return t("console.performance.sessionName.nodeGenerate");
  }
  if (
    operations.has("discover_relations") ||
    operations.has("get_intelligent_suggestions")
  ) {
    return t("console.performance.sessionName.relationAnalysis");
  }
  if (operations.has("chat") || operations.has("tutor_chat")) {
    return t("console.performance.sessionName.aiChat");
  }
  if (
    operations.has("generate_content") ||
    operations.has("generate_content_stream")
  ) {
    return t("console.performance.sessionName.contentGenerate");
  }
  if (operations.has("ai_action_execute")) {
    return t("console.performance.sessionName.aiAction");
  }
  if (operations.has("template_generation")) {
    return t("console.performance.sessionName.template");
  }
  if (
    operations.has("text_to_graph") ||
    operations.has("document_to_graph") ||
    operations.has("image_to_graph")
  ) {
    return t("console.performance.sessionName.docToGraph");
  }
  if (
    operations.has("literature_extract") ||
    operations.has("extractMetadata") ||
    operations.has("extractConcepts")
  ) {
    return t("console.performance.sessionName.literatureExtract");
  }

  const firstLog = logs.sort((a, b) => a.timestamp - b.timestamp)[0];
  return getOperationLabel(firstLog.operation);
};

const SessionGroup: React.FC<SessionGroupProps> = ({
  logs,
  isDark,
  onSelectLog,
  getOperationLabel,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation();

  const sessionStats = useMemo(() => {
    let totalTokens = 0;
    let totalCost = 0;
    let totalDuration = 0;
    let successCount = 0;
    // 单趟统计汇总指标，替代 3 次 reduce + 1 次 filter 的 O(4*logs) 扫描
    for (const l of logs) {
      totalTokens += l.totalTokens;
      totalCost += l.estimatedCost;
      totalDuration += l.duration;
      if (l.success) successCount++;
    }
    return {
      totalTokens,
      totalCost,
      totalDuration,
      successCount,
      total: logs.length,
    };
  }, [logs]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => a.timestamp - b.timestamp),
    [logs],
  );

  const sessionName = useMemo(
    () => getSessionName(logs, getOperationLabel, t),
    [logs, getOperationLabel, t],
  );

  return (
    <div
      className={`border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${
          isDark
            ? "bg-slate-800/30 hover:bg-slate-800/50"
            : "bg-gray-50 hover:bg-gray-100"
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown
              size={14}
              className={themeClasses.textSecondary(isDark)}
            />
          ) : (
            <ChevronRight
              size={14}
              className={themeClasses.textSecondary(isDark)}
            />
          )}
          <Layers
            size={14}
            className={isDark ? "text-primary-400" : "text-primary-600"}
          />
          <span
            className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}
          >
            {sessionName}
          </span>
          <span
            className={`text-xs ${themeClasses.textMuted(isDark)}`}
          >
            ({sessionStats.total} {t("console.performance.requests")})
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={themeClasses.textSecondary(isDark)}>
            {formatTokens(sessionStats.totalTokens)} tokens
          </span>
          <span className={isDark ? "text-amber-400" : "text-amber-600"}>
            {formatCost(sessionStats.totalCost)}
          </span>
          <span className={isDark ? "text-green-400" : "text-green-600"}>
            {formatDuration(sessionStats.totalDuration)}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] ${
              sessionStats.successCount === sessionStats.total
                ? isDark
                  ? "bg-green-900/30 text-green-400"
                  : "bg-green-100 text-green-600"
                : isDark
                  ? "bg-amber-900/30 text-amber-400"
                  : "bg-amber-100 text-amber-600"
            }`}
          >
            {sessionStats.successCount}/{sessionStats.total}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {sortedLogs.map((log) => (
              <motion.button
                key={log.id}
                onClick={() => onSelectLog(log)}
                className={`w-full text-left px-4 py-2.5 pl-10 transition-colors ${
                  isDark ? "hover:bg-slate-800/30" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle
                        size={12}
                        className={isDark ? "text-green-400" : "text-green-500"}
                      />
                    ) : (
                      <XCircle
                        size={12}
                        className={isDark ? "text-red-400" : "text-red-500"}
                      />
                    )}
                    <span
                      className={`text-sm ${isDark ? "text-slate-200" : "text-gray-800"}`}
                    >
                      {getOperationLabel(log.operation)}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        isDark
                          ? "bg-slate-700 text-slate-400"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {log.model}
                    </span>
                  </div>
                  <span
                    className={`text-xs ${themeClasses.textMuted(isDark)}`}
                  >
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs pl-5">
                  <span className={themeClasses.textSecondary(isDark)}>
                    {formatTokens(log.totalTokens)} tokens
                  </span>
                  <span className={themeClasses.textSecondary(isDark)}>
                    {formatCost(log.estimatedCost)}
                  </span>
                  <span className={themeClasses.textSecondary(isDark)}>
                    {formatDuration(log.duration)}
                  </span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LogDetailModal: React.FC<{
  log: AIPerformanceLog;
  isDark: boolean;
  onClose: () => void;
}> = ({ log, isDark, onClose }) => {
  const { t } = useTranslation();

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: true });
  useEscapeKey(() => onClose(), true);
  const titleId = useId();

  const getOperationLabel = (operation: string): string => {
    const key = `console.performance.operations.${operation}`;
    // i18n: dynamic key from runtime operation name (cannot be statically determined)
    const translated = String(t(key as never));
    return translated === key ? operation : translated;
  };

  const metadataLabelKeys = [
    "graphId",
    "graphTitle",
    "userId",
    "userName",
    "nodeId",
    "nodeTitle",
    "nodeLevel",
    "topic",
    "style",
    "depth",
    "actionName",
    "documentName",
    "learningStyle",
    "targetGoal",
    "templateType",
    "text",
    "graph1",
    "graph2",
    "title",
  ];

  const getMetadataLabel = (key: string): string => {
    if (metadataLabelKeys.includes(key)) {
      const translationKey = `console.performance.metadata.${key}`;
      const translated = String(
        t(translationKey as never, { defaultValue: "" }),
      );
      return translated || key;
    }
    return key;
  };

  const priorityOrder = [
    "graphTitle",
    "userName",
    "nodeTitle",
    "topic",
    "style",
    "nodeLevel",
    "depth",
    "actionName",
  ];

  const isPlaceholderValue = (key: string, value: unknown): boolean => {
    if (typeof value !== "string") return false;
    const lowerValue = value.toLowerCase();
    if (
      key === "graphId" &&
      (lowerValue === "temp" || lowerValue === "temporary")
    )
      {return true;}
    if (key === "nodeId") {
      if (
        lowerValue === "node" ||
        lowerValue === "temp" ||
        lowerValue === "temporary"
      )
        {return true;}
      if (/^node[-_]?\d+$/i.test(value)) return true;
    }
    return false;
  };

  const getOrderedMetadata = (): Array<{
    key: string;
    label: string;
    value: unknown;
  }> => {
    if (!log.metadata) return [];

    const entries = Object.entries(log.metadata);
    const metadata = log.metadata as Record<string, unknown>;

    const priorityItems = priorityOrder
      .filter(
        (key) =>
          metadata[key] !== undefined &&
          metadata[key] !== null &&
          metadata[key] !== "" &&
          !isPlaceholderValue(key, metadata[key]),
      )
      .map((key) => ({
        key,
        label: getMetadataLabel(key),
        value: metadata[key],
      }));

    const otherItems = entries
      .filter(([key]) => !priorityOrder.includes(key))
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      )
      .filter(([key, value]) => !isPlaceholderValue(key, value))
      .map(([key, value]) => ({
        key,
        label: getMetadataLabel(key),
        value,
      }));

    return [...priorityItems, ...otherItems];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
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
        className={`w-[560px] max-h-[85vh] rounded-xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-slate-900 border border-slate-700"
            : "bg-white border border-gray-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-4 py-3 border-b flex items-center justify-between ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity
              size={16}
              className={isDark ? "text-primary-400" : "text-primary-600"}
            />
            <h3
              id={titleId}
              className={`font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}
            >
              {t("console.performance.detail.title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors ${
              isDark
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
            }`}
            aria-label={t("common.aria.close")}
          >
            <XCircle size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div
            className={`grid grid-cols-2 gap-x-6 gap-y-3 p-3 rounded-lg ${
              isDark ? "bg-slate-800/50" : "bg-gray-50"
            }`}
          >
            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.operation")}
              </span>
              <div
                className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}
              >
                {getOperationLabel(log.operation)}
              </div>
            </div>

            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.model")}
              </span>
              <div
                className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}
              >
                {log.model}
              </div>
            </div>

            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.provider")}
              </span>
              <div
                className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}
              >
                {log.provider}
              </div>
            </div>

            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.sessionId")}
              </span>
              <div
                className={`text-sm font-medium font-mono ${isDark ? "text-slate-200" : "text-gray-800"}`}
              >
                {log.sessionId ? (
                  <span className="text-primary-500 dark:text-primary-400 text-xs break-all">
                    {log.sessionId}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.status")}
              </span>
              <div
                className={`text-sm font-medium flex items-center gap-1 ${
                  log.success
                    ? isDark
                      ? "text-green-400"
                      : "text-green-600"
                    : isDark
                      ? "text-red-400"
                      : "text-red-600"
                }`}
              >
                {log.success ? (
                  <CheckCircle size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                {log.success
                  ? t("console.performance.success")
                  : t("console.performance.failed")}
              </div>
            </div>

            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.duration")}
              </span>
              <div
                className={`text-sm font-medium flex items-center gap-1 ${isDark ? "text-slate-200" : "text-gray-800"}`}
              >
                <Clock size={12} />
                {formatDuration(log.duration)}
              </div>
            </div>

            <div className="space-y-1">
              <span
                className={`text-xs ${themeClasses.textSecondary(isDark)}`}
              >
                {t("console.performance.detail.time")}
              </span>
              <div
                className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}
              >
                {formatTimestamp(log.timestamp)}
              </div>
            </div>
          </div>

          {log.cachedInputTokens !== undefined && (
            <div
              className={`p-3 rounded-lg ${
                isDark
                  ? "bg-primary-900/20 border border-primary-700/30"
                  : "bg-primary-50 border border-primary-200"
              }`}
            >
              <div
                className={`text-xs font-semibold mb-2 ${isDark ? "text-primary-300" : "text-primary-700"}`}
              >
                {t("console.performance.detail.tokenAnalysis")}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span
                    className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}
                  >
                    {t("console.performance.detail.cachedInput")}
                  </span>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium ${isDark ? "text-green-400" : "text-green-600"}`}
                    >
                      {formatTokens(log.cachedInputTokens)}
                    </span>
                    {log.costBreakdown && (
                      <span
                        className={`ml-2 text-xs ${themeClasses.textSecondary(isDark)}`}
                      >
                        ¥{log.costBreakdown.cachedInputCost.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span
                    className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}
                  >
                    {t("console.performance.detail.uncachedInput")}
                  </span>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium ${isDark ? "text-primary-400" : "text-primary-600"}`}
                    >
                      {formatTokens(log.uncachedInputTokens || 0)}
                    </span>
                    {log.costBreakdown && (
                      <span
                        className={`ml-2 text-xs ${themeClasses.textSecondary(isDark)}`}
                      >
                        ¥{log.costBreakdown.uncachedInputCost.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span
                    className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}
                  >
                    {t("console.performance.detail.outputToken")}
                  </span>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium ${isDark ? "text-primary-400" : "text-primary-600"}`}
                    >
                      {formatTokens(log.outputTokens)}
                    </span>
                    {log.costBreakdown && (
                      <span
                        className={`ml-2 text-xs ${themeClasses.textSecondary(isDark)}`}
                      >
                        ¥{log.costBreakdown.outputCost.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>

                {log.cacheHitRate !== undefined && (
                  <div
                    className="pt-2 mt-2 border-t"
                    style={{ borderColor: isDark ? "#334155" : "#e5e7eb" }}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}
                      >
                        {t("console.performance.detail.cacheHitRate")}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                        >
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{
                              width: `${Math.min(log.cacheHitRate, 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}
                        >
                          {log.cacheHitRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {log.costBreakdown &&
                      log.costBreakdown.savedByCache > 0 && (
                        <div className="mt-2 flex justify-between items-center">
                          <span
                            className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}
                          >
                            {t("console.performance.detail.cacheSaved")}
                          </span>
                          <span className={`text-sm font-bold text-green-500`}>
                            -¥{log.costBreakdown.savedByCache.toFixed(4)}
                          </span>
                        </div>
                      )}
                  </div>
                )}

                {log.reasoningTokens !== undefined &&
                  log.reasoningTokens > 0 && (
                    <div
                      className="pt-2 mt-2 border-t"
                      style={{ borderColor: isDark ? "#334155" : "#e5e7eb" }}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-xs ${isDark ? "text-slate-300" : "text-gray-600"}`}
                        >
                          {t("console.performance.detail.reasoningToken")}
                        </span>
                        <span
                          className={`text-sm font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}
                        >
                          {formatTokens(log.reasoningTokens)}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {log.errorMessage && (
            <div
              className={`p-3 rounded-lg ${
                isDark
                  ? "bg-red-900/20 border border-red-700/30"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div
                className={`text-xs font-medium mb-1 ${isDark ? "text-red-400" : "text-red-600"}`}
              >
                {t("console.performance.detail.errorMessage")}
              </div>
              <div
                className={`text-sm ${isDark ? "text-red-300" : "text-red-700"}`}
              >
                {log.errorMessage}
              </div>
            </div>
          )}

          {(() => {
            const orderedMetadata = getOrderedMetadata();
            if (orderedMetadata.length === 0) return null;

            return (
              <div>
                <div
                  className={`text-xs font-semibold mb-2.5 flex items-center gap-1.5 ${
                    themeClasses.textSecondary(isDark)
                  }`}
                >
                  <Coins size={12} />
                  {t("console.performance.detail.metadataInfo")}
                </div>
                <div
                  className={`rounded-lg overflow-hidden border divide-y ${
                    isDark
                      ? "border-slate-700 bg-slate-800/30 divide-slate-700/50"
                      : "border-gray-200 bg-white divide-gray-100"
                  }`}
                >
                  {orderedMetadata.map(({ key, label, value }) => {
                    const displayValue =
                      typeof value === "string" ? value : JSON.stringify(value);
                    const isLongText = displayValue.length > 60;

                    return (
                      <div
                        key={key}
                        className={`flex items-start justify-between px-3 py-2.5 hover:${
                          isDark ? "bg-slate-700/30" : "bg-gray-50"
                        } transition-colors`}
                      >
                        <span
                          className={`text-xs font-medium shrink-0 w-16 ${
                            themeClasses.textSecondary(isDark)
                          }`}
                        >
                          {label}
                        </span>
                        <span
                          className={`text-xs text-right max-w-[280px] break-all ${
                            isDark ? "text-slate-200" : "text-gray-700"
                          }`}
                          title={isLongText ? displayValue : undefined}
                        >
                          {isLongText
                            ? `${displayValue.slice(0, 57)}...`
                            : displayValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </motion.div>
    </motion.div>
  );
};

export const PerformanceTab: React.FC<PerformanceTabProps> = ({ isDark }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedLog, setSelectedLog] = useState<AIPerformanceLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOperation, setFilterOperation] = useState<string>("");
  const [filterProvider, setFilterProvider] = useState<AIProviderType | "">("");
  const [filterSuccess, setFilterSuccess] = useState<string>("");
  const [timeRange, setTimeRange] = useState<
    "today" | "week" | "month" | "all"
  >("week");
  const [showEmbeddingOps, setShowEmbeddingOps] = useState(false);

  const getOperationLabel = useCallback(
    (operation: string): string => {
      const key = `console.performance.operations.${operation}`;
      // i18n: dynamic key from runtime operation name (cannot be statically determined)
      const translated = String(t(key as never));
      return translated === key ? operation : translated;
    },
    [t],
  );

  const getTimeRangeTimestamp = useCallback(() => {
    const now = Date.now();
    switch (timeRange) {
      case "today":
        return now - 24 * 60 * 60 * 1000;
      case "week":
        return now - 7 * 24 * 60 * 60 * 1000;
      case "month":
        return now - 30 * 24 * 60 * 60 * 1000;
      default:
        return undefined;
    }
  }, [timeRange]);

  // 计算 query 参数
  const startTime = getTimeRangeTimestamp();
  const logsQuery = {
    startTime,
    operation: filterOperation || undefined,
    provider: filterProvider || undefined,
    success: filterSuccess === "" ? undefined : filterSuccess === "true",
    limit: 100,
  };
  const { data: logsData, isLoading, error } = useAiPerformanceLogs(logsQuery);
  const { data: stats } = useAiPerformanceStats({ startTime });
  const { mutateAsync: clearLogsMutate } = useClearAiPerformanceLogs();
  const logs = logsData?.logs ?? EMPTY_LOGS;

  const loadData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["aiPerformanceLogs"] });
    queryClient.invalidateQueries({ queryKey: ["aiPerformanceStats"] });
  }, [queryClient]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearLogs = useCallback(async () => {
    if (await asyncConfirm({ title: t('common.confirm.clearTitle'), message: t("console.performance.clearConfirm"), isDangerous: true })) {
      await clearLogsMutate(undefined);
      // mutation 的 onSuccess 已自动失效缓存，无需手动 loadData
    }
  }, [clearLogsMutate, t]);

  const errorMessage = error instanceof Error ? error.message : error ? t("console.performance.fetchLogsFailed") : null;

  const uniqueOperations = Array.from(
    new Set(logs.map((log) => log.operation)),
  );

  const isEmbeddingOperation = (operation: string): boolean => {
    return operation.toLowerCase().includes("embedding");
  };

  const filteredLogs = showEmbeddingOps
    ? logs
    : logs.filter((log) => !isEmbeddingOperation(log.operation));

  const filteredUniqueOperations = showEmbeddingOps
    ? uniqueOperations
    : uniqueOperations.filter((op) => !isEmbeddingOperation(op));

  const displayStats = useMemo(() => {
    let successCount = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let nonEmbeddingDurationSum = 0;
    let nonEmbeddingCount = 0;
    // 单趟统计过滤后日志的所有指标，替代 3 次 reduce + 2 次 filter 的 O(5*filteredLogs) 扫描
    for (const l of filteredLogs) {
      if (l.success) successCount++;
      totalTokens += l.totalTokens;
      totalCost += l.estimatedCost;
      if (!isEmbeddingOperation(l.operation)) {
        nonEmbeddingDurationSum += l.duration;
        nonEmbeddingCount++;
      }
    }
    const total = filteredLogs.length;
    const failedCount = total - successCount;
    const avgDuration =
      nonEmbeddingCount > 0 ? nonEmbeddingDurationSum / nonEmbeddingCount : 0;

    return {
      total,
      successCount,
      failedCount,
      totalTokens,
      totalCost,
      avgDuration,
    };
  }, [filteredLogs]);

  const { sessionGroups, standaloneLogs } = useMemo(() => {
    const groups = new Map<string, AIPerformanceLog[]>();
    const standalone: AIPerformanceLog[] = [];

    filteredLogs.forEach((log) => {
      if (log.sessionId) {
        const existing = groups.get(log.sessionId) || [];
        existing.push(log);
        groups.set(log.sessionId, existing);
      } else {
        standalone.push(log);
      }
    });

    const sortedGroups = Array.from(groups.entries())
      .map(([sessionId, sessionLogs]) => ({
        sessionId,
        logs: sessionLogs,
        firstTimestamp: Math.min(...sessionLogs.map((l) => l.timestamp)),
      }))
      .sort((a, b) => b.firstTimestamp - a.firstTimestamp);

    const sortedStandalone = standalone.sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    return { sessionGroups: sortedGroups, standaloneLogs: sortedStandalone };
  }, [filteredLogs]);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <div
        className={`px-4 py-3 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity
              size={16}
              className={isDark ? "text-primary-400" : "text-primary-600"}
            />
            <span
              className={`font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}
            >
              {t("console.performance.title")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-md transition-colors ${
                showFilters
                  ? isDark
                    ? "bg-slate-700 text-slate-200"
                    : "bg-gray-200 text-gray-800"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              }`}
              aria-label={t("console.performance.filter")}
              title={t("console.performance.filter")}
            >
              <Filter size={14} aria-hidden="true" />
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className={`p-1.5 rounded-md transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label={t("console.performance.refresh")}
              title={t("console.performance.refresh")}
            >
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
                aria-hidden="true"
              />
            </button>
            <button
              onClick={handleClearLogs}
              className={`p-1.5 rounded-md transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-red-400 hover:bg-slate-700"
                  : "text-gray-500 hover:text-red-500 hover:bg-gray-200"
              }`}
              aria-label={t("console.performance.clearLogs")}
              title={t("console.performance.clearLogs")}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pb-2">
                <select
                  value={timeRange}
                  onChange={(e) =>
                    setTimeRange(e.target.value as typeof timeRange)
                  }
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300"
                  }`}
                >
                  <option value="today">
                    {t("console.performance.timeRange.today")}
                  </option>
                  <option value="week">
                    {t("console.performance.timeRange.week")}
                  </option>
                  <option value="month">
                    {t("console.performance.timeRange.month")}
                  </option>
                  <option value="all">
                    {t("console.performance.timeRange.all")}
                  </option>
                </select>
                <select
                  value={filterOperation}
                  onChange={(e) => setFilterOperation(e.target.value)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300"
                  }`}
                >
                  <option value="">
                    {t("console.performance.allOperations")}
                  </option>
                  {filteredUniqueOperations.map((op) => (
                    <option key={op} value={op}>
                      {getOperationLabel(op)}
                    </option>
                  ))}
                </select>
                <label
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border cursor-pointer select-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={showEmbeddingOps}
                    onChange={(e) => setShowEmbeddingOps(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{t("console.performance.showEmbedding")}</span>
                </label>
                <select
                  value={filterProvider}
                  onChange={(e) =>
                    setFilterProvider(e.target.value as AIProviderType | "")
                  }
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300"
                  }`}
                >
                  <option value="">
                    {t("console.performance.allProviders")}
                  </option>
                  <option value="deepseek">
                    {t("console.performance.providers.deepseek")}
                  </option>
                  <option value="volcengine">
                    {t("console.performance.providers.volcengine")}
                  </option>
                  <option value="aliyun">
                    {t("console.performance.providers.aliyun")}
                  </option>
                </select>
                <select
                  value={filterSuccess}
                  onChange={(e) => setFilterSuccess(e.target.value)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300"
                  }`}
                >
                  <option value="">{t("console.performance.allStatus")}</option>
                  <option value="true">
                    {t("console.performance.success")}
                  </option>
                  <option value="false">
                    {t("console.performance.failed")}
                  </option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stats && (
        <div
          className={`grid grid-cols-4 gap-2 p-3 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
        >
          <StatCard
            icon={<Activity size={14} className="text-white" />}
            label={t("console.performance.stats.totalRequests")}
            value={String(displayStats.total)}
            subValue={`${displayStats.successCount}/${displayStats.failedCount}`}
            isDark={isDark}
            color="bg-primary-500"
          />
          <StatCard
            icon={<Zap size={14} className="text-white" />}
            label={t("console.performance.stats.tokens")}
            value={formatTokens(displayStats.totalTokens)}
            isDark={isDark}
            color="bg-primary-500"
          />
          <StatCard
            icon={<Coins size={14} className="text-white" />}
            label={t("console.performance.stats.cost")}
            value={formatCost(displayStats.totalCost)}
            isDark={isDark}
            color="bg-amber-500"
          />
          <StatCard
            icon={<Clock size={14} className="text-white" />}
            label={t("console.performance.stats.duration")}
            value={formatDuration(displayStats.avgDuration)}
            isDark={isDark}
            color="bg-green-500"
          />
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        role="region"
        aria-label={t("console.performance.scrollRegion")}
      >
        {errorMessage && (
          <div
            className={`p-4 text-center ${isDark ? "text-red-400" : "text-red-600"}`}
          >
            {errorMessage}
          </div>
        )}

        {isLoading && logs.length === 0 ? (
          <div
            className={`p-4 text-center ${themeClasses.textSecondary(isDark)}`}
          >
            {t("console.performance.loading")}
          </div>
        ) : logs.length === 0 ? (
          <div
            className={`p-8 text-center ${themeClasses.textMuted(isDark)}`}
          >
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("console.performance.noData")}</p>
            <p className="text-xs mt-1 opacity-75">
              {t("console.performance.noDataHint")}
            </p>
          </div>
        ) : (
          <div>
            {filteredLogs.length === 0 ? (
              <div
                className={`text-center py-8 ${themeClasses.textSecondary(isDark)}`}
              >
                <Activity size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t("console.performance.noLogs")}</p>
                {!showEmbeddingOps && (
                  <button
                    onClick={() => setShowEmbeddingOps(true)}
                    className={`mt-2 text-xs underline ${isDark ? "text-primary-400" : "text-primary-600"}`}
                  >
                    {t("console.performance.showEmbeddingOps")}
                  </button>
                )}
              </div>
            ) : (
              <>
                {sessionGroups.map((group) => (
                  <SessionGroup
                    key={group.sessionId}
                    logs={group.logs}
                    isDark={isDark}
                    onSelectLog={setSelectedLog}
                    getOperationLabel={getOperationLabel}
                  />
                ))}
                {standaloneLogs.length > 0 && sessionGroups.length > 0 && (
                  <div
                    className={`px-4 py-2 text-xs font-medium ${
                      isDark
                        ? "text-slate-500 bg-slate-900/50"
                        : "text-gray-400 bg-gray-100"
                    }`}
                  >
                    {t("console.performance.standaloneRequests")}
                  </div>
                )}
                {standaloneLogs.map((log) => (
                  <motion.button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left px-4 py-3 transition-colors border-b ${
                      isDark
                        ? "hover:bg-slate-800/50 border-slate-700"
                        : "hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle
                            size={14}
                            className={
                              isDark ? "text-green-400" : "text-green-500"
                            }
                          />
                        ) : (
                          <XCircle
                            size={14}
                            className={isDark ? "text-red-400" : "text-red-500"}
                          />
                        )}
                        <span
                          className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}
                        >
                          {getOperationLabel(log.operation)}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            isDark
                              ? "bg-slate-700 text-slate-400"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {log.model}
                        </span>
                      </div>
                      <span
                        className={`text-xs ${themeClasses.textMuted(isDark)}`}
                      >
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs">
                      <span
                        className={themeClasses.textSecondary(isDark)}
                      >
                        {formatTokens(log.totalTokens)} tokens
                      </span>
                      <span
                        className={themeClasses.textSecondary(isDark)}
                      >
                        {formatCost(log.estimatedCost)}
                      </span>
                      <span
                        className={themeClasses.textSecondary(isDark)}
                      >
                        {formatDuration(log.duration)}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedLog && (
          <LogDetailModal
            log={selectedLog}
            isDark={isDark}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

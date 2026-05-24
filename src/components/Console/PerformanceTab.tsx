import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { useAIPerformanceStore } from "@/store/useAIPerformanceStore";
import type { AIPerformanceLog, AIProviderType } from "@shared/types";

interface PerformanceTabProps {
  isDark: boolean;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
};

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
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        className={`text-[10px] ${isDark ? "text-slate-400" : "text-gray-500"}`}
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
          className={`text-[10px] truncate ${isDark ? "text-slate-500" : "text-gray-400"}`}
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

const getSessionName = (logs: AIPerformanceLog[], getOperationLabel: (operation: string) => string): string => {
  const operations = new Set(logs.map((l) => l.operation));

  if (operations.has('auto_graph_init') || operations.has('auto_graph_expand')) {
    return '图谱自动生成';
  }
  if (operations.has('recursive_graph_init') || operations.has('recursive_graph_expand_depth2') || operations.has('recursive_graph_expand_depth3')) {
    const graphIds = new Set(logs.map((l) => l.metadata?.graphId).filter(Boolean));
    if (graphIds.size > 1) {
      return `批量初始化知识图谱（${graphIds.size} 个图谱）`;
    }
    return '递归图谱生成';
  }
  if (operations.has('generate_nodes_for_graph') || operations.has('expand_node_for_graph')) {
    return '图谱节点生成';
  }
  if (operations.has('discover_relations') || operations.has('get_intelligent_suggestions')) {
    return '图谱关系分析';
  }
  if (operations.has('chat') || operations.has('tutor_chat')) {
    return 'AI 对话';
  }
  if (operations.has('generate_content') || operations.has('generate_content_stream')) {
    return '内容生成';
  }
  if (operations.has('ai_action_execute')) {
    return 'AI 动作执行';
  }
  if (operations.has('template_generation')) {
    return '模板生成';
  }
  if (operations.has('text_to_graph') || operations.has('document_to_graph') || operations.has('image_to_graph')) {
    return '文档转图谱';
  }
  if (operations.has('literature_extract') || operations.has('extractMetadata') || operations.has('extractConcepts')) {
    return '文献提取';
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
    const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.estimatedCost, 0);
    const totalDuration = logs.reduce((sum, l) => sum + l.duration, 0);
    const successCount = logs.filter((l) => l.success).length;
    return { totalTokens, totalCost, totalDuration, successCount, total: logs.length };
  }, [logs]);

  const sortedLogs = useMemo(() => 
    [...logs].sort((a, b) => a.timestamp - b.timestamp),
    [logs]
  );

  const sessionName = useMemo(() => 
    getSessionName(logs, getOperationLabel),
    [logs, getOperationLabel]
  );

  return (
    <div className={`border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${
          isDark ? "bg-slate-800/30 hover:bg-slate-800/50" : "bg-gray-50 hover:bg-gray-100"
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown size={14} className={isDark ? "text-slate-400" : "text-gray-500"} />
          ) : (
            <ChevronRight size={14} className={isDark ? "text-slate-400" : "text-gray-500"} />
          )}
          <Layers size={14} className={isDark ? "text-primary-400" : "text-primary-600"} />
          <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
            {sessionName}
          </span>
          <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>
            ({sessionStats.total} {t('console.performance.requests')})
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={isDark ? "text-slate-400" : "text-gray-500"}>
            {formatTokens(sessionStats.totalTokens)} tokens
          </span>
          <span className={isDark ? "text-amber-400" : "text-amber-600"}>
            {formatCost(sessionStats.totalCost)}
          </span>
          <span className={isDark ? "text-green-400" : "text-green-600"}>
            {formatDuration(sessionStats.totalDuration)}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            sessionStats.successCount === sessionStats.total
              ? isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
              : isDark ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-600"
          }`}>
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
                      <CheckCircle size={12} className={isDark ? "text-green-400" : "text-green-500"} />
                    ) : (
                      <XCircle size={12} className={isDark ? "text-red-400" : "text-red-500"} />
                    )}
                    <span className={`text-sm ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                      {getOperationLabel(log.operation)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500"
                    }`}>
                      {log.model}
                    </span>
                  </div>
                  <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs pl-5">
                  <span className={isDark ? "text-slate-400" : "text-gray-500"}>
                    {formatTokens(log.totalTokens)} tokens
                  </span>
                  <span className={isDark ? "text-slate-400" : "text-gray-500"}>
                    {formatCost(log.estimatedCost)}
                  </span>
                  <span className={isDark ? "text-slate-400" : "text-gray-500"}>
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

  const getOperationLabel = (operation: string): string => {
    const key = `console.performance.operations.${operation}`;
    const translated = t(key);
    return translated === key ? operation : translated;
  };

  const metadataLabels: Record<string, string> = {
    graphId: '图谱ID',
    graphTitle: '图谱标题',
    userId: '用户ID',
    userName: '用户名',
    nodeId: '节点ID',
    nodeTitle: '节点名称',
    nodeLevel: '节点层级',
    topic: '主题',
    style: '风格',
    depth: '深度',
    actionName: '动作名称',
    documentName: '文档名称',
    learningStyle: '学习风格',
    targetGoal: '目标',
    templateType: '模板类型',
    text: '文本内容',
    graph1: '图谱1',
    graph2: '图谱2',
    title: '标题',
  };

  const priorityOrder = ['graphTitle', 'userName', 'nodeTitle', 'topic', 'style', 'nodeLevel', 'depth', 'actionName'];

  const isPlaceholderValue = (key: string, value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const lowerValue = value.toLowerCase();
    if (key === 'graphId' && (lowerValue === 'temp' || lowerValue === 'temporary')) return true;
    if (key === 'nodeId') {
      if (lowerValue === 'node' || lowerValue === 'temp' || lowerValue === 'temporary') return true;
      if (/^node[-_]?\d+$/i.test(value)) return true;
    }
    return false;
  };

  const getOrderedMetadata = (): Array<{ key: string; label: string; value: unknown }> => {
    if (!log.metadata) return [];

    const entries = Object.entries(log.metadata);
    const metadata = log.metadata as Record<string, unknown>;

    const priorityItems = priorityOrder
      .filter(key => metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '' && !isPlaceholderValue(key, metadata[key]))
      .map(key => ({
        key,
        label: metadataLabels[key] || key,
        value: metadata[key],
      }));

    const otherItems = entries
      .filter(([key]) => !priorityOrder.includes(key))
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .filter(([key, value]) => !isPlaceholderValue(key, value))
      .map(([key, value]) => ({
        key,
        label: metadataLabels[key] || key,
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
            <Activity size={16} className={isDark ? "text-primary-400" : "text-primary-600"} />
            <h3 className={`font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>
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
          >
            <XCircle size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className={`grid grid-cols-2 gap-x-6 gap-y-3 p-3 rounded-lg ${
            isDark ? "bg-slate-800/50" : "bg-gray-50"
          }`}>
            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.operation")}
              </span>
              <div className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                {getOperationLabel(log.operation)}
              </div>
            </div>

            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.model")}
              </span>
              <div className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                {log.model}
              </div>
            </div>

            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.provider")}
              </span>
              <div className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                {log.provider}
              </div>
            </div>

            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.sessionId")}
              </span>
              <div className={`text-sm font-medium font-mono ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                {log.sessionId ? (
                  <span className="text-primary-500 dark:text-primary-400 text-xs break-all">{log.sessionId}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.status")}
              </span>
              <div className={`text-sm font-medium flex items-center gap-1 ${
                log.success
                  ? isDark ? "text-green-400" : "text-green-600"
                  : isDark ? "text-red-400" : "text-red-600"
              }`}>
                {log.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {log.success ? t("console.performance.success") : t("console.performance.failed")}
              </div>
            </div>

            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.duration")}
              </span>
              <div className={`text-sm font-medium flex items-center gap-1 ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                <Clock size={12} />
                {formatDuration(log.duration)}
              </div>
            </div>

            <div className="space-y-1">
              <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                {t("console.performance.detail.time")}
              </span>
              <div className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                {formatTimestamp(log.timestamp)}
              </div>
            </div>
          </div>

          {log.cachedInputTokens !== undefined && log.cachedInputTokens > 0 && (
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
                        className={`ml-2 text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
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
                        className={`ml-2 text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
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
                        className={`ml-2 text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
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
            <div className={`p-3 rounded-lg ${
              isDark ? "bg-red-900/20 border border-red-700/30" : "bg-red-50 border border-red-200"
            }`}>
              <div className={`text-xs font-medium mb-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                错误信息
              </div>
              <div className={`text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>
                {log.errorMessage}
              </div>
            </div>
          )}

          {(() => {
            const orderedMetadata = getOrderedMetadata();
            if (orderedMetadata.length === 0) return null;

            return (
              <div>
                <div className={`text-xs font-semibold mb-2.5 flex items-center gap-1.5 ${
                  isDark ? "text-slate-400" : "text-gray-500"
                }`}>
                  <Coins size={12} />
                  元数据信息
                </div>
                <div className={`rounded-lg overflow-hidden border divide-y ${
                  isDark ? "border-slate-700 bg-slate-800/30 divide-slate-700/50" : "border-gray-200 bg-white divide-gray-100"
                }`}>
                  {orderedMetadata.map(({ key, label, value }) => {
                    const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
                    const isLongText = displayValue.length > 60;

                    return (
                      <div
                        key={key}
                        className={`flex items-start justify-between px-3 py-2.5 hover:${
                          isDark ? "bg-slate-700/30" : "bg-gray-50"
                        } transition-colors`}
                      >
                        <span className={`text-xs font-medium shrink-0 w-16 ${
                          isDark ? "text-slate-400" : "text-gray-500"
                        }`}>
                          {label}
                        </span>
                        <span 
                          className={`text-xs text-right max-w-[280px] break-all ${
                            isDark ? "text-slate-200" : "text-gray-700"
                          }`} 
                          title={isLongText ? displayValue : undefined}
                        >
                          {isLongText ? `${displayValue.slice(0, 57)}...` : displayValue}
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
  const { logs, stats, isLoading, error, fetchLogs, fetchStats, clearLogs } = useAIPerformanceStore();
  const [selectedLog, setSelectedLog] = useState<AIPerformanceLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOperation, setFilterOperation] = useState<string>("");
  const [filterProvider, setFilterProvider] = useState<AIProviderType | "">("");
  const [filterSuccess, setFilterSuccess] = useState<string>("");
  const [timeRange, setTimeRange] = useState<
    "today" | "week" | "month" | "all"
  >("week");
  const [showEmbeddingOps, setShowEmbeddingOps] = useState(false);

  const getOperationLabel = useCallback((operation: string): string => {
    const key = `console.performance.operations.${operation}`;
    const translated = t(key);
    return translated === key ? operation : translated;
  }, [t]);

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

  const loadData = useCallback(async () => {
    const startTime = getTimeRangeTimestamp();
    const query = {
      startTime,
      operation: filterOperation || undefined,
      provider: filterProvider || undefined,
      success: filterSuccess === "" ? undefined : filterSuccess === "true",
      limit: 100,
    };
    await Promise.all([fetchLogs(query), fetchStats({ startTime })]);
  }, [
    getTimeRangeTimestamp,
    filterOperation,
    filterProvider,
    filterSuccess,
    fetchLogs,
    fetchStats,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearLogs = useCallback(async () => {
    if (window.confirm(t('console.performance.clearConfirm'))) {
      await clearLogs();
      loadData();
    }
  }, [clearLogs, loadData, t]);

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
    const total = filteredLogs.length;
    const successCount = filteredLogs.filter((l) => l.success).length;
    const failedCount = total - successCount;
    const totalTokens = filteredLogs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalCost = filteredLogs.reduce((sum, l) => sum + l.estimatedCost, 0);
    const nonEmbeddingFiltered = filteredLogs.filter(
      (l) => !isEmbeddingOperation(l.operation),
    );
    const avgDuration =
      nonEmbeddingFiltered.length > 0
        ? nonEmbeddingFiltered.reduce((sum, l) => sum + l.duration, 0) /
          nonEmbeddingFiltered.length
        : 0;

    return { total, successCount, failedCount, totalTokens, totalCost, avgDuration };
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

    const sortedStandalone = standalone.sort((a, b) => b.timestamp - a.timestamp);

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
              {t('console.performance.title')}
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
              title={t('console.performance.filter')}
            >
              <Filter size={14} />
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className={`p-1.5 rounded-md transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              title={t('console.performance.refresh')}
            >
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
            <button
              onClick={handleClearLogs}
              className={`p-1.5 rounded-md transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-red-400 hover:bg-slate-700"
                  : "text-gray-500 hover:text-red-500 hover:bg-gray-200"
              }`}
              title={t('console.performance.clearLogs')}
            >
              <Trash2 size={14} />
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
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <option value="today">{t('console.performance.timeRange.today')}</option>
                  <option value="week">{t('console.performance.timeRange.week')}</option>
                  <option value="month">{t('console.performance.timeRange.month')}</option>
                  <option value="all">{t('console.performance.timeRange.all')}</option>
                </select>
                <select
                  value={filterOperation}
                  onChange={(e) => setFilterOperation(e.target.value)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <option value="">{t('console.performance.allOperations')}</option>
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
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={showEmbeddingOps}
                    onChange={(e) => setShowEmbeddingOps(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{t('console.performance.showEmbedding')}</span>
                </label>
                <select
                  value={filterProvider}
                  onChange={(e) =>
                    setFilterProvider(e.target.value as AIProviderType | "")
                  }
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <option value="">{t('console.performance.allProviders')}</option>
                  <option value="deepseek">{t('console.performance.providers.deepseek')}</option>
                  <option value="volcengine">{t('console.performance.providers.volcengine')}</option>
                  <option value="aliyun">{t('console.performance.providers.aliyun')}</option>
                </select>
                <select
                  value={filterSuccess}
                  onChange={(e) => setFilterSuccess(e.target.value)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <option value="">{t('console.performance.allStatus')}</option>
                  <option value="true">{t('console.performance.success')}</option>
                  <option value="false">{t('console.performance.failed')}</option>
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
            label={t('console.performance.stats.totalRequests')}
            value={String(displayStats.total)}
            subValue={`${displayStats.successCount}/${displayStats.failedCount}`}
            isDark={isDark}
            color="bg-primary-500"
          />
          <StatCard
            icon={<Zap size={14} className="text-white" />}
            label={t('console.performance.stats.tokens')}
            value={formatTokens(displayStats.totalTokens)}
            isDark={isDark}
            color="bg-primary-500"
          />
          <StatCard
            icon={<Coins size={14} className="text-white" />}
            label={t('console.performance.stats.cost')}
            value={formatCost(displayStats.totalCost)}
            isDark={isDark}
            color="bg-amber-500"
          />
          <StatCard
            icon={<Clock size={14} className="text-white" />}
            label={t('console.performance.stats.duration')}
            value={formatDuration(displayStats.avgDuration)}
            isDark={isDark}
            color="bg-green-500"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {error && (
          <div
            className={`p-4 text-center ${isDark ? "text-red-400" : "text-red-600"}`}
          >
            {error}
          </div>
        )}

        {isLoading && logs.length === 0 ? (
          <div className={`p-4 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {t('console.performance.loading')}
          </div>
        ) : logs.length === 0 ? (
          <div className={`p-8 text-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('console.performance.noData')}</p>
            <p className="text-xs mt-1 opacity-75">{t('console.performance.noDataHint')}</p>
          </div>
        ) : (
          <div>
            {filteredLogs.length === 0 ? (
              <div
                className={`text-center py-8 ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                <Activity size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('console.performance.noLogs')}</p>
                {!showEmbeddingOps && (
                  <button
                    onClick={() => setShowEmbeddingOps(true)}
                    className={`mt-2 text-xs underline ${isDark ? "text-primary-400" : "text-primary-600"}`}
                  >
                    {t('console.performance.showEmbeddingOps')}
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
                  <div className={`px-4 py-2 text-xs font-medium ${
                    isDark ? "text-slate-500 bg-slate-900/50" : "text-gray-400 bg-gray-100"
                  }`}>
                    {t('console.performance.standaloneRequests')}
                  </div>
                )}
                {standaloneLogs.map((log) => (
                  <motion.button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left px-4 py-3 transition-colors border-b ${
                      isDark ? "hover:bg-slate-800/50 border-slate-700" : "hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle size={14} className={isDark ? "text-green-400" : "text-green-500"} />
                        ) : (
                          <XCircle size={14} className={isDark ? "text-red-400" : "text-red-500"} />
                        )}
                        <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                          {getOperationLabel(log.operation)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500"
                        }`}>
                          {log.model}
                        </span>
                      </div>
                      <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs">
                      <span className={isDark ? "text-slate-400" : "text-gray-500"}>
                        {formatTokens(log.totalTokens)} tokens
                      </span>
                      <span className={isDark ? "text-slate-400" : "text-gray-500"}>
                        {formatCost(log.estimatedCost)}
                      </span>
                      <span className={isDark ? "text-slate-400" : "text-gray-500"}>
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

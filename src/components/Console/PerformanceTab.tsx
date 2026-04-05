import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { useAIPerformanceStore } from '@/store/useAIPerformanceStore';
import type { AIPerformanceLog, AIProviderType } from '@shared/types';

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
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const OPERATION_LABELS: Record<string, string> = {
  'generate-content': '生成内容',
  'expand-knowledge': '扩展知识',
  'annotate-terms': '术语标注',
  'generate-cards': '生成卡片',
  'chat': '对话',
  'tutor-chat': '导师对话',
  'extract-concepts': '提取概念',
  'text-to-graph': '文本转图谱',
  'document-to-graph': '文档转图谱',
  'branch-suggestions': '分支建议',
  'cross-graph-connections': '跨图谱连接',
  'podcast-script': '播客脚本',
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  isDark: boolean;
  color: string;
}> = ({ icon, label, value, subValue, isDark, color }) => (
  <div className={`flex items-center gap-2 p-2 rounded-lg ${
    isDark ? 'bg-slate-800/50' : 'bg-gray-50'
  }`}>
    <div className={`p-1.5 rounded-md ${color} shrink-0`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        {label}
      </div>
      <div className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
        {value}
      </div>
      {subValue && (
        <div className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          {subValue}
        </div>
      )}
    </div>
  </div>
);

const LogDetailModal: React.FC<{
  log: AIPerformanceLog;
  isDark: boolean;
  onClose: () => void;
}> = ({ log, isDark, onClose }) => (
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
      className={`w-[500px] max-h-[80vh] rounded-xl shadow-2xl overflow-hidden ${
        isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'
      }`}>
        <h3 className={`font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
          请求详情
        </h3>
        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
          }`}
        >
          <XCircle size={16} />
        </button>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>操作类型</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {OPERATION_LABELS[log.operation] || log.operation}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>模型</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {log.model}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>提供商</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {log.provider}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>状态</div>
            <div className={`text-sm font-medium flex items-center gap-1 ${
              log.success ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')
            }`}>
              {log.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {log.success ? '成功' : '失败'}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>输入 Token</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {formatTokens(log.inputTokens)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>输出 Token</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {formatTokens(log.outputTokens)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>总 Token</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {formatTokens(log.totalTokens)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>预估成本</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {formatCost(log.estimatedCost)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>耗时</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {formatDuration(log.duration)}
            </div>
          </div>
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>时间</div>
            <div className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {formatTimestamp(log.timestamp)}
            </div>
          </div>
        </div>
        {log.errorMessage && (
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>错误信息</div>
            <div className={`text-sm p-2 rounded-md mt-1 ${
              isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
            }`}>
              {log.errorMessage}
            </div>
          </div>
        )}
        {log.metadata && (
          <div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>元数据</div>
            <pre className={`text-xs p-2 rounded-md mt-1 overflow-x-auto ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'
            }`}>
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </motion.div>
  </motion.div>
);

export const PerformanceTab: React.FC<PerformanceTabProps> = ({ isDark }) => {
  const { logs, stats, isLoading, error, fetchLogs, fetchStats, clearLogs } = useAIPerformanceStore();
  const [selectedLog, setSelectedLog] = useState<AIPerformanceLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterOperation, setFilterOperation] = useState<string>('');
  const [filterProvider, setFilterProvider] = useState<AIProviderType | ''>('');
  const [filterSuccess, setFilterSuccess] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  const getTimeRangeTimestamp = useCallback(() => {
    const now = Date.now();
    switch (timeRange) {
      case 'today':
        return now - 24 * 60 * 60 * 1000;
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
      case 'month':
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
      success: filterSuccess === '' ? undefined : filterSuccess === 'true',
      limit: 100,
    };
    await Promise.all([fetchLogs(query), fetchStats({ startTime })]);
  }, [getTimeRangeTimestamp, filterOperation, filterProvider, filterSuccess, fetchLogs, fetchStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearLogs = useCallback(async () => {
    if (window.confirm('确定要清除所有性能日志吗？此操作不可撤销。')) {
      await clearLogs();
      loadData();
    }
  }, [clearLogs, loadData]);

  const uniqueOperations = Array.from(new Set(logs.map((log) => log.operation)));

  return (
    <div className="w-full h-full flex flex-col">
      <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              AI 性能监控
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-md transition-colors ${
                showFilters
                  ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-800'
                  : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
              title="筛选"
            >
              <Filter size={14} />
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className={`p-1.5 rounded-md transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="刷新"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleClearLogs}
              className={`p-1.5 rounded-md transition-colors ${
                isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-gray-500 hover:text-red-500 hover:bg-gray-200'
              }`}
              title="清除日志"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pb-2">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <option value="today">今天</option>
                  <option value="week">最近一周</option>
                  <option value="month">最近一月</option>
                  <option value="all">全部</option>
                </select>
                <select
                  value={filterOperation}
                  onChange={(e) => setFilterOperation(e.target.value)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <option value="">全部操作</option>
                  {uniqueOperations.map((op) => (
                    <option key={op} value={op}>
                      {OPERATION_LABELS[op] || op}
                    </option>
                  ))}
                </select>
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value as AIProviderType | '')}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <option value="">全部提供商</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="volcengine">火山引擎</option>
                  <option value="aliyun">阿里云</option>
                </select>
                <select
                  value={filterSuccess}
                  onChange={(e) => setFilterSuccess(e.target.value)}
                  className={`px-2 py-1 text-xs rounded-md border outline-none ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <option value="">全部状态</option>
                  <option value="true">成功</option>
                  <option value="false">失败</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stats && (
        <div className={`grid grid-cols-4 gap-2 p-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <StatCard
            icon={<Activity size={14} className="text-white" />}
            label="总请求"
            value={String(stats.totalRequests)}
            subValue={`${stats.successRequests}/${stats.failedRequests}`}
            isDark={isDark}
            color="bg-blue-500"
          />
          <StatCard
            icon={<Zap size={14} className="text-white" />}
            label="Token"
            value={formatTokens(stats.totalTokens)}
            isDark={isDark}
            color="bg-purple-500"
          />
          <StatCard
            icon={<Coins size={14} className="text-white" />}
            label="成本"
            value={formatCost(stats.totalCost)}
            isDark={isDark}
            color="bg-amber-500"
          />
          <StatCard
            icon={<Clock size={14} className="text-white" />}
            label="耗时"
            value={formatDuration(stats.avgDuration)}
            isDark={isDark}
            color="bg-green-500"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {error && (
          <div className={`p-4 text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            {error}
          </div>
        )}
        
        {isLoading && logs.length === 0 ? (
          <div className={`p-4 text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            加载中...
          </div>
        ) : logs.length === 0 ? (
          <div className={`p-8 text-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无性能数据</p>
            <p className="text-xs mt-1 opacity-75">使用 AI 功能后将自动记录</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log, index) => (
              <motion.button
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.01 }}
                onClick={() => setSelectedLog(log)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isDark ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle size={14} className={isDark ? 'text-green-400' : 'text-green-500'} />
                    ) : (
                      <XCircle size={14} className={isDark ? 'text-red-400' : 'text-red-500'} />
                    )}
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                      {OPERATION_LABELS[log.operation] || log.operation}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {log.model}
                    </span>
                  </div>
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs">
                  <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>
                    {formatTokens(log.totalTokens)} tokens
                  </span>
                  <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>
                    {formatCost(log.estimatedCost)}
                  </span>
                  <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>
                    {formatDuration(log.duration)}
                  </span>
                </div>
              </motion.button>
            ))}
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

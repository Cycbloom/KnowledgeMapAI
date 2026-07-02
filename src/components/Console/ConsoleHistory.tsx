import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Clock, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';
import type { CommandHistoryItem } from '@/services/console';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { EmptyState } from '@/components/common/EmptyState';

interface ConsoleHistoryProps {
  history: CommandHistoryItem[];
  onSelect: (command: string) => void;
  onClear: () => void;
  isDark: boolean;
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ConsoleHistory: React.FC<ConsoleHistoryProps> = ({
  history,
  onSelect,
  onClear,
  isDark,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;

    const query = searchQuery.toLowerCase();
    return history.filter((item) =>
      item.command.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  const handleItemClick = useCallback((command: string) => {
    onSelect(command);
  }, [onSelect]);

  const handleClearClick = useCallback(async () => {
    if (await asyncConfirm({ title: '清空历史记录', message: '确定要清空所有历史记录吗？', isDangerous: true })) {
      onClear();
    }
  }, [onClear]);

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
      <div className={`px-3 py-2 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isDark ? 'text-slate-400' : 'text-gray-500'
          }`}>
            历史记录
          </span>
          {history.length > 0 && (
            <button
              onClick={handleClearClick}
              className={`p-1 rounded transition-colors ${
                isDark
                  ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
                  : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
              }`}
              title="清空历史"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="relative">
          <Search size={12} className={`absolute left-2 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-slate-500' : 'text-gray-400'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索..."
            className={`w-full pl-7 pr-2 py-1 text-xs rounded-md border outline-none transition-colors ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-300 placeholder-slate-500 focus:border-slate-600'
                : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:border-gray-300'
            }`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredHistory.length === 0 ? (
          <EmptyState
            illustration={searchQuery ? 'search' : 'empty'}
            title={searchQuery ? t('console.noSearchResultsTitle') : t('console.noHistoryTitle')}
            description={searchQuery ? t('console.noSearchResultsDesc') : t('console.noHistoryDesc')}
            className="min-h-[160px] py-8"
          />
        ) : (
          <div className="py-1">
            {filteredHistory.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleItemClick(item.command)}
                className={`w-full text-left px-3 py-2 transition-colors group ${
                  isDark
                    ? 'hover:bg-slate-700/50'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {item.result?.success === false ? (
                      <XCircle size={12} className={isDark ? 'text-red-400' : 'text-red-500'} />
                    ) : item.result?.success === true ? (
                      <CheckCircle size={12} className={isDark ? 'text-green-400' : 'text-green-500'} />
                    ) : (
                      <Clock size={12} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-mono truncate ${
                      isDark ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      {item.command}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${
                      isDark ? 'text-slate-500' : 'text-gray-400'
                    }`}>
                      {formatTime(item.timestamp)}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className={`px-3 py-1.5 border-t text-[10px] ${
          isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'
        }`}>
          共 {history.length} 条记录
        </div>
      )}
    </div>
  );
};

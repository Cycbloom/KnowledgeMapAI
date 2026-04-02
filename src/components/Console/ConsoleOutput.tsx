import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, CheckCircle, XCircle, Info, Trash2 } from 'lucide-react';
import type { CommandResult } from '@/services/console';

interface OutputItem {
  type: 'input' | 'output';
  content: string;
  result?: CommandResult;
}

interface ConsoleOutputProps {
  output: OutputItem[];
  isDark: boolean;
  onClear: () => void;
}

export interface ConsoleOutputRef {
  scrollToBottom: () => void;
}

const formatValue = (value: unknown, indent: number = 0): string => {
  const indentStr = '  '.repeat(indent);

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => formatValue(item, indent + 1));
    return `[\n${indentStr}  ${items.join(`,\n${indentStr}  `)}\n${indentStr}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(([key, val]) => `${key}: ${formatValue(val, indent + 1)}`);
    return `{\n${indentStr}  ${items.join(`,\n${indentStr}  `)}\n${indentStr}}`;
  }
  return String(value);
};

const renderTable = (data: Record<string, unknown>[], isDark: boolean): React.ReactNode => {
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  return (
    <div className={`overflow-x-auto rounded-lg border ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
      <table className="min-w-full text-sm">
        <thead className={isDark ? 'bg-slate-800' : 'bg-gray-50'}>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className={`px-3 py-2 text-left font-medium ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-gray-200'}>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'}>
              {headers.map((header) => (
                <td
                  key={header}
                  className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}
                >
                  {typeof row[header] === 'object'
                    ? JSON.stringify(row[header])
                    : String(row[header] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OutputItemComponent: React.FC<{
  item: OutputItem;
  isDark: boolean;
  index: number;
}> = ({ item, isDark, index }) => {
  if (item.type === 'input') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02 }}
        className="flex items-start gap-2 px-4 py-1.5"
      >
        <ChevronRight size={14} className={`mt-0.5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
        <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          {item.content}
        </span>
      </motion.div>
    );
  }

  const result = item.result;
  const isSuccess = result?.success;
  const hasError = result?.error;
  const hasData = result?.data !== undefined;

  const renderContent = () => {
    if (hasError) {
      return (
        <div className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          {result.error}
        </div>
      );
    }

    if (hasData) {
      const data = result.data;

      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return renderTable(data as Record<string, unknown>[], isDark);
      }

      if (typeof data === 'object' && data !== null) {
        return (
          <pre className={`text-sm font-mono whitespace-pre-wrap ${
            isDark ? 'text-slate-300' : 'text-gray-700'
          }`}>
            {formatValue(data)}
          </pre>
        );
      }

      return (
        <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          {String(data)}
        </span>
      );
    }

    if (item.content) {
      return (
        <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          {item.content}
        </span>
      );
    }

    return null;
  };

  const getIcon = () => {
    if (hasError) {
      return <XCircle size={14} className={isDark ? 'text-red-400' : 'text-red-600'} />;
    }
    if (isSuccess) {
      return <CheckCircle size={14} className={isDark ? 'text-green-400' : 'text-green-600'} />;
    }
    return <Info size={14} className={isDark ? 'text-blue-400' : 'text-blue-600'} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`px-4 py-2 border-l-2 ${
        hasError
          ? isDark
            ? 'border-red-500 bg-red-900/10'
            : 'border-red-500 bg-red-50'
          : isSuccess
            ? isDark
              ? 'border-green-500 bg-green-900/10'
              : 'border-green-500 bg-green-50'
            : isDark
              ? 'border-blue-500 bg-blue-900/10'
              : 'border-blue-500 bg-blue-50'
      }`}
    >
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </motion.div>
  );
};

export const ConsoleOutput = forwardRef<ConsoleOutputRef, ConsoleOutputProps>(
  ({ output, isDark, onClear }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      },
    }));

    return (
      <div className="relative flex-1 min-h-0">
        {output.length > 0 && (
          <button
            onClick={onClear}
            className={`absolute top-2 right-2 z-10 p-1.5 rounded-md transition-colors ${
              isDark
                ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="清空输出"
          >
            <Trash2 size={14} />
          </button>
        )}

        <div
          ref={containerRef}
          className={`h-full overflow-y-auto custom-scrollbar ${
            output.length === 0 ? 'flex items-center justify-center' : 'py-2'
          }`}
        >
          {output.length === 0 ? (
            <div className={`text-center px-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">输入 help 查看可用命令</p>
              <p className="text-xs mt-1 opacity-75">Tab 补全 · Ctrl+R 搜索历史 · Esc 关闭</p>
            </div>
          ) : (
            <div className="space-y-1">
              {output.map((item, index) => (
                <OutputItemComponent
                  key={index}
                  item={item}
                  isDark={isDark}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ConsoleOutput.displayName = 'ConsoleOutput';

const Terminal = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, CheckCircle, XCircle, Info, Trash2, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CommandResult } from '@/services/console';

const INITIAL_VISIBLE_COUNT = 20;
const LOAD_MORE_COUNT = 50;

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

interface ParsedAsciiTable {
  headers: string[];
  rows: string[][];
  isSubRow?: boolean[];
}

const TABLE_BORDER_CHARS = '│─┌┐└┘├┤┬┴┼';

const isAsciiTableLine = (line: string): boolean => {
  return [...TABLE_BORDER_CHARS].some((char) => line.includes(char));
};

const isTableBorderOnly = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const nonBorderChars = trimmed.replace(new RegExp(`[${TABLE_BORDER_CHARS}\\s]`, 'g'), '');
  return nonBorderChars.length === 0;
};

const isSubRowLine = (cells: string[]): boolean => {
  if (cells.length === 0) return false;
  const firstCell = cells[0].trim();
  return firstCell.startsWith('└') || firstCell.startsWith('├') ||
    /^\s{2,}[└├▸→·]/.test(firstCell);
};

const parseAsciiTable = (text: string): ParsedAsciiTable | null => {
  const lines = text.split('\n').filter((l) => l.trim() && isAsciiTableLine(l));
  if (lines.length < 2) return null;

  const dataLines = lines.filter((l) => !isTableBorderOnly(l));
  if (dataLines.length < 1) return null;

  const parseCells = (line: string): string[] => {
    return line.split('│')
      .map((cell) => cell.trim().replace(/^[─┌├└┬┴┼┤┐┘│]+|[─┌├└┬┴┼┤┐┘│]+$/g, '').trim())
      .filter((cell) => cell !== '');
  };

  const allRows = dataLines.map(parseCells);
  if (allRows.length < 1 || allRows.some((r) => r.length === 0)) return null;

  const colCount = Math.max(...allRows.map((r) => r.length));
  if (colCount < 2) return null;

  const headers = allRows[0];
  const dataRows = allRows.slice(1).filter((r) => r.length > 0);
  const isSubRowFlags = dataRows.map((row) => isSubRowLine(row));

  return { headers, rows: dataRows, isSubRow: isSubRowFlags };
};

const renderAsciiTableHtml = (table: ParsedAsciiTable, isDark: boolean): React.ReactNode => {
  const { headers, rows, isSubRow = [] } = table;
  return (
    <div className={`overflow-x-auto rounded-lg my-2 ${isDark ? 'border-2 border-blue-500/40 shadow-lg shadow-blue-500/10' : 'border-2 border-blue-300 shadow-md'}`}>
      <table className="min-w-full text-sm">
        <thead className={isDark ? 'bg-slate-800/90' : 'bg-gray-100'}>
          <tr>
            {headers.map((header, i) => (
              <th key={i} className={`px-3 py-1.5 text-left font-semibold text-xs uppercase tracking-wide ${isDark ? 'text-blue-300 border-b border-blue-500/30' : 'text-blue-700 border-b border-blue-200'} whitespace-nowrap`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={isDark ? 'divide-y divide-slate-600/50' : 'divide-y divide-gray-300'}>
          {rows.map((row, rowIndex) => {
            const isSub = isSubRow[rowIndex] ?? false;
            return (
              <tr key={rowIndex} className={`transition-colors ${
                isSub
                  ? (isDark ? 'bg-slate-800/30 hover:bg-slate-700/30' : 'bg-gray-50/80 hover:bg-gray-100')
                  : (isDark ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50')
              }`}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={`px-3 py-1.5 text-xs font-mono whitespace-nowrap ${
                    isSub
                      ? (isDark ? 'text-slate-400 italic pl-6' : 'text-gray-500 italic pl-6')
                      : (isDark ? 'text-slate-200' : 'text-gray-700')
                  }`}>
                    {cell.replace(/^[└├▸→·]\s*/, '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const renderFormattedContent = (content: string, isDark: boolean): React.ReactNode => {
  const table = parseAsciiTable(content);
  if (table) {
    const parts = content.split('\n');
    const nonTableLines: React.ReactNode[] = [];
    let tableRendered = false;

    for (let i = 0; i < parts.length; i++) {
      const line = parts[i];
      if (!isAsciiTableLine(line)) {
        if (line.trim()) {
          nonTableLines.push(
            <span key={i} className="block">{line}</span>
          );
        } else {
          nonTableLines.push(<br key={i} />);
        }
      } else if (!tableRendered) {
        nonTableLines.push(
          <span key={'table-' + i}>
            {renderAsciiTableHtml(table, isDark)}
          </span>
        );
        tableRendered = true;
        while (i + 1 < parts.length && isAsciiTableLine(parts[i + 1])) i++;
      }
    }

    return (
      <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
        {nonTableLines}
      </div>
    );
  }

  return (
    <span className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
      {content}
    </span>
  );
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

    if (item.content) {
      return renderFormattedContent(item.content, isDark);
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
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const prevOutputLengthRef = useRef(0);
    const isLoadingMoreRef = useRef(false);

    const hasMoreLogs = output.length > visibleCount;
    const visibleOutput = output.slice(-visibleCount);
    const hiddenCount = output.length - visibleCount;

    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
        setIsAtBottom(true);
      },
    }));

    useEffect(() => {
      if (output.length > prevOutputLengthRef.current && !isLoadingMoreRef.current) {
        setVisibleCount((prev) => {
          const newCount = Math.max(prev, INITIAL_VISIBLE_COUNT);
          if (output.length <= newCount) return newCount;
          return output.length;
        });
        setIsAtBottom(true);
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        }, 0);
      }
      prevOutputLengthRef.current = output.length;
    }, [output.length]);

    useEffect(() => {
      if (isAtBottom && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [visibleOutput, isAtBottom]);

    const loadMore = useCallback(() => {
      if (!hasMoreLogs || isLoadingMoreRef.current) return;

      isLoadingMoreRef.current = true;
      const currentScrollHeight = containerRef.current?.scrollHeight ?? 0;
      const currentScrollTop = containerRef.current?.scrollTop ?? 0;

      setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, output.length));

      requestAnimationFrame(() => {
        if (containerRef.current) {
          const newScrollHeight = containerRef.current.scrollHeight;
          containerRef.current.scrollTop = currentScrollTop + (newScrollHeight - currentScrollHeight);
        }
        isLoadingMoreRef.current = false;
      });
    }, [hasMoreLogs, output.length]);

    const handleScroll = useCallback(() => {
      if (!containerRef.current || isLoadingMoreRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(atBottom);

      if (scrollTop < 50 && hasMoreLogs && !isLoadingMoreRef.current) {
        loadMore();
      }
    }, [hasMoreLogs, loadMore]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

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
            title={t('console.output.clear')}
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
              <p className="text-sm">{t('console.output.helpHint')}</p>
              <p className="text-xs mt-1 opacity-75">{t('console.output.shortcutHint')}</p>
            </div>
          ) : (
            <div>
              {hasMoreLogs && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center justify-center gap-1.5 py-2 mx-4 mb-1 rounded-md text-xs cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600'
                  }`}
                  onClick={loadMore}
                >
                  <ChevronUp size={12} />
                  <span>{t('console.output.scrollMore', { count: hiddenCount })}</span>
                </motion.div>
              )}
              <div className="space-y-1">
                {visibleOutput.map((item, index) => (
                  <OutputItemComponent
                    key={output.indexOf(item)}
                    item={item}
                    isDark={isDark}
                    index={index}
                  />
                ))}
              </div>
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

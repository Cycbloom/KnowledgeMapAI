import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react';
import { useTranslation } from "react-i18next";
import {
  Search, Command,
  FileText,
  SearchX
} from 'lucide-react';
import { useTheme } from "../../../hooks";
import { useCombobox } from "../../../hooks/common/useCombobox";
import { Node } from '../../../types';
import { EmptyState } from '../../common/EmptyState';

export interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category: 'navigation' | 'view' | 'action' | 'node' | 'ai';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  nodes?: Node[];
  onNodeSelect?: (nodeId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands: initialCommands,
  nodes = [],
  onNodeSelect
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listboxId = `${baseId}-listbox`;

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const filteredCommands = useMemo(() => {
    const lowerQuery = query.toLowerCase();

    const matchedCommands = initialCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
    );

    const matchedNodes: CommandItem[] = [];
    if (query && nodes.length > 0 && onNodeSelect) {
      nodes.forEach(node => {
        if (node.title.toLowerCase().includes(lowerQuery) || (node.summary && node.summary.toLowerCase().includes(lowerQuery)) || (node.content && node.content.toLowerCase().includes(lowerQuery))) {
          matchedNodes.push({
            id: `node-${node.id}`,
            label: node.title || 'Untitled Node',
            icon: <FileText size={14} />,
            category: 'node',
            action: () => onNodeSelect(node.id),
            keywords: [node.summary || node.content?.slice(0, 50) || '']
          });
        }
      });
    }

    return [...matchedCommands, ...matchedNodes.slice(0, 10)];
  }, [query, initialCommands, nodes, onNodeSelect]);

  const getOptionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);
  const getOptionLabel = useCallback((cmd: CommandItem) => cmd.label, []);

  const handleSelect = useCallback((cmd: CommandItem) => {
    cmd.action();
    handleClose();
  }, [handleClose]);

  const handleSetIsOpen = useCallback((open: boolean) => {
    if (!open) {
      handleClose();
    }
  }, [handleClose]);

  const {
    activeIndex,
    setActiveIndex,
    activeId,
    handleKeyDown,
    resetActive,
  } = useCombobox<CommandItem>({
    options: filteredCommands,
    isOpen,
    setIsOpen: handleSetIsOpen,
    onSelect: handleSelect,
    getOptionId,
    getOptionLabel,
  });

  // 筛选结果变化时重置活动项为首项，保持 activeIndex 始终有效
  useEffect(() => {
    setActiveIndex(filteredCommands.length > 0 ? 0 : null);
  }, [filteredCommands, setActiveIndex]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      resetActive();
    }
  }, [isOpen, resetActive]);

  useEffect(() => {
    const idx = activeIndex ?? 0;
    if (listRef.current && listRef.current.children[idx]) {
      (listRef.current.children[idx] as HTMLElement).scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  const categoryLabels: Record<string, string> = useMemo(() => ({
    navigation: t('graphEditor.commandPalette.categories.navigation'),
    view: t('graphEditor.commandPalette.categories.view'),
    action: t('graphEditor.commandPalette.categories.action'),
    ai: t('graphEditor.commandPalette.categories.ai'),
    node: t('graphEditor.commandPalette.categories.node')
  }), [t]);

  // 预构建 cmd -> 全局下标 映射，避免每个 item 线性 indexOf（原为 O(items^2)）
  const filteredIndexByCommand = useMemo(() => {
    const m = new Map<CommandItem, number>();
    filteredCommands.forEach((cmd, index) => {
      m.set(cmd, index);
    });
    return m;
  }, [filteredCommands]);

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`
        relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col
        transform transition-all duration-200 scale-100 opacity-100
        ${isDark ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-900'}
      `}>
        <h2 id={titleId} className="sr-only">{t('graphEditor.commandPalette.srTitle')}</h2>
        {/* Search Input */}
        <div className={`flex items-center px-4 py-3 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <Search className={`w-5 h-5 mr-3 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-controls={listboxId}
            onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
            className={`flex-1 bg-transparent text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500`}
            placeholder={t('graphEditor.commandPalette.searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex gap-1.5">
            <kbd className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-gray-100 border-gray-200 text-gray-500'
            }`}>
              <span className="text-xs">Esc</span>
            </kbd>
          </div>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          role="listbox"
          id={listboxId}
          className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700"
        >
          {filteredCommands.length === 0 ? (
            <EmptyState
              icon={<SearchX size={24} />}
              title={t('graphEditor.empty.commandPaletteNoResult')}
              className="py-4"
            />
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  {categoryLabels[category] || category}
                </div>
                {items.map((cmd, _index) => {
                  // Find the global index for this item to match activeIndex
                  const globalIndex = filteredIndexByCommand.get(cmd) ?? 0;
                  const isSelected = globalIndex === activeIndex;

                  return (
                    <button
                      key={cmd.id}
                      role="option"
                      id={getOptionId(globalIndex)}
                      aria-selected={isSelected}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setActiveIndex(globalIndex)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? isDark ? 'bg-primary-600 text-white' : 'bg-primary-500 text-white'
                          : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {cmd.icon || <Command size={16} />}
                        <span>{cmd.label}</span>
                      </div>
                      {cmd.shortcut && (
                        <span className={`text-xs ${
                          isSelected ? 'text-primary-100' : isDark ? 'text-slate-500' : 'text-gray-400'
                        }`}>
                          {cmd.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2 border-t text-[10px] flex justify-between ${
          isDark ? 'bg-slate-800/50 border-slate-800 text-slate-500' : 'bg-gray-50 border-gray-100 text-gray-400'
        }`}>
          <div className="flex gap-3">
            <span>{t('graphEditor.commandPalette.kbdHints.navHint')}</span>
            <span>{t('graphEditor.commandPalette.kbdHints.selectHint')}</span>
          </div>
          <div>
            Command Palette
          </div>
        </div>
      </div>
    </div>
  );
};

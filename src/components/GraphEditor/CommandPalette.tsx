import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Command, X, ArrowRight, 
  Layout, Sun, Moon, Maximize, Minimize, 
  Network, GitBranch, Clock, Layers,
  FileText, Settings, Download, Share2,
  Focus, Wand2, Plus, Trash2, Home, ListChecks
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Node } from '../../types';
import { useNavigate } from 'react-router-dom';

export interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category: 'navigation' | 'view' | 'action' | 'node' | 'ai';
  action: () => void;
  keywords?: string[]; // Extra keywords for search
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
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Combine static commands with dynamic node commands
  const filteredCommands = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    
    // 1. Filter static commands
    const matchedCommands = initialCommands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) || 
      cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
    );

    // 2. Filter nodes if query is present
    const matchedNodes: CommandItem[] = [];
    if (query && nodes.length > 0 && onNodeSelect) {
      nodes.forEach(node => {
        if (node.title.toLowerCase().includes(lowerQuery) || (node.content && node.content.toLowerCase().includes(lowerQuery))) {
          matchedNodes.push({
            id: `node-${node.id}`,
            label: node.title || 'Untitled Node',
            icon: <FileText size={14} />,
            category: 'node',
            action: () => onNodeSelect(node.id),
            keywords: [node.content?.slice(0, 50) || ''] // Search in content preview
          });
        }
      });
    }

    // Limit node results to avoid clutter
    return [...matchedCommands, ...matchedNodes.slice(0, 10)];
  }, [query, initialCommands, nodes, onNodeSelect]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      (listRef.current.children[selectedIndex] as HTMLElement).scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const categoryLabels: Record<string, string> = {
    navigation: '导航',
    view: '视图',
    action: '操作',
    ai: 'AI 助手',
    node: '跳转至节点'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`
        relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col
        transform transition-all duration-200 scale-100 opacity-100
        ${isDark ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-900'}
      `}>
        {/* Search Input */}
        <div className={`flex items-center px-4 py-3 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
          <Search className={`w-5 h-5 mr-3 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
          <input
            ref={inputRef}
            type="text"
            className={`flex-1 bg-transparent text-lg placeholder-gray-400 focus:outline-none`}
            placeholder="搜索命令或节点..."
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
          className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-slate-400">
              <p>未找到相关结果</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-slate-500' : 'text-gray-400'
                }`}>
                  {categoryLabels[category] || category}
                </div>
                {items.map((cmd, index) => {
                  // Find the global index for this item to match selectedIndex
                  const globalIndex = filteredCommands.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;
                  
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isSelected 
                          ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                          : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {cmd.icon || <Command size={16} />}
                        <span>{cmd.label}</span>
                      </div>
                      {cmd.shortcut && (
                        <span className={`text-xs ${
                          isSelected ? 'text-blue-100' : isDark ? 'text-slate-500' : 'text-gray-400'
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
            <span>↑↓ 导航</span>
            <span>↵ 选择</span>
          </div>
          <div>
            Command Palette
          </div>
        </div>
      </div>
    </div>
  );
};

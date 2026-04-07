import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';
import { commandRegistry, type AutocompleteSuggestion, type CommandHistoryItem } from '@/services/console';
import { CommandAutocomplete } from './CommandAutocomplete';

interface ConsoleInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (command: string) => void;
  isDark: boolean;
  isLoading?: boolean;
  pendingConfirmActive?: boolean;
  history?: CommandHistoryItem[];
}

export interface ConsoleInputRef {
  focus: () => void;
}

export const ConsoleInput = forwardRef<ConsoleInputRef, ConsoleInputProps>(
  ({ value, onChange, onSubmit, isDark, isLoading = false, pendingConfirmActive = false, history = [] }, ref) => {
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInput, setTempInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    const updateSuggestions = useCallback((input: string, cursorPos: number) => {
      const newSuggestions = commandRegistry.getAutocompleteSuggestions(input, cursorPos);
      setSuggestions(newSuggestions);
      setSelectedIndex(0);
      setShowSuggestions(newSuggestions.length > 0);
    }, []);

    useEffect(() => {
      if (value) {
        updateSuggestions(value, value.length);
      } else {
        setShowSuggestions(false);
      }
    }, [value, updateSuggestions]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (pendingConfirmActive) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const answer = value.trim().toLowerCase();
          if (answer === 'y' || answer === 'yes') {
            onSubmit('y');
          } else {
            onSubmit('n');
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onSubmit('n');
        }
        return;
      }

      if (isSearchMode) {
        if (e.key === 'Escape') {
          setIsSearchMode(false);
          setSearchQuery('');
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          const parts = value.split(' ');
          parts[parts.length - 1] = selected.value;
          onChange(parts.join(' ') + ' ');
          setShowSuggestions(false);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (showSuggestions) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (history.length > 0) {
          const cursorPosition = inputRef.current?.selectionStart ?? 0;
          const canNavigateHistory = !value || cursorPosition === 0 || history.some(item => item.command === value);

          if (canNavigateHistory) {
            if (historyIndex === -1 && value) {
              setTempInput(value);
            }

            const newIndex = Math.min(historyIndex + 1, history.length - 1);
            setHistoryIndex(newIndex);
            onChange(history[history.length - 1 - newIndex].command);
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (showSuggestions) {
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (history.length > 0 && historyIndex > -1) {
          const newIndex = historyIndex - 1;

          if (newIndex === -1) {
            setHistoryIndex(-1);
            onChange(tempInput);
            setTempInput('');
          } else {
            setHistoryIndex(newIndex);
            onChange(history[history.length - 1 - newIndex].command);
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          const parts = value.split(' ');
          parts[parts.length - 1] = selected.value;
          onChange(parts.join(' ') + ' ');
          setShowSuggestions(false);
        } else if (value.trim()) {
          setHistoryIndex(-1);
          setTempInput('');
          onSubmit(value.trim());
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      } else if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        setIsSearchMode(true);
      }
    }, [showSuggestions, suggestions, selectedIndex, value, onChange, onSubmit, isSearchMode, pendingConfirmActive, history, historyIndex, tempInput]);

    const handleSuggestionClick = useCallback((suggestion: AutocompleteSuggestion) => {
      const parts = value.split(' ');
      parts[parts.length - 1] = suggestion.value;
      onChange(parts.join(' ') + ' ');
      setShowSuggestions(false);
      inputRef.current?.focus();
    }, [value, onChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      if (historyIndex !== -1) {
        setTempInput(e.target.value);
      }
    }, [onChange, historyIndex]);

    return (
      <div className={`relative ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        <div className={`flex items-center px-4 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <ChevronRight size={16} className={isDark ? 'text-green-400' : 'text-green-600'} />
          {isSearchMode ? (
            <div className="flex-1 flex items-center gap-2 ml-2">
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                搜索历史:
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入搜索关键词..."
                className={`flex-1 bg-transparent outline-none text-sm ${
                  isDark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
                }`}
                autoFocus
              />
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={pendingConfirmActive ? '输入 y 确认 / n 取消' : '输入命令... (Tab 补全, Ctrl+R 搜索历史)'}
              className={`flex-1 bg-transparent outline-none text-sm ml-2 ${
                isDark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
              } ${pendingConfirmActive ? (isDark ? 'text-yellow-300 placeholder-yellow-600' : 'text-yellow-700 placeholder-yellow-500') : ''}`}
              disabled={isLoading}
              maxLength={pendingConfirmActive ? 10 : undefined}
              autoComplete="off"
            />
          )}
          {isLoading && (
            <Loader2 size={16} className={`animate-spin ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
          )}
        </div>

        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-1"
            >
              <CommandAutocomplete
                suggestions={suggestions}
                selectedIndex={selectedIndex}
                onSelect={handleSuggestionClick}
                isDark={isDark}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

ConsoleInput.displayName = 'ConsoleInput';

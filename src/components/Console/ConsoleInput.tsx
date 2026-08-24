import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

const SEARCH_MAX_RESULTS = 8;

export const ConsoleInput = forwardRef<ConsoleInputRef, ConsoleInputProps>(
  ({ value, onChange, onSubmit, isDark, isLoading = false, pendingConfirmActive = false, history = [] }, ref) => {
    const { t } = useTranslation();
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInput, setTempInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

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

    // store 中历史记录为最新在前（prepend），因此索引 0 即最新一条：
    // ArrowUp 向更旧遍历（index 增大），ArrowDown 向更新回退（index 减小）
    const searchMatches = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      const source = query
        ? history.filter((item) => item.command.toLowerCase().includes(query))
        : history;
      return source.slice(0, SEARCH_MAX_RESULTS);
    }, [history, searchQuery]);

    useEffect(() => {
      setSearchSelectedIndex(0);
    }, [searchQuery]);

    useEffect(() => {
      if (isSearchMode) {
        searchInputRef.current?.focus();
      }
    }, [isSearchMode]);

    const closeSearch = useCallback(() => {
      setIsSearchMode(false);
      setSearchQuery('');
      setSearchSelectedIndex(0);
    }, []);

    const applySearchResult = useCallback((command: string) => {
      onChange(command);
      setHistoryIndex(-1);
      setTempInput('');
      closeSearch();
      requestAnimationFrame(() => inputRef.current?.focus());
    }, [onChange, closeSearch]);

    const enterSearchMode = useCallback(() => {
      setSearchQuery(value);
      setSearchSelectedIndex(0);
      setShowSuggestions(false);
      setIsSearchMode(true);
    }, [value]);

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
          e.preventDefault();
          closeSearch();
        } else if (e.key === 'ArrowUp' && searchMatches.length > 0) {
          e.preventDefault();
          setSearchSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchMatches.length - 1));
        } else if (e.key === 'ArrowDown' && searchMatches.length > 0) {
          e.preventDefault();
          setSearchSelectedIndex((prev) => (prev < searchMatches.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const selected = searchMatches[searchSelectedIndex];
          if (selected) {
            applySearchResult(selected.command);
          }
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          const parts = value.split(' ');
          parts[parts.length - 1] = selected.value;
          onChange(`${parts.join(' ')  } `);
          setShowSuggestions(false);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (showSuggestions) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (history.length > 0) {
          if (historyIndex === -1 && value) {
            setTempInput(value);
          }

          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          onChange(history[newIndex].command);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (showSuggestions) {
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (historyIndex > -1) {
          const newIndex = historyIndex - 1;

          if (newIndex === -1) {
            setHistoryIndex(-1);
            onChange(tempInput);
            setTempInput('');
          } else {
            setHistoryIndex(newIndex);
            onChange(history[newIndex].command);
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          const parts = value.split(' ');
          parts[parts.length - 1] = selected.value;
          onChange(`${parts.join(' ')  } `);
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
        enterSearchMode();
      }
    }, [showSuggestions, suggestions, selectedIndex, value, onChange, onSubmit, isSearchMode, pendingConfirmActive, history, historyIndex, tempInput, searchMatches, searchSelectedIndex, closeSearch, applySearchResult, enterSearchMode]);

    const handleSuggestionClick = useCallback((suggestion: AutocompleteSuggestion) => {
      const parts = value.split(' ');
      parts[parts.length - 1] = suggestion.value;
      onChange(`${parts.join(' ')  } `);
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
                {t('console.input.searchHistory')}
              </span>
              <input
                ref={searchInputRef}
                type="text"
                data-testid="console-search-input"
                aria-label={t('console.input.searchAria')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('console.input.searchPlaceholder')}
                className={`flex-1 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 text-sm ${
                  isDark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
                }`}
              />
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              aria-label={t('console.input.commandAria')}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={pendingConfirmActive ? t('console.input.confirmPlaceholder') : t('console.input.commandPlaceholder')}
              className={`flex-1 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 text-sm ml-2 ${
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
          {isSearchMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 right-0 mb-1"
            >
              <div
                className={`rounded-lg border shadow-lg overflow-hidden ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                }`}
              >
                {searchMatches.length > 0 ? (
                  <div
                    role="listbox"
                    aria-label={t('console.input.searchAria')}
                    className="max-h-64 overflow-y-auto custom-scrollbar"
                  >
                    {searchMatches.map((item, index) => {
                      const isSelected = index === searchSelectedIndex;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applySearchResult(item.command);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                            isSelected
                              ? isDark
                                ? 'bg-slate-700/70'
                                : 'bg-gray-100'
                              : isDark
                                ? 'hover:bg-slate-700/50'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <ChevronRight size={14} className={isDark ? 'text-green-400' : 'text-green-600'} />
                          <span
                            className={`flex-1 min-w-0 text-sm font-mono truncate ${
                              isDark ? 'text-slate-200' : 'text-gray-800'
                            }`}
                          >
                            {item.command}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`px-3 py-2 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t('console.input.searchNoResults')}
                  </div>
                )}
                <div
                  className={`px-3 py-1.5 border-t text-[10px] flex items-center justify-between ${
                    isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  <span>{t('console.input.searchHint')}</span>
                  <span>{searchMatches.length}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isSearchMode && showSuggestions && suggestions.length > 0 && (
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

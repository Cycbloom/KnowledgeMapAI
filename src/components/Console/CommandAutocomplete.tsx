import React, { useCallback, useEffect, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Settings, FileText, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AutocompleteSuggestion } from '@/services/console';
import { useCombobox } from '@/hooks/useCombobox';

interface CommandAutocompleteProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
  isDark: boolean;
}

const getIcon = (type: AutocompleteSuggestion['type']) => {
  switch (type) {
    case 'command':
      return Terminal;
    case 'option':
      return Settings;
    case 'value':
      return FileText;
    default:
      return Hash;
  }
};

const getTypeColor = (type: AutocompleteSuggestion['type'], isDark: boolean): string => {
  switch (type) {
    case 'command':
      return isDark ? 'text-primary-400 bg-primary-900/30' : 'text-primary-600 bg-primary-50';
    case 'option':
      return isDark ? 'text-primary-400 bg-primary-900/30' : 'text-primary-600 bg-primary-50';
    case 'value':
      return isDark ? 'text-green-400 bg-green-900/30' : 'text-green-600 bg-green-50';
    default:
      return isDark ? 'text-slate-400 bg-slate-700' : 'text-gray-600 bg-gray-100';
  }
};

const typeKeyMap: Record<AutocompleteSuggestion['type'], 'Command' | 'Option' | 'Value'> = {
  command: 'Command',
  option: 'Option',
  value: 'Value',
};

export const CommandAutocomplete: React.FC<CommandAutocompleteProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  isDark,
}) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();

  const getOptionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  const { activeId, setActiveIndex, handleKeyDown } = useCombobox<AutocompleteSuggestion>({
    options: suggestions,
    isOpen: true,
    setIsOpen: () => {},
    onSelect: (suggestion) => onSelect(suggestion),
    getOptionId,
    getOptionLabel: (suggestion) => suggestion.value,
  });

  // 将 hook 内部 activeIndex 与父组件受控的 selectedIndex 保持同步，
  // 以便 activeId（aria-activedescendant）正确指向当前选项。
  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex, setActiveIndex]);

  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      const list = listRef.current;
      const selected = selectedRef.current;
      const listRect = list.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();

      if (selectedRect.top < listRect.top) {
        selected.scrollIntoView({ block: 'start' });
      } else if (selectedRect.bottom > listRect.bottom) {
        selected.scrollIntoView({ block: 'end' });
      }
    }
  }, [selectedIndex]);

  const handleClick = useCallback((suggestion: AutocompleteSuggestion) => {
    onSelect(suggestion);
  }, [onSelect]);

  const getTypeLabel = useCallback((type: AutocompleteSuggestion['type']): string => {
    return t(`console.commandAutocomplete.type${typeKeyMap[type]}` as const);
  }, [t]);

  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className={`rounded-lg border shadow-lg overflow-hidden ${
        isDark
          ? 'bg-slate-800 border-slate-700'
          : 'bg-white border-gray-200'
      }`}
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label={t('console.commandAutocomplete.placeholder')}
        aria-activedescendant={activeId}
        onKeyDown={(e) => {
          // 焦点在选项按钮上时，Enter 由按钮 onClick 处理，避免重复触发 onSelect
          if (e.key === 'Enter' && e.target !== e.currentTarget) {
            return;
          }
          handleKeyDown(e.nativeEvent);
        }}
        className="max-h-64 overflow-y-auto custom-scrollbar"
      >
        {suggestions.map((suggestion, index) => {
          const Icon = getIcon(suggestion.type);
          const isSelected = index === selectedIndex;
          const colorClass = getTypeColor(suggestion.type, isDark);

          return (
            <button
              key={`${suggestion.value}-${index}`}
              id={getOptionId(index)}
              role="option"
              aria-selected={isSelected}
              ref={isSelected ? selectedRef : null}
              onClick={() => handleClick(suggestion)}
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
              <div className={`p-1.5 rounded-md ${colorClass}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-mono truncate ${
                  isDark ? 'text-slate-200' : 'text-gray-800'
                }`}>
                  {suggestion.value}
                </div>
                <div className={`text-xs truncate ${
                  isDark ? 'text-slate-500' : 'text-gray-500'
                }`}>
                  {suggestion.description}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorClass}`}>
                {getTypeLabel(suggestion.type)}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`px-3 py-1.5 border-t text-[10px] flex items-center justify-between ${
        isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'
      }`}>
        <span>{t('console.commandAutocomplete.navigateHint')}</span>
        <span>{t('console.commandAutocomplete.suggestionsCount', { count: suggestions.length })}</span>
      </div>
    </motion.div>
  );
};

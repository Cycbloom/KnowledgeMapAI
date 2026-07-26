import React, { useMemo, useState, useCallback, useRef, useId } from 'react';
import { Tag, X, Plus, Hash, Filter, Sparkles, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../hooks";
import { cn } from '@/lib/utils';
import { Node } from '../../types';
import { EmptyState } from './EmptyState';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';
import { useCombobox } from '../../hooks/useCombobox';

interface TagData {
  name: string;
  count: number;
  nodes: Node[];
  color?: string;
}

interface TagCloudProps {
  nodes: Node[];
  onTagClick?: (tag: string) => void;
  selectedTags?: string[];
  onTagSelect?: (tags: string[]) => void;
  maxTags?: number;
}

interface TagFilterProps {
  nodes: Node[];
  selectedTags: string[];
  onTagChange: (tags: string[]) => void;
}

interface TagSuggestionsProps {
  content: string;
  existingTags: string[];
  onAddTag: (tag: string) => void;
}

const TAG_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500'
];

const getTagColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

export const TagCloud: React.FC<TagCloudProps> = ({
  nodes,
  onTagClick,
  selectedTags = [],
  onTagSelect,
  maxTags = 30
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const tagData = useMemo(() => {
    const tagMap = new Map<string, TagData>();
    
    nodes.forEach(node => {
      const tags = node.tags || node.properties?.tags || [];
      tags.forEach((tag: string) => {
        if (tagMap.has(tag)) {
          const data = tagMap.get(tag);
          if (data) {
            data.count++;
            data.nodes.push(node);
          }
        } else {
          tagMap.set(tag, {
            name: tag,
            count: 1,
            nodes: [node],
            color: getTagColor(tag)
          });
        }
      });
    });

    return Array.from(tagMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, maxTags);
  }, [nodes, maxTags]);

  const maxCount = useMemo(() => {
    return Math.max(...tagData.map(t => t.count), 1);
  }, [tagData]);

  const handleTagClick = useCallback((tag: string) => {
    if (onTagSelect) {
      if (selectedTags.includes(tag)) {
        onTagSelect(selectedTags.filter(t => t !== tag));
      } else {
        onTagSelect([...selectedTags, tag]);
      }
    }
    onTagClick?.(tag);
  }, [onTagClick, onTagSelect, selectedTags]);

  return (
    <div className={cn('rounded-xl p-6 shadow-sm border', isDark ? 'bg-slate-800' : 'bg-white', isDark ? 'border-slate-700' : 'border-gray-100')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-800')}>
          标签云
        </h3>
        <span className={cn('text-xs', isDark ? 'text-slate-400' : 'text-gray-500')}>
          {tagData.length} 个标签
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {tagData.map(tag => {
          const isSelected = selectedTags.includes(tag.name);
          const size = 0.8 + (tag.count / maxCount) * 0.4;
          
          return (
            <button
              key={tag.name}
              onClick={() => handleTagClick(tag.name)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:scale-105',
                isSelected
                  ? cn(tag.color, 'text-white shadow-lg')
                  : isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
              style={{ fontSize: `${size}rem` }}
            >
              <Hash size={12} />
              <span>{tag.name}</span>
              <span className={cn('text-xs', isSelected ? 'text-white/80' : isDark ? 'text-slate-500' : 'text-gray-400')}>
                {tag.count}
              </span>
            </button>
          );
        })}
      </div>
      
      {tagData.length === 0 && (
        <EmptyState icon={<Tag size={32} />} title={t('common.empty')} />
      )}
    </div>
  );
};

export const TagFilter: React.FC<TagFilterProps> = ({
  nodes,
  selectedTags,
  onTagChange
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  useEscapeKey(() => setIsOpen(false), isOpen);

  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const listboxId = `${baseId}-listbox`;
  const getOptionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach(node => {
      const tags = node.tags || node.properties?.tags || [];
      tags.forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [nodes]);

  const handleTagToggle = useCallback((tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagChange([...selectedTags, tag]);
    }
  }, [selectedTags, onTagChange]);

  const { activeId, handleKeyDown } = useCombobox<string>({
    options: allTags,
    isOpen,
    setIsOpen,
    onSelect: handleTagToggle,
    getOptionId,
    getOptionLabel: (tag) => tag,
  });

  const clearAll = useCallback(() => {
    onTagChange([]);
  }, [onTagChange]);

  return (
    <div className="relative">
      <button
        id={triggerId}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(e.nativeEvent)}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          selectedTags.length > 0
            ? 'bg-primary-500 text-white'
            : isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        )}
      >
        <Filter size={16} />
        <span className="text-sm">
          {selectedTags.length > 0
            ? t('common.tagSystem.selected', { count: selectedTags.length })
            : t('common.tagSystem.filter')}
        </span>
        {selectedTags.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
            {selectedTags.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="listbox"
          id={listboxId}
          aria-labelledby={triggerId}
          className={cn(
            'absolute top-full left-0 mt-2 w-72 rounded-xl shadow-xl border z-50',
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
          )}
        >
          <div className={cn('p-3 border-b', isDark ? 'border-slate-700' : 'border-gray-100')}>
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium', isDark ? 'text-slate-300' : 'text-gray-700')}>
                {t('common.tagSystem.selectAll')}
              </span>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearAll}
                  className={cn('text-xs min-h-[44px] px-3 py-2', isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700')}
                >
                  清除全部
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {allTags.map((tag, index) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  id={getOptionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleTagToggle(tag)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors',
                    isSelected
                      ? isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-50 text-primary-600'
                      : isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-50 text-gray-700'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Hash size={14} />
                    {tag}
                  </span>
                  {isSelected && (
                    <X size={14} />
                  )}
                </button>
              );
            })}
          </div>

          {allTags.length === 0 && (
            <EmptyState icon={<Tag size={24} />} title={t('common.empty')} className="min-h-0 py-4" />
          )}
        </div>
      )}
    </div>
  );
};

export const TagSuggestions: React.FC<TagSuggestionsProps> = ({
  content,
  existingTags,
  onAddTag
}) => {
  const { isDark } = useTheme();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const keywords = content
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 5);
      
      const mockSuggestions = keywords.filter(k => !existingTags.includes(k));
      setSuggestions(mockSuggestions);
    } catch (err) {
      console.error('Failed to generate tag suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [content, existingTags]);

  React.useEffect(() => {
    if (content.length > 20) {
      const timeout = setTimeout(generateSuggestions, 500);
      return () => clearTimeout(timeout);
    }
  }, [content, generateSuggestions]);

  if (suggestions.length === 0 && !loading) return null;

  return (
    <div className={cn('rounded-lg p-3', isDark ? 'bg-slate-700/50' : 'bg-gray-50')}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-primary-500" />
        <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-gray-500')}>
          建议标签
        </span>
      </div>
      
      {loading ? (
        <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-slate-400' : 'text-gray-500')}>
          <Loader2 size={14} className="animate-spin" />
          分析中...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(tag => (
            <button
              key={tag}
              onClick={() => onAddTag(tag)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
                isDark
                  ? 'bg-slate-600 text-slate-300 hover:bg-primary-600 hover:text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-primary-500 hover:text-white'
              )}
            >
              <Plus size={16} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}> = ({ tags, onChange, suggestions = [], placeholder = '添加标签...' }) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const getOptionId = useCallback(
    (index: number) => `${listboxId}-option-${index}`,
    [listboxId],
  );

  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return suggestions.slice(0, 5);
    return suggestions
      .filter(s => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s))
      .slice(0, 5);
  }, [suggestions, inputValue, tags]);

  const handleAddTag = useCallback((tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    setShowSuggestions(false);
    setActiveIndex(null);
  }, [tags, onChange]);

  const handleRemoveTag = useCallback((tag: string) => {
    onChange(tags.filter(t => t !== tag));
  }, [tags, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (activeIndex !== null && filteredSuggestions[activeIndex]) {
        handleAddTag(filteredSuggestions[activeIndex]);
      } else {
        handleAddTag(inputValue);
      }
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
    if (e.key === 'Escape' && showSuggestions) {
      e.preventDefault();
      setShowSuggestions(false);
      setActiveIndex(null);
    }
    if (e.key === 'ArrowDown' && showSuggestions && filteredSuggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => i === null ? 0 : (i + 1) % filteredSuggestions.length);
    }
    if (e.key === 'ArrowUp' && showSuggestions && filteredSuggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => i === null ? filteredSuggestions.length - 1 : (i - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    }
  }, [inputValue, tags, activeIndex, filteredSuggestions, showSuggestions, handleAddTag, handleRemoveTag]);

  return (
    <div className="relative">
      <div className={cn(
        'flex flex-wrap gap-2 p-2 rounded-lg border',
        isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
      )}>
        {tags.map(tag => (
          <span
            key={tag}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm',
              getTagColor(tag), 'text-white'
            )}
          >
            <Hash size={10} />
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="ml-1 hover:bg-white/20 rounded-full p-0.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t('common.aria.removeTag')}
            >
              <X size={16} />
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex !== null ? getOptionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-label={t('common.aria.addTag')}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setActiveIndex(null);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className={cn(
            'flex-1 min-w-[100px] bg-transparent text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            isDark ? 'text-white placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
          )}
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg border z-50',
            isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
          )}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              id={getOptionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => handleAddTag(suggestion)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2',
                isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-50 text-gray-700'
              )}
            >
              <Plus size={14} />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

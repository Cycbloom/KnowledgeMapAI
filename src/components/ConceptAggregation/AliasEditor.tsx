import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/common/useWorker';
import { EmptyState } from '../common/EmptyState';

interface AliasEditorProps {
  knowledgePointId: string;
  currentAliases: string[];
  onUpdate: (aliases: string[]) => void;
  readOnly?: boolean;
  maxAliases?: number;
  showInMergeContext?: boolean;
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
];

const getTagColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

export const AliasEditor: React.FC<AliasEditorProps> = ({
  knowledgePointId: _knowledgePointId,
  currentAliases,
  onUpdate,
  readOnly = false,
  maxAliases = 10,
  showInMergeContext = false,
}) => {
  const [aliases, setAliases] = useState<string[]>(currentAliases);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevAliasesRef = useRef<string[]>(currentAliases);
  const { t } = useTranslation();

  const debouncedAliases = useDebouncedValue(aliases, 300);

  useEffect(() => {
    if (currentAliases !== prevAliasesRef.current) {
      setAliases(currentAliases);
      prevAliasesRef.current = currentAliases;
    }
  }, [currentAliases]);

  useEffect(() => {
    if (debouncedAliases !== currentAliases && !readOnly) {
      handleSave(debouncedAliases);
    }
  }, [debouncedAliases]);

  const validateAlias = useCallback(
    (newAlias: string): string | null => {
      const trimmed = newAlias.trim();

      if (!trimmed) {
        return t('conceptAggregation.alias.empty');
      }

      if (aliases.includes(trimmed)) {
        return t('conceptAggregation.alias.duplicate');
      }

      if (aliases.length >= maxAliases) {
        return t('conceptAggregation.alias.maxExceeded', { count: maxAliases });
      }

      return null;
    },
    [aliases, maxAliases, t]
  );

  const handleAddAlias = useCallback(
    (value?: string) => {
      const aliasToAdd = (value || inputValue).trim();

      const validationError = validateAlias(aliasToAdd);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      const newAliases = [...aliases, aliasToAdd];
      setAliases(newAliases);
      setInputValue('');
    },
    [inputValue, aliases, validateAlias]
  );

  const handleRemoveAlias = useCallback(
    (aliasToRemove: string) => {
      const newAliases = aliases.filter((a) => a !== aliasToRemove);
      setAliases(newAliases);
      setError(null);
    },
    [aliases]
  );

  const handleSave = useCallback(
    async (aliasesToSave: string[]) => {
      setIsSaving(true);
      try {
        onUpdate(aliasesToSave);
      } finally {
        setIsSaving(false);
      }
    },
    [onUpdate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      setError(null);

      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        handleAddAlias();
      }

      if (e.key === 'Backspace' && !inputValue && aliases.length > 0) {
        handleRemoveAlias(aliases[aliases.length - 1]);
      }
    },
    [inputValue, aliases, handleAddAlias, handleRemoveAlias]
  );

  if (readOnly) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Tag size={14} />
          <span>{t('conceptAggregation.alias.label')}</span>
        </div>
        {aliases.length === 0 ? (
          <EmptyState
            title={t("common.conceptAggregation.noAliasTitle")}
            className="min-h-0 py-2"
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {aliases.map((alias) => (
              <span
                key={alias}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${getTagColor(alias)} text-white`}
              >
                {alias}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Tag size={14} />
          <span>{t('conceptAggregation.alias.manageTitle')}</span>
          {!showInMergeContext && (
            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
              ({aliases.length}/{maxAliases})
            </span>
          )}
        </div>
        {isSaving && (
          <Loader2 size={14} className="animate-spin text-primary-500" />
        )}
      </div>

      <div
        className={`flex flex-wrap gap-2 p-2 rounded-lg border transition-colors ${
          error
            ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
            : 'border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800'
        }`}
      >
        {aliases.map((alias) => (
          <span
            key={alias}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${getTagColor(alias)} text-white group`}
          >
            {alias}
            <button
              onClick={() => handleRemoveAlias(alias)}
              className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
              aria-label={t('common.aria.close')}
            >
              <X size={10} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            aliases.length === 0 ? t('conceptAggregation.alias.inputPlaceholder') : ''
          }
          disabled={aliases.length >= maxAliases || isSaving}
          className={`flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed ${showInMergeContext ? 'min-w-[100px]' : ''}`}
        />

        {inputValue.trim() && aliases.length < maxAliases && (
          <button
            onClick={() => handleAddAlias()}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 hover:bg-primary-600 text-white transition-colors"
            aria-label={t('conceptAggregation.alias.addButton')}
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {showInMergeContext && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('conceptAggregation.alias.mergeHint')}
        </p>
      )}

      {!showInMergeContext && aliases.length >= maxAliases && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t('conceptAggregation.alias.limitReached')}
        </p>
      )}
    </div>
  );
};

export type { AliasEditorProps };

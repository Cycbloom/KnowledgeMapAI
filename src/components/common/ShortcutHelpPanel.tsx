import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { X, RotateCcw, Search, Keyboard, MousePointer2, Sparkles, Command } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme, useFocusTrap, useEscapeKey } from "../../hooks";
import { useShortcutStore } from '../../store/useShortcutStore';
import { useShallow } from 'zustand/react/shallow';
import {
  DEFAULT_SHORTCUTS,
  CATEGORY_ORDER,
  formatShortcutKey,
  ShortcutDefinition,
  ShortcutKey
} from '../../config/shortcuts';
import { cn } from '@/utils/utils';

interface ShortcutListContentProps {
  /**
   * 关闭回调。传入时显示关闭按钮（浮层形态）；
   * 不传时隐藏关闭按钮（内嵌形态）。
   */
  onClose?: () => void;
  /**
   * 附加在根容器上的 className，便于宿主控制尺寸/高度等。
   */
  className?: string;
  /**
   * 模态标题 id，用于 aria-labelledby。仅浮层形态由 ShortcutHelpPanel 传入。
   */
  titleId?: string;
}

/**
 * 快捷键列表内容（可独立渲染）。
 *
 * 不包含浮层定位与遮罩，仅渲染标题栏 / 搜索 / 分组列表 / 自定义 / 重置 / 底部信息。
 * - 浮层形态：由 `ShortcutHelpPanel` 包装并传入 `onClose`。
 * - 内嵌形态：在 Settings 等页面直接使用，可不传 `onClose`。
 */
export const ShortcutListContent: React.FC<ShortcutListContentProps> = ({
  onClose,
  className,
  titleId,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { bindings, setBinding, resetBinding, resetAllBindings } = useShortcutStore(
    useShallow((s) => ({
      bindings: s.bindings,
      setBinding: s.setBinding,
      resetBinding: s.resetBinding,
      resetAllBindings: s.resetAllBindings,
    })),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [_pressedKeys, setPressedKeys] = useState<Partial<ShortcutKey>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  // 缓存过滤结果，仅在查询词或文案变化时重算（原为每次渲染全量过滤 DEFAULT_SHORTCUTS）
  const filteredShortcuts = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return DEFAULT_SHORTCUTS.filter(shortcut =>
      t(shortcut.name).toLowerCase().includes(lowerQuery) ||
      t(shortcut.description).toLowerCase().includes(lowerQuery) ||
      t(`shortcuts.helpPanel.categories.${shortcut.category}`, { defaultValue: '' }).toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, t]);

  // 单趟遍历将过滤结果按分类分组，替代原 reduce+filter 的 O(categories*shortcuts) 嵌套循环
  const groupedShortcuts = useMemo(() => {
    const byCategory = new Map<string, ShortcutDefinition[]>();
    for (const shortcut of filteredShortcuts) {
      const list = byCategory.get(shortcut.category);
      if (list) {
        list.push(shortcut);
      } else {
        byCategory.set(shortcut.category, [shortcut]);
      }
    }
    const acc: Record<string, ShortcutDefinition[]> = {};
    for (const category of CATEGORY_ORDER) {
      const items = byCategory.get(category);
      if (items && items.length > 0) {
        acc[category] = items;
      }
    }
    return acc;
  }, [filteredShortcuts]);

  const handleKeyCapture = (e: React.KeyboardEvent, shortcutId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setEditingId(null);
      setPressedKeys({});
      return;
    }

    const newKey: ShortcutKey = {
      key: e.key === ' ' ? 'Space' : e.key,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey
    };

    if (!e.ctrlKey && !e.metaKey && !e.altKey &&
        !['Enter', 'Space', 'Tab', 'Escape', 'Delete', 'Backspace',
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      return;
    }

    setBinding(shortcutId, newKey);
    setEditingId(null);
    setPressedKeys({});
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className={cn('flex items-center justify-between px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200')}>
        <div className="flex items-center gap-3">
          <Keyboard className="w-5 h-5 text-primary-500" />
          <h2 id={titleId} className="text-lg font-semibold">{t('shortcuts.helpPanel.title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => resetAllBindings()}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            <RotateCcw size={14} />
            {t('shortcuts.helpPanel.resetAll')}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={cn('p-2 rounded-lg transition-colors',
                isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
              )}
              aria-label={t('common.aria.close')}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className={cn('px-6 py-3 border-b', isDark ? 'border-slate-700' : 'border-gray-200')}>
        <div className={cn('flex items-center gap-3 px-3 py-2 rounded-lg', isDark ? 'bg-slate-800' : 'bg-gray-100')}>
          <Search className={cn('w-4 h-4', isDark ? 'text-slate-400' : 'text-gray-400')} />
          <input
            type="text"
            aria-label={t('common.aria.search')}
            placeholder={t('shortcuts.helpPanel.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn('flex-1 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              isDark ? 'placeholder-slate-500' : 'placeholder-gray-400'
            )}
          />
        </div>
      </div>

      {/* 鼠标控制区域 */}
      <div className={cn('px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200')}>
        <div className="flex items-center gap-2 text-primary-600 mb-3">
          <MousePointer2 size={18} />
          <h3 className="font-bold text-base">{t('helpGuide.mouseControls.title')}</h3>
        </div>
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-primary-900/20 border border-primary-800' : 'bg-primary-50/50 border border-primary-100')}>
          <div className="flex justify-between items-center">
            <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{t('helpGuide.mouseControls.rotateView')}</span>
            <span className={cn('text-sm px-2 py-1 rounded border shadow-sm', isDark ? 'bg-slate-700 border-primary-700 text-gray-300' : 'bg-white border-primary-200 text-gray-600')}>{t('helpGuide.mouseControls.rotateViewShortcut')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{t('helpGuide.mouseControls.panCanvas')}</span>
            <span className={cn('text-sm px-2 py-1 rounded border shadow-sm', isDark ? 'bg-slate-700 border-primary-700 text-gray-300' : 'bg-white border-primary-200 text-gray-600')}>{t('helpGuide.mouseControls.panCanvasShortcut')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{t('helpGuide.mouseControls.zoomView')}</span>
            <span className={cn('text-sm px-2 py-1 rounded border shadow-sm', isDark ? 'bg-slate-700 border-primary-700 text-gray-300' : 'bg-white border-primary-200 text-gray-600')}>{t('helpGuide.mouseControls.zoomViewShortcut')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{t('helpGuide.mouseControls.selectNode')}</span>
            <span className={cn('text-sm px-2 py-1 rounded border shadow-sm', isDark ? 'bg-slate-700 border-primary-700 text-gray-300' : 'bg-white border-primary-200 text-gray-600')}>{t('helpGuide.mouseControls.selectNodeShortcut')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>{t('helpGuide.mouseControls.boxSelect')}</span>
            <span className={cn('text-sm px-2 py-1 rounded border shadow-sm', isDark ? 'bg-slate-700 border-primary-700 text-gray-300' : 'bg-white border-primary-200 text-gray-600')}>{t('helpGuide.mouseControls.boxSelectShortcut')}</span>
          </div>
        </div>
      </div>

      {/* AI 功能说明区域 */}
      <div className={cn('px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200')}>
        <div className="flex items-center gap-2 text-primary-600 mb-3">
          <Sparkles size={18} />
          <h3 className="font-bold text-base">{t('helpGuide.aiFeatures.title')}</h3>
        </div>
        <div className="space-y-3">
          <div className={cn('p-4 rounded-xl border', isDark ? 'bg-primary-900/20 border-primary-800' : 'bg-primary-50/50 border-primary-100')}>
            <h4 className={cn('font-bold mb-2 flex items-center gap-2', isDark ? 'text-primary-300' : 'text-primary-800')}>
              <Command size={16} /> {t('helpGuide.aiFeatures.smartExpand.title')}
            </h4>
            <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {t('helpGuide.aiFeatures.smartExpand.description')}
            </p>
          </div>
          <div className={cn('p-4 rounded-xl border', isDark ? 'bg-primary-900/20 border-primary-800' : 'bg-primary-50/50 border-primary-100')}>
            <h4 className={cn('font-bold mb-2 flex items-center gap-2', isDark ? 'text-primary-300' : 'text-primary-800')}>
              <Command size={16} /> {t('helpGuide.aiFeatures.autoQuestion.title')}
            </h4>
            <p className={cn('text-sm leading-relaxed', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {t('helpGuide.aiFeatures.autoQuestion.description')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
          <div key={category} className="mb-6 last:mb-0">
            <h3 className={cn('text-xs font-semibold uppercase tracking-wider mb-3 px-2',
              isDark ? 'text-slate-500' : 'text-gray-400'
            )}>
              {t(`shortcuts.helpPanel.categories.${category}`, { defaultValue: '' })}
            </h3>
            <div className="space-y-1">
              {shortcuts.map(shortcut => {
                const binding = bindings[shortcut.id];
                const isEditing = editingId === shortcut.id;

                return (
                  <div
                    key={shortcut.id}
                    className={cn(
                      'flex items-center justify-between px-3 py-2.5 rounded-lg',
                      isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{t(shortcut.name)}</span>
                        {binding && !binding.enabled && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded',
                            isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'
                          )}>
                            {t('shortcuts.helpPanel.disabled')}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-gray-400')}>
                        {t(shortcut.description)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          readOnly
                          aria-readonly="true"
                          aria-label={t('shortcuts.helpPanel.shortcutField')}
                          placeholder={t('shortcuts.helpPanel.pressNewShortcut')}
                          onKeyDown={(e) => handleKeyCapture(e, shortcut.id)}
                          onBlur={() => {
                            setEditingId(null);
                            setPressedKeys({});
                          }}
                          className={cn(
                            'w-32 px-2 py-1 text-sm text-center rounded border-2 border-primary-500',
                            isDark ? 'bg-slate-800' : 'bg-white',
                            'focus:outline-none'
                          )}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingId(shortcut.id)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors',
                            isDark
                              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                              : 'bg-gray-100 border-gray-200 text-gray-600 hover:border-gray-300'
                          )}
                        >
                          {binding ? formatShortcutKey(binding.keys) : t('shortcuts.helpPanel.notSet')}
                        </button>
                      )}

                      {binding && JSON.stringify(binding.keys) !== JSON.stringify(shortcut.defaultKeys) && (
                        <button
                          onClick={() => resetBinding(shortcut.id)}
                          className={cn('p-1 rounded transition-colors',
                            isDark
                              ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          )}
                          title={t('shortcuts.helpPanel.resetToDefault')}
                          aria-label={t('shortcuts.helpPanel.resetToDefault')}
                        >
                          <RotateCcw size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(groupedShortcuts).length === 0 && (
          <div className="py-12 text-center">
            <p className={isDark ? 'text-slate-500' : 'text-gray-400'}>
              {t('shortcuts.helpPanel.noMatch')}
            </p>
          </div>
        )}
      </div>

      <div className={cn('px-6 py-3 border-t text-xs', isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400')}>
        <div className="flex justify-between items-center">
          <span>{t('shortcuts.helpPanel.customHint')}</span>
          <span>{t('shortcuts.helpPanel.totalCount', { count: DEFAULT_SHORTCUTS.length })}</span>
        </div>
      </div>
    </div>
  );
};

interface ShortcutHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 快捷键帮助浮层（含遮罩与居中容器）。
 *
 * 行为与原实现一致：`isOpen` 控制显隐，点击遮罩或关闭按钮触发 `onClose`。
 * 内部内容委托给 `ShortcutListContent` 渲染。
 */
export const ShortcutHelpPanel: React.FC<ShortcutHelpPanelProps> = ({
  isOpen,
  onClose
}) => {
  const { isDark } = useTheme();
  const titleId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn(
        'relative w-full max-w-3xl max-h-[75vh] rounded-xl shadow-2xl overflow-hidden flex flex-col',
        isDark ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-900'
      )}>
        <ShortcutListContent onClose={onClose} titleId={titleId} />
      </div>
    </div>
  );
};

export const ShortcutHint: React.FC<{ actionId: string; className?: string }> = ({
  actionId,
  className = ''
}) => {
  const { isDark } = useTheme();
  const { bindings, getShortcut } = useShortcutStore();
  const shortcut = getShortcut(actionId);
  const binding = bindings[actionId];

  if (!shortcut || !binding || !binding.enabled) {
    return null;
  }

  return (
    <kbd className={cn(
      'hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border',
      isDark
        ? 'bg-slate-800 border-slate-700 text-slate-400'
        : 'bg-gray-100 border-gray-200 text-gray-500',
      className
    )}>
      {formatShortcutKey(binding.keys)}
    </kbd>
  );
};

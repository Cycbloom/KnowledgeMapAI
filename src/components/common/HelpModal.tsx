import React, { useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, MousePointer2, Keyboard, Command, Sparkles } from 'lucide-react';
import { useFocusTrap } from '../../hooks/common';
import {
  DEFAULT_SHORTCUTS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatShortcutKey,
  ShortcutDefinition,
  ShortcutCategory
} from '../../config/shortcuts';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const groupedShortcuts = useMemo(() => {
    return CATEGORY_ORDER.reduce((acc, category) => {
      const items = DEFAULT_SHORTCUTS.filter(s => s.category === category);
      if (items.length > 0) {
        acc[category] = items;
      }
      return acc;
    }, {} as Record<ShortcutCategory, ShortcutDefinition[]>);
  }, []);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 backdrop-blur-sm" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-500 bg-gray-50/50 dark:bg-slate-900/50">
          <div>
            <h2 id="help-modal-title" className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('helpGuide.title')}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('helpGuide.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-gray-500 dark:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            aria-label={t('common.close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
              <MousePointer2 size={20} aria-hidden="true" />
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{t('helpGuide.mouseControls.title')}</h3>
            </div>
            <div className="bg-primary-50/50 dark:bg-primary-900/20 rounded-xl p-4 space-y-3 border border-primary-100 dark:border-primary-800">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{t('helpGuide.mouseControls.rotateView')}</span>
                <span className="text-sm bg-white dark:bg-slate-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 shadow-sm">{t('helpGuide.mouseControls.rotateViewShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{t('helpGuide.mouseControls.panCanvas')}</span>
                <span className="text-sm bg-white dark:bg-slate-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 shadow-sm">{t('helpGuide.mouseControls.panCanvasShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{t('helpGuide.mouseControls.zoomView')}</span>
                <span className="text-sm bg-white dark:bg-slate-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 shadow-sm">{t('helpGuide.mouseControls.zoomViewShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{t('helpGuide.mouseControls.selectNode')}</span>
                <span className="text-sm bg-white dark:bg-slate-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 shadow-sm">{t('helpGuide.mouseControls.selectNodeShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{t('helpGuide.mouseControls.boxSelect')}</span>
                <span className="text-sm bg-white dark:bg-slate-700 px-2 py-1 rounded border border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 shadow-sm">{t('helpGuide.mouseControls.boxSelectShortcut')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
              <Keyboard size={20} aria-hidden="true" />
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{t('helpGuide.keyboardShortcuts.title')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CATEGORY_ORDER.map(category => {
                const shortcuts = groupedShortcuts[category];
                if (!shortcuts) return null;
                return (
                  <div key={category} className="bg-primary-50/50 dark:bg-primary-900/20 rounded-xl p-4 space-y-2 border border-primary-100 dark:border-primary-800">
                    <h4 className="font-semibold text-sm text-primary-700 dark:text-primary-300">{t(CATEGORY_LABELS[category])}</h4>
                    <div className="space-y-2">
                      {shortcuts.map(shortcut => (
                        <div key={shortcut.id} className="flex justify-between items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">{t(shortcut.name)}</span>
                          <kbd className="bg-white dark:bg-slate-700 px-2 py-1 rounded border border-gray-300 dark:border-slate-500 text-xs font-mono text-gray-600 dark:text-gray-300 shadow-sm text-center whitespace-nowrap">
                            {formatShortcutKey(shortcut.defaultKeys)}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
              <Sparkles size={20} aria-hidden="true" />
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{t('helpGuide.aiFeatures.title')}</h3>
            </div>
            <div className="space-y-4">
              <div className="bg-primary-50/50 dark:bg-primary-900/20 p-4 rounded-xl border border-primary-100 dark:border-primary-800">
                <h4 className="font-bold text-primary-800 dark:text-primary-300 mb-2 flex items-center gap-2">
                  <Command size={16} aria-hidden="true" /> {t('helpGuide.aiFeatures.smartExpand.title')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t('helpGuide.aiFeatures.smartExpand.description')}
                </p>
              </div>
              <div className="bg-primary-50/50 dark:bg-primary-900/20 p-4 rounded-xl border border-primary-100 dark:border-primary-800">
                <h4 className="font-bold text-primary-800 dark:text-primary-300 mb-2 flex items-center gap-2">
                  <Command size={16} aria-hidden="true" /> {t('helpGuide.aiFeatures.autoQuestion.title')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t('helpGuide.aiFeatures.autoQuestion.description')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-500 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 dark:bg-primary-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-primary-700 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:focus-visible:ring-primary-500 dark:focus-visible:ring-offset-slate-800"
          >
            {t('helpGuide.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

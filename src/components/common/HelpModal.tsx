import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, MousePointer2, Keyboard, Command, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{t('helpGuide.title')}</h2>
            <p className="text-gray-500 text-sm mt-1">{t('helpGuide.subtitle')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <MousePointer2 size={20} />
              <h3 className="font-bold text-lg">{t('helpGuide.mouseControls.title')}</h3>
            </div>
            <div className="bg-blue-50/50 rounded-xl p-4 space-y-3 border border-blue-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.mouseControls.rotateView')}</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">{t('helpGuide.mouseControls.rotateViewShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.mouseControls.panCanvas')}</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">{t('helpGuide.mouseControls.panCanvasShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.mouseControls.zoomView')}</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">{t('helpGuide.mouseControls.zoomViewShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.mouseControls.selectNode')}</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">{t('helpGuide.mouseControls.selectNodeShortcut')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.mouseControls.boxSelect')}</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">{t('helpGuide.mouseControls.boxSelectShortcut')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Keyboard size={20} />
              <h3 className="font-bold text-lg">{t('helpGuide.keyboardShortcuts.title')}</h3>
            </div>
            <div className="bg-purple-50/50 rounded-xl p-4 space-y-3 border border-purple-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.keyboardShortcuts.undo')}</span>
                <div className="flex gap-1">
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Ctrl</kbd>
                   <span className="text-gray-400">+</span>
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Z</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.keyboardShortcuts.redo')}</span>
                <div className="flex gap-1">
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Ctrl</kbd>
                   <span className="text-gray-400">+</span>
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Shift</kbd>
                   <span className="text-gray-400">+</span>
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Z</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.keyboardShortcuts.focusModeToggle')}</span>
                <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">F</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">{t('helpGuide.keyboardShortcuts.exitMode')}</span>
                <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Esc</kbd>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Sparkles size={20} />
              <h3 className="font-bold text-lg">{t('helpGuide.aiFeatures.title')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                    <Command size={16} /> {t('helpGuide.aiFeatures.smartExpand.title')}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t('helpGuide.aiFeatures.smartExpand.description')}
                  </p>
               </div>
               <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                    <Command size={16} /> {t('helpGuide.aiFeatures.autoQuestion.title')}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t('helpGuide.aiFeatures.autoQuestion.description')}
                  </p>
               </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors"
          >
            {t('helpGuide.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

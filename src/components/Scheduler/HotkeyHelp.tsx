import React from 'react';
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { HOTKEY_LIST, useFocusTrap, useEscapeKey } from "../../hooks";

interface HotkeyHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HotkeyHelp: React.FC<HotkeyHelpProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-500 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Keyboard size={24} />
                <h2 className="text-lg font-bold">{t('scheduler.hotkeyHelp.title')}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {HOTKEY_LIST.map((hotkey, index) => (
                <motion.div
                  key={hotkey.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {hotkey.description}
                  </span>
                  <kbd className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-sm font-bold shadow-sm">
                    {hotkey.key}
                  </kbd>
                </motion.div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-500">
              <p className="text-xs text-slate-400 text-center">
                {t('scheduler.hotkeyHelp.pressHint')}<kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">?</kbd>{t('scheduler.hotkeyHelp.showAnytimeHint')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

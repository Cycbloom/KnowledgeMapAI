import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, X, Check } from 'lucide-react';

export type ConfirmDialogType = 'warning' | 'danger';

export interface ConfirmDialogProps {
  isOpen: boolean;
  type: ConfirmDialogType;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  type,
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
  isDark,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDanger = type === 'danger';
  const requiredText = confirmText || 'CONFIRM';
  const canConfirm = !isDanger || inputValue === requiredText;

  useEffect(() => {
    if (isOpen && isDanger && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen, isDanger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const handleConfirm = useCallback(() => {
    if (canConfirm) {
      onConfirm();
    }
  }, [canConfirm, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canConfirm) {
      handleConfirm();
    }
  }, [canConfirm, handleConfirm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={onCancel}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl border overflow-hidden ${
              isDark
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-gray-200'
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark ? 'border-slate-600' : 'border-gray-200'
              } ${
                isDanger
                  ? isDark
                    ? 'bg-red-900/30'
                    : 'bg-red-50'
                  : isDark
                    ? 'bg-yellow-900/30'
                    : 'bg-yellow-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {isDanger ? (
                  <AlertTriangle
                    size={20}
                    className={isDark ? 'text-red-400' : 'text-red-600'}
                  />
                ) : (
                  <AlertCircle
                    size={20}
                    className={isDark ? 'text-yellow-400' : 'text-yellow-600'}
                  />
                )}
                <span
                  className={`font-semibold ${
                    isDanger
                      ? isDark
                        ? 'text-red-300'
                        : 'text-red-700'
                      : isDark
                        ? 'text-yellow-300'
                        : 'text-yellow-700'
                  }`}
                >
                  {title}
                </span>
              </div>
              <button
                onClick={onCancel}
                className={`p-1 rounded-md transition-colors ${
                  isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-4">
              <p
                className={`text-sm mb-4 ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}
              >
                {message}
              </p>

              {isDanger && (
                <div className="mb-4">
                  <label
                    className={`block text-xs mb-1.5 ${
                      isDark ? 'text-slate-400' : 'text-gray-500'
                    }`}
                  >
                    请输入 "{requiredText}" 以确认操作
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`输入 ${requiredText}`}
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:border-red-500'
                        : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400 focus:border-red-500'
                    }`}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={onCancel}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDark
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    canConfirm
                      ? isDanger
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : isDark
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Check size={14} />
                  确认
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

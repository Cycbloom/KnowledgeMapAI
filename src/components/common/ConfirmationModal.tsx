import React, { useEffect, useCallback, useState, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useFocusTrap, useEscapeKey } from '../../hooks/common';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  requireConfirmText?: boolean;
  confirmTextToMatch?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  isDangerous = false,
  requireConfirmText = false,
  confirmTextToMatch,
}) => {
  const { t } = useTranslation();
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');

  const finalConfirmText = confirmText ?? t('confirmDialog.confirm');
  const finalCancelText = cancelText ?? t('confirmDialog.cancel');
  const textToMatch = confirmTextToMatch || finalConfirmText;
  const showConfirmInput = isDangerous && requireConfirmText;
  const canConfirm = !showConfirmInput || inputValue === textToMatch;

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && showConfirmInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, showConfirmInput]);

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

  const handleConfirm = useCallback(() => {
    if (canConfirm) {
      onConfirm();
    }
  }, [canConfirm, onConfirm]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canConfirm) {
        handleConfirm();
      }
    },
    [canConfirm, handleConfirm]
  );

  if (!isOpen) return null;

  const titleId = 'confirmation-modal-title';
  const descriptionId = 'confirmation-modal-description';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm"
      role={isDangerous ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-500 sm:max-h-[90dvh]"
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn('p-3 rounded-full flex-shrink-0', isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400')}
            >
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                id={titleId}
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2"
              >
                {title}
              </h3>
              <p
                id={descriptionId}
                className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed break-words"
              >
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
              aria-label={t('common.aria.closeDialog')}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {showConfirmInput && (
          <div className="px-4 sm:px-6 pb-2">
            <label
              className="block text-xs mb-1.5 text-gray-500 dark:text-gray-400"
            >
              {t('confirmDialog.enterToConfirm', { text: textToMatch })}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t('confirmDialog.enterPlaceholder', { text: textToMatch })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:border-red-500 dark:focus:border-red-500"
            />
          </div>
        )}

        <div className="bg-gray-50 dark:bg-slate-900/50 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t dark:border-slate-500">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-500 rounded-lg sm:rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-200 dark:focus-visible:ring-offset-slate-800 dark:focus-visible:ring-slate-700 min-h-[44px] touch-target font-medium"
          >
            {finalCancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 text-white rounded-lg sm:rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-h-[44px] touch-target font-medium',
              canConfirm
                ? isDangerous
                  ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 dark:focus-visible:ring-offset-slate-800'
                  : 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 dark:focus-visible:ring-offset-slate-800'
                : 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-slate-400 cursor-not-allowed'
            )}
          >
            {finalConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

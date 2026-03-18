import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-700 sm:max-h-[90dvh]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed break-words">{message}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 touch-target">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-slate-900/50 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 rounded-lg sm:rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 dark:focus:ring-offset-slate-800 dark:focus:ring-slate-700 min-h-[44px] touch-target font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 text-white rounded-lg sm:rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] touch-target font-medium ${
              isDangerous 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:focus:ring-offset-slate-800' 
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-offset-slate-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

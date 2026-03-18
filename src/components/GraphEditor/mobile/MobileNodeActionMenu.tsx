import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Sparkles, Wand2, Layers, GraduationCap, Trash2, X } from 'lucide-react';

interface MobileNodeActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeTitle?: string;
  onEdit: () => void;
  onAIExpand?: () => void;
  onGenerateCards?: () => void;
  onDelete: () => void;
  onStartLearning?: () => void;
  onGenerateContent?: () => void;
}

const menuItems = [
  { key: 'edit', icon: Edit3, label: '编辑节点', color: 'text-blue-500' },
  { key: 'aiExpand', icon: Sparkles, label: 'AI 拓展', color: 'text-purple-500' },
  { key: 'generateContent', icon: Wand2, label: '生成内容', color: 'text-amber-500' },
  { key: 'generateCards', icon: Layers, label: '生成卡片', color: 'text-emerald-500' },
  { key: 'startLearning', icon: GraduationCap, label: '开始学习', color: 'text-cyan-500' },
] as const;

export const MobileNodeActionMenu: React.FC<MobileNodeActionMenuProps> = ({
  isOpen,
  onClose,
  nodeId: _nodeId,
  nodeTitle,
  onEdit,
  onAIExpand,
  onGenerateCards,
  onDelete,
  onStartLearning,
  onGenerateContent,
}) => {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const getAction = (key: string): (() => void) | undefined => {
    switch (key) {
      case 'edit':
        return onEdit;
      case 'aiExpand':
        return onAIExpand;
      case 'generateContent':
        return onGenerateContent;
      case 'generateCards':
        return onGenerateCards;
      case 'startLearning':
        return onStartLearning;
      default:
        return undefined;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-hidden pb-[var(--safe-area-inset-bottom)]"
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full" />
            </div>

            {nodeTitle && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[85%]">
                    {nodeTitle}
                  </p>
                  <button
                    onClick={onClose}
                    className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="关闭菜单"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
            )}

            <div className="py-2">
              {menuItems.map((item) => {
                const action = getAction(item.key);
                if (!action) return null;

                return (
                  <button
                    key={item.key}
                    onClick={() => handleAction(action)}
                    className="w-full flex items-center gap-4 px-5 py-4 min-h-[52px] text-left rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 dark:active:bg-slate-700 transition-colors"
                    aria-label={item.label}
                  >
                    <item.icon size={22} className={item.color} />
                    <span className="text-base text-gray-700 dark:text-gray-200 font-medium">
                      {item.label}
                    </span>
                  </button>
                );
              })}

              <div className="my-2 border-t border-gray-100 dark:border-slate-700" />

              <button
                onClick={() => handleAction(onDelete)}
                className="w-full flex items-center gap-4 px-5 py-4 min-h-[52px] text-left rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30 transition-colors"
                aria-label="删除节点"
              >
                <Trash2 size={22} className="text-red-500" />
                <span className="text-base text-red-600 dark:text-red-400 font-medium">
                  删除节点
                </span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

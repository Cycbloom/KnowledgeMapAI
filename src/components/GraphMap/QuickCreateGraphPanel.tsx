import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import type { GraphRelationType, QuickCreateGraphRequest } from '../../types';
import { GRAPH_RELATION_LABELS } from '../../types';

interface QuickCreateGraphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: QuickCreateGraphRequest) => Promise<void>;
  relatedGraphId?: string;
  relatedGraphTitle?: string;
  defaultRelationType?: GraphRelationType;
}

export const QuickCreateGraphPanel: React.FC<QuickCreateGraphPanelProps> = ({
  isOpen,
  onClose,
  onSubmit,
  relatedGraphId,
  relatedGraphTitle,
  defaultRelationType = 'related',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [relationType, setRelationType] = useState<GraphRelationType>(defaultRelationType);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        relation_to: relatedGraphId ? {
          graph_id: relatedGraphId,
          type: relationType,
        } : undefined,
        auto_generate_content: autoGenerate,
      });
      onClose();
      setTitle('');
      setDescription('');
      setAutoGenerate(false);
    } catch (error) {
      console.error('Failed to create graph:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const relationTypeOptions: Array<{ value: GraphRelationType; label: string; description: string; color: string }> = [
    { value: 'prerequisite', label: '前置知识', description: '新图谱是当前图谱的前置知识', color: 'bg-blue-500' },
    { value: 'extension', label: '扩展知识', description: '新图谱是当前图谱的扩展知识', color: 'bg-green-500' },
    { value: 'related', label: '相关知识', description: '新图谱与当前图谱相关', color: 'bg-amber-500' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              创建新图谱
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                图谱名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="输入图谱名称..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                描述（可选）
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="描述这个知识领域..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {relatedGraphId && relatedGraphTitle && (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="truncate max-w-[150px]">{relatedGraphTitle}</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                  <span className="text-blue-600 dark:text-blue-400 font-medium">新图谱</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    关系类型
                  </label>
                  <div className="space-y-2">
                    {relationTypeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setRelationType(option.value)}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          relationType === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${option.color}`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <input
                type="checkbox"
                id="autoGenerate"
                checked={autoGenerate}
                onChange={e => setAutoGenerate(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="autoGenerate" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>使用 AI 自动生成初始内容</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              创建图谱
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

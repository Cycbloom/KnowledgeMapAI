import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, Tag, Star, Check, Copy, Plus, Loader2 } from 'lucide-react';
import {
  TaskTemplate,
  TemplateCategory,
  templateApi,
  extractPlaceholders,
  getCategoryBgClass,
  getCategoryTextClass,
} from '../../services/api/template';

interface TaskTemplateSelectorProps {
  onSelect: (template: TaskTemplate) => void;
  onClose: () => void;
  onCreateNew?: () => void;
}

export const TaskTemplateSelector: React.FC<TaskTemplateSelectorProps> = ({
  onSelect,
  onClose,
  onCreateNew,
}) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      const extracted = extractPlaceholders(selectedTemplate);
      const initialPlaceholders: Record<string, string> = {};
      extracted.forEach(key => {
        initialPlaceholders[key] = '';
      });
      setPlaceholders(initialPlaceholders);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await templateApi.getTemplates();
      if (response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await templateApi.getCategories();
      if (response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.title_template.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, TaskTemplate[]>);

  const handleSelectTemplate = (template: TaskTemplate) => {
    const extracted = extractPlaceholders(template);
    if (extracted.length > 0) {
      setSelectedTemplate(template);
    } else {
      onSelect(template);
    }
  };

  const handleApplyWithPlaceholders = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      study: '📚',
      work: '💼',
      life: '🏠',
      health: '💪',
      custom: '⭐',
    };
    return icons[category] || '📋';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      study: '学习',
      work: '工作',
      life: '生活',
      health: '健康',
      custom: '自定义',
    };
    return labels[category] || category;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            选择任务模板
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索模板..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            {onCreateNew && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all"
              >
                <Plus size={18} />
                新建模板
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !selectedCategory
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              全部
            </button>
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat.value
                    ? `${getCategoryBgClass(cat.value)} ${getCategoryTextClass(cat.value)}`
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat.icon} {cat.label} ({cat.count})
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-cyan-500" size={32} />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <p>没有找到匹配的模板</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <span>{getCategoryIcon(category)}</span>
                    {getCategoryLabel(category)}
                    <span className="text-slate-400 dark:text-slate-500">
                      ({categoryTemplates.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryTemplates.map(template => (
                      <motion.button
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectTemplate(template)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'border-cyan-500 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-slate-900 dark:text-white">
                            {template.name}
                          </h4>
                          {template.is_default && (
                            <Star className="text-amber-500" size={16} fill="currentColor" />
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                          {template.title_template}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {template.estimated_duration}分钟
                          </span>
                          {template.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag size={12} />
                              {template.tags.slice(0, 2).join(', ')}
                              {template.tags.length > 2 && `+${template.tags.length - 2}`}
                            </span>
                          )}
                          {template.is_system && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              系统
                            </span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedTemplate && extractPlaceholders(selectedTemplate).length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="p-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  填写模板参数
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {extractPlaceholders(selectedTemplate).map(key => (
                    <div key={key}>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {key}
                      </label>
                      <input
                        type="text"
                        value={placeholders[key] || ''}
                        onChange={e => setPlaceholders(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={`输入${key}...`}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleApplyWithPlaceholders}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all"
                  >
                    应用模板
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

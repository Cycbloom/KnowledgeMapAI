import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, BookOpen, Briefcase, Home, Heart, Star, Clock, Tag } from 'lucide-react';
import { templateApi } from '../../services/api/template';
import { useMessageStore } from '../../store/useMessageStore';
import { useTheme } from '../../hooks/useTheme';

const categoryIcons: Record<string, React.ReactNode> = {
  study: <BookOpen size={18} />,
  work: <Briefcase size={18} />,
  life: <Home size={18} />,
  health: <Heart size={18} />,
  custom: <Star size={18} />,
};

const categoryLabels: Record<string, string> = {
  study: '学习',
  work: '工作',
  life: '生活',
  health: '健康',
  custom: '自定义',
};

interface SaveAsTemplateModalProps {
  task: {
    id: string;
    title: string;
    description?: string;
    estimated_duration?: number;
    tags?: string[];
    priority?: number;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({
  task,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const { addMessage } = useMessageStore();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [category, setCategory] = useState<'study' | 'work' | 'life' | 'health' | 'custom'>('custom');
  const [titleTemplate, setTitleTemplate] = useState(task.title);
  const [descriptionTemplate, setDescriptionTemplate] = useState(task.description || '');
  const [estimatedDuration, setEstimatedDuration] = useState(task.estimated_duration || 25);
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [priority, setPriority] = useState(task.priority || 2);
  const [newTag, setNewTag] = useState('');

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(m => m.slice(2, -2).trim());
  };

  const suggestVariables = () => {
    const words = task.title.split(/\s+/).filter(w => w.length > 2);
    let suggestedTitle = task.title;
    words.slice(0, 2).forEach((word, index) => {
      suggestedTitle = suggestedTitle.replace(word, `{{topic${index > 0 ? index : ''}}}`);
    });
    setTitleTemplate(suggestedTitle);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !titleTemplate) {
      addMessage({ type: 'error', content: '请填写模板名称和标题模板' });
      return;
    }

    setLoading(true);
    try {
      await templateApi.createTemplate({
        name,
        description,
        category,
        title_template: titleTemplate,
        description_template: descriptionTemplate,
        estimated_duration: estimatedDuration,
        tags,
        priority,
      });
      addMessage({ type: 'success', content: '模板保存成功!' });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      addMessage({ type: 'error', content: error.message || '保存模板失败' });
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            保存为任务模板
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="模板名称"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="模板描述（可选）"
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              分类
            </label>
            <div className="flex gap-2">
              {(['study', 'work', 'life', 'health', 'custom'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    category === cat
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {categoryIcons[cat]}
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                标题模板 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={suggestVariables}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                自动提取变量
              </button>
            </div>
            <input
              type="text"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              placeholder="例如：学习：{{topic}}"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
              }`}
            />
            <p className="text-xs text-slate-400 mt-1">
              使用 {'{{变量名}}'} 创建可替换的变量，如 {'{{topic}}'}、{'{{date}}'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              描述模板
            </label>
            <textarea
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              placeholder="描述模板（可选）"
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Clock size={14} className="inline mr-1" />
                预计时长（分钟）
              </label>
              <input
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(parseInt(e.target.value) || 25)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                优先级
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
              >
                <option value={1}>低</option>
                <option value={2}>中</option>
                <option value={3}>高</option>
                <option value={4}>紧急</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Tag size={14} className="inline mr-1" />
              标签
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="添加标签"
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                添加
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                      isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
            <h5 className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              预览
            </h5>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {titleTemplate}
            </p>
            {descriptionTemplate && (
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {descriptionTemplate}
              </p>
            )}
            {extractVariables(titleTemplate).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {extractVariables(titleTemplate).map((v) => (
                  <span key={v} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-xs">
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-medium ${
              isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save size={16} />
            )}
            保存模板
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

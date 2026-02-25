import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Tag, Star, AlertCircle, HelpCircle } from 'lucide-react';
import {
  TaskTemplate,
  CreateTemplateData,
  UpdateTemplateData,
  TEMPLATE_CATEGORIES,
} from '../../services/api/template';

interface TemplateFormProps {
  template?: TaskTemplate;
  onSubmit: (data: CreateTemplateData | UpdateTemplateData) => void;
  onCancel: () => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 25, label: '25 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' },
  { value: 60, label: '1 小时' },
  { value: 90, label: '1.5 小时' },
  { value: 120, label: '2 小时' },
  { value: 180, label: '3 小时' },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: '低', color: 'text-slate-500 dark:text-slate-400' },
  { value: 2, label: '中', color: 'text-blue-600 dark:text-blue-400' },
  { value: 3, label: '高', color: 'text-amber-600 dark:text-amber-400' },
  { value: 4, label: '紧急', color: 'text-red-600 dark:text-red-400' },
];

const COMMON_TAGS = [
  '学习', '工作', '阅读', '写作', '编程', '复习', '项目', '会议', '运动', '休息'
];

export const TemplateForm: React.FC<TemplateFormProps> = ({
  template,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(template?.name || '');
  const [description] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || 'custom');
  const [titleTemplate, setTitleTemplate] = useState(template?.title_template || '');
  const [descriptionTemplate, setDescriptionTemplate] = useState(template?.description_template || '');
  const [estimatedDuration, setEstimatedDuration] = useState(template?.estimated_duration || 25);
  const [tags, setTags] = useState<string[]>(template?.tags || []);
  const [customTag, setCustomTag] = useState('');
  const [priority, setPriority] = useState(template?.priority || 2);
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(false);

  const isEditing = !!template;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = '请输入模板名称';
    }
    if (name.length > 50) {
      newErrors.name = '名称不能超过50个字符';
    }
    if (!titleTemplate.trim()) {
      newErrors.titleTemplate = '请输入标题模板';
    }
    if (titleTemplate.length > 100) {
      newErrors.titleTemplate = '标题模板不能超过100个字符';
    }
    if (descriptionTemplate && descriptionTemplate.length > 500) {
      newErrors.descriptionTemplate = '描述模板不能超过500个字符';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateTemplateData | UpdateTemplateData = {
      name: name.trim(),
      description: description.trim() || undefined,
      category: category as 'study' | 'work' | 'life' | 'health' | 'custom',
      title_template: titleTemplate.trim(),
      description_template: descriptionTemplate.trim() || undefined,
      estimated_duration: estimatedDuration,
      tags: tags.length > 0 ? tags : undefined,
      priority,
      is_default: isDefault,
    };

    onSubmit(data);
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
    }
    setCustomTag('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      addTag(customTag.trim());
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setTitleTemplate(prev => prev + `{{${placeholder}}}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEditing ? '编辑模板' : '创建新模板'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              模板名称 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：深度学习模板"
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                errors.name ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              分类
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    category === cat.value
                      ? `bg-${cat.color}-100 dark:bg-${cat.color}-500/20 text-${cat.color}-700 dark:text-${cat.color}-300 ring-1 ring-current`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                标题模板 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <HelpCircle size={16} />
              </button>
            </div>
            {showHelp && (
              <div className="mb-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  使用 <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20">{'{{变量名}}'}</code> 格式创建可替换的占位符
                </p>
                <div className="flex flex-wrap gap-1">
                  {['topic', 'project', 'task', 'name'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => insertPlaceholder(p)}
                      className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30"
                    >
                      {`{{${p}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input
              type="text"
              value={titleTemplate}
              onChange={e => setTitleTemplate(e.target.value)}
              placeholder="例如：学习：{{topic}}"
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                errors.titleTemplate ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            />
            {errors.titleTemplate && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.titleTemplate}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              描述模板
            </label>
            <textarea
              value={descriptionTemplate}
              onChange={e => setDescriptionTemplate(e.target.value)}
              placeholder="可选的描述模板，支持 {{占位符}}..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                预计时长
              </label>
              <select
                value={estimatedDuration}
                onChange={e => setEstimatedDuration(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Star size={14} className="inline mr-1" />
                优先级
              </label>
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      priority === opt.value
                        ? `bg-slate-100 dark:bg-slate-700 ${opt.color} ring-1 ring-current`
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Tag size={14} className="inline mr-1" />
              标签 (最多5个)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_TAGS.filter(t => !tags.includes(t)).slice(0, 6).map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  disabled={tags.length >= 5}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入自定义标签，按 Enter 添加..."
              disabled={tags.length >= 5}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">
              设为该分类的默认模板
            </label>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20"
          >
            {isEditing ? '保存修改' : '创建模板'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

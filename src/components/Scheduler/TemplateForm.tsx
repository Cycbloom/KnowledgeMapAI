import React, { useState, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, Clock, Tag, Star, AlertCircle, HelpCircle } from 'lucide-react';
import {
  TaskTemplate,
  CreateTemplateData,
  UpdateTemplateData,
  TEMPLATE_CATEGORIES,
} from '../../services/api/taskTemplates';
import { useFormDraft } from '../../hooks';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface TemplateFormProps {
  template?: TaskTemplate;
  onSubmit: (data: CreateTemplateData | UpdateTemplateData) => void;
  onCancel: () => void;
}

export const TemplateForm: React.FC<TemplateFormProps> = ({
  template,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [customTag, setCustomTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(false);

  const isEditing = !!template;

  const fieldIdBase = useId();
  const nameFieldId = `${fieldIdBase}-name`;
  const nameErrorId = `${fieldIdBase}-name-error`;
  const titleTemplateFieldId = `${fieldIdBase}-titleTemplate`;
  const titleTemplateErrorId = `${fieldIdBase}-titleTemplate-error`;
  const descriptionTemplateFieldId = `${fieldIdBase}-descriptionTemplate`;
  const estimatedDurationFieldId = `${fieldIdBase}-estimatedDuration`;
  const tagsFieldId = `${fieldIdBase}-tags`;

  const DURATION_OPTIONS = [
    { value: 15, label: t('scheduler.templateForm.duration15min') },
    { value: 25, label: t('scheduler.templateForm.duration25min') },
    { value: 30, label: t('scheduler.templateForm.duration30min') },
    { value: 45, label: t('scheduler.templateForm.duration45min') },
    { value: 60, label: t('scheduler.templateForm.duration1hour') },
    { value: 90, label: t('scheduler.templateForm.duration1_5hours') },
    { value: 120, label: t('scheduler.templateForm.duration2hours') },
    { value: 180, label: t('scheduler.templateForm.duration3hours') },
  ];

  const PRIORITY_OPTIONS = [
    { value: 1, label: t('scheduler.templateForm.priorityLow'), color: 'text-slate-500 dark:text-slate-400' },
    { value: 2, label: t('scheduler.templateForm.priorityMedium'), color: 'text-primary-600 dark:text-primary-400' },
    { value: 3, label: t('scheduler.templateForm.priorityHigh'), color: 'text-amber-600 dark:text-amber-400' },
    { value: 4, label: t('scheduler.templateForm.priorityUrgent'), color: 'text-red-600 dark:text-red-400' },
  ];

  const COMMON_TAGS = [
    t('scheduler.templateForm.tagStudy'),
    t('scheduler.templateForm.tagWork'),
    t('scheduler.templateForm.tagReading'),
    t('scheduler.templateForm.tagWriting'),
    t('scheduler.templateForm.tagCoding'),
    t('scheduler.templateForm.tagReview'),
    t('scheduler.templateForm.tagProject'),
    t('scheduler.templateForm.tagMeeting'),
    t('scheduler.templateForm.tagExercise'),
    t('scheduler.templateForm.tagRest'),
  ];

  interface TemplateFormDraft {
    name: string;
    description: string;
    category: string;
    titleTemplate: string;
    descriptionTemplate: string;
    estimatedDuration: number;
    tags: string[];
    priority: number;
    isDefault: boolean;
  }

  const initialDraft: TemplateFormDraft = {
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'custom',
    titleTemplate: template?.title_template || '',
    descriptionTemplate: template?.description_template || '',
    estimatedDuration: template?.estimated_duration || 25,
    tags: template?.tags || [],
    priority: template?.priority || 2,
    isDefault: template?.is_default || false,
  };

  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<TemplateFormDraft>({
    key: 'templateForm_draft',
    initialValue: initialDraft,
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t('scheduler.templateForm.errorNameRequired');
    }
    if (formData.name.length > 50) {
      newErrors.name = t('scheduler.templateForm.errorNameTooLong');
    }
    if (!formData.titleTemplate.trim()) {
      newErrors.titleTemplate = t('scheduler.templateForm.errorTitleTemplateRequired');
    }
    if (formData.titleTemplate.length > 100) {
      newErrors.titleTemplate = t('scheduler.templateForm.errorTitleTemplateTooLong');
    }
    if (formData.descriptionTemplate && formData.descriptionTemplate.length > 500) {
      newErrors.descriptionTemplate = t('scheduler.templateForm.errorDescriptionTemplateTooLong');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: CreateTemplateData | UpdateTemplateData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      category: formData.category as 'knowledge' | 'project' | 'analysis' | 'architecture' | 'topicResearch' | 'creative',
      title_template: formData.titleTemplate.trim(),
      description_template: formData.descriptionTemplate.trim() || undefined,
      estimated_duration: formData.estimatedDuration,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      priority: formData.priority,
      is_default: formData.isDefault,
    };

    onSubmit(data);
    clearDraft();
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setCustomTag('');
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      addTag(customTag.trim());
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setFormData(prev => ({ ...prev, titleTemplate: `${prev.titleTemplate  }{{${placeholder}}}` }));
  };

  const availableCommonTags = useMemo(
    () => COMMON_TAGS.filter(t => !formData.tags.includes(t)).slice(0, 6),
    [formData.tags]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-500 rounded-2xl shadow-2xl overflow-hidden max-h-[95dvh] sm:max-h-[90dvh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEditing ? t('scheduler.templateForm.editTemplate') : t('scheduler.templateForm.createTemplate')}
          </h2>
          <button
            onClick={onCancel}
            className="p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors touch-target"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 sm:space-y-4 max-h-[calc(95dvh-140px)] sm:max-h-[calc(90dvh-140px)] overflow-y-auto">
          <div>
            <label htmlFor={nameFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('scheduler.templateForm.fieldName')} <span aria-hidden="true" className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              id={nameFieldId}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? nameErrorId : undefined}
              type="text"
              autoComplete="off"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('scheduler.templateForm.fieldNamePlaceholder')}
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${
                errors.name ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            />
            {errors.name && (
              <p role="alert" id={nameErrorId} className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('scheduler.templateForm.fieldCategory')}
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    formData.category === cat.value
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
              <label htmlFor={titleTemplateFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('scheduler.templateForm.fieldTitleTemplate')} <span aria-hidden="true" className="text-red-500 dark:text-red-400">*</span>
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
              <div className="mb-2 p-3 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30">
                <p className="text-xs text-primary-700 dark:text-primary-300 mb-2">
                  {t('scheduler.templateForm.helpPlaceholderPrefix')} <code className="px-1 py-0.5 rounded bg-primary-100 dark:bg-primary-500/20">{`{{${t('scheduler.templateForm.helpPlaceholderExample')}}}`}</code> {t('scheduler.templateForm.helpPlaceholderSuffix')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {['topic', 'project', 'task', 'name'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => insertPlaceholder(p)}
                      className="px-2 py-1 rounded text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-500/30"
                    >
                      {`{{${p}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input
              id={titleTemplateFieldId}
              aria-invalid={!!errors.titleTemplate}
              aria-describedby={errors.titleTemplate ? titleTemplateErrorId : undefined}
              type="text"
              autoComplete="off"
              value={formData.titleTemplate}
              onChange={e => setFormData(prev => ({ ...prev, titleTemplate: e.target.value }))}
              placeholder={t('scheduler.templateForm.fieldTitleTemplatePlaceholder', { example: '{{topic}}' })}
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${
                errors.titleTemplate ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            />
            {errors.titleTemplate && (
              <p role="alert" id={titleTemplateErrorId} className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.titleTemplate}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={descriptionTemplateFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('scheduler.templateForm.fieldDescriptionTemplate')}
            </label>
            <textarea
              id={descriptionTemplateFieldId}
              autoComplete="off"
              value={formData.descriptionTemplate}
              onChange={e => setFormData(prev => ({ ...prev, descriptionTemplate: e.target.value }))}
              placeholder={t('scheduler.templateForm.fieldDescriptionTemplatePlaceholder', { example: `{{${t('scheduler.templateForm.descriptionPlaceholderExample')}}}` })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={estimatedDurationFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                {t('scheduler.templateForm.fieldEstimatedDuration')}
              </label>
              <select
                id={estimatedDurationFieldId}
                value={formData.estimatedDuration}
                onChange={e => setFormData(prev => ({ ...prev, estimatedDuration: Number(e.target.value) }))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Star size={14} className="inline mr-1" />
                {t('scheduler.templateForm.fieldPriority')}
              </label>
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: opt.value }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.priority === opt.value
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
            <label htmlFor={tagsFieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <Tag size={14} className="inline mr-1" />
              {t('scheduler.templateForm.fieldTags')}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 text-sm flex items-center gap-1"
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
              {availableCommonTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  disabled={formData.tags.length >= 5}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <input
              id={tagsFieldId}
              type="text"
              autoComplete="off"
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('scheduler.templateForm.fieldCustomTagPlaceholder')}
              disabled={formData.tags.length >= 5}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={e => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-500 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor="isDefault" className="text-sm text-slate-700 dark:text-slate-300">
              {t('scheduler.templateForm.fieldIsDefault')}
            </label>
          </div>
        </form>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-500 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors min-h-[44px] touch-target font-medium"
          >
            {t('scheduler.templateForm.buttonCancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium hover:from-primary-400 hover:to-primary-400 transition-all shadow-lg shadow-primary-500/20 min-h-[44px] touch-target"
          >
            {isEditing ? t('scheduler.templateForm.buttonSaveChanges') : t('scheduler.templateForm.buttonCreateTemplate')}
          </button>
        </div>
      </motion.div>
      {!isEditing && showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t('common.restoreDraftTitle')}
          message={t('common.restoreDraftMessage')}
          isDangerous={false}
        />
      )}
    </motion.div>
  );
};

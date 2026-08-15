import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  RelationshipTypeConfig,
  RelationshipCategory,
  EdgeLineStyle,
} from '../../../types';
import { request } from '../../../services/api';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../../hooks/common';

interface RelationshipTypeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_KEYS: Record<RelationshipCategory | 'all', string> = {
  all: 'graphEditor.relationshipType.categoryAll',
  hierarchical: 'graphEditor.relationshipType.categoryHierarchical',
  dependency: 'graphEditor.relationshipType.categoryDependency',
  semantic: 'graphEditor.relationshipType.categorySemantic',
  temporal: 'graphEditor.relationshipType.categoryTemporal',
  interaction: 'graphEditor.relationshipType.categoryInteraction',
  causal: 'graphEditor.relationshipType.categoryCausal',
  custom: 'graphEditor.relationshipType.categoryCustom',
};

const LINE_STYLE_OPTIONS: { value: EdgeLineStyle; labelKey: string }[] = [
  { value: 'solid', labelKey: 'graphEditor.relationshipType.lineStyleSolid' },
  { value: 'dashed', labelKey: 'graphEditor.relationshipType.lineStyleDashed' },
  { value: 'dotted', labelKey: 'graphEditor.relationshipType.lineStyleDotted' },
  { value: 'double', labelKey: 'graphEditor.relationshipType.lineStyleDouble' },
];

const ARROW_OPTIONS: { value: boolean | 'auto'; labelKey: string }[] = [
  { value: true, labelKey: 'graphEditor.relationshipType.arrowShow' },
  { value: false, labelKey: 'graphEditor.relationshipType.arrowHide' },
  { value: 'auto', labelKey: 'graphEditor.relationshipType.arrowAuto' },
];

const CATEGORY_OPTIONS: { value: RelationshipCategory; labelKey: string }[] = [
  { value: 'hierarchical', labelKey: 'graphEditor.relationshipType.categoryHierarchical' },
  { value: 'dependency', labelKey: 'graphEditor.relationshipType.categoryDependency' },
  { value: 'semantic', labelKey: 'graphEditor.relationshipType.categorySemantic' },
  { value: 'temporal', labelKey: 'graphEditor.relationshipType.categoryTemporal' },
  { value: 'interaction', labelKey: 'graphEditor.relationshipType.categoryInteraction' },
  { value: 'causal', labelKey: 'graphEditor.relationshipType.categoryCausal' },
  { value: 'custom', labelKey: 'graphEditor.relationshipType.categoryCustom' },
];

const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#22C55E', '#6366F1', '#F97316',
];

interface FormData {
  name: string;
  display_name: string;
  category: RelationshipCategory;
  color: string;
  line_style: EdgeLineStyle;
  show_arrow: boolean | 'auto';
}

const initialFormData: FormData = {
  name: '',
  display_name: '',
  category: 'custom',
  color: '#3B82F6',
  line_style: 'solid',
  show_arrow: 'auto',
};

export const RelationshipTypeSettings: React.FC<RelationshipTypeSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipTypeConfig[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RelationshipCategory | 'all'>('all');
  const [editingType, setEditingType] = useState<RelationshipTypeConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<RelationshipCategory>>(
    new Set(['hierarchical', 'dependency', 'semantic'])
  );
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      fetchRelationshipTypes();
    }
  }, [isOpen]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchRelationshipTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<{ data?: RelationshipTypeConfig[] }>('/relationship-types', {
        headers: getAuthHeaders(),
      });
      setRelationshipTypes(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('graphEditor.relationshipType.fetchFailed', { defaultValue: '' }));
    } finally {
      setLoading(false);
    }
  };

  const createRelationshipType = async () => {
    setLoading(true);
    setError(null);
    try {
      await request('/relationship-types', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });
      await fetchRelationshipTypes();
      setIsCreating(false);
      setFormData(initialFormData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('graphEditor.relationshipType.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const updateRelationshipType = async () => {
    if (!editingType) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/relationship-types/${encodeURIComponent(editingType.id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          display_name: formData.display_name,
          category: formData.category,
          color: formData.color,
          line_style: formData.line_style,
          show_arrow: formData.show_arrow,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update relationship type');
      }
      await fetchRelationshipTypes();
      setEditingType(null);
      setFormData(initialFormData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('graphEditor.relationshipType.updateFailed', { defaultValue: '' }));
    } finally {
      setLoading(false);
    }
  };

  const deleteRelationshipType = async (id: string) => {
    if (!await asyncConfirm({
      title: t('graphEditor.confirmDeleteRelationshipTitle'),
      message: t('graphEditor.confirmDeleteRelationshipMessage'),
      isDangerous: true,
    })) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/relationship-types/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete relationship type');
      }
      await fetchRelationshipTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('graphEditor.relationshipType.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type: RelationshipTypeConfig) => {
    setEditingType(type);
    setIsCreating(false);
    setFormData({
      name: type.name,
      display_name: type.display_name,
      category: type.category,
      color: type.color,
      line_style: type.line_style,
      show_arrow: type.show_arrow,
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingType(null);
    setFormData(initialFormData);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingType(null);
    setFormData(initialFormData);
    setError(null);
  };

  const toggleCategory = (category: RelationshipCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredTypes = useMemo(
    () => selectedCategory === 'all'
      ? relationshipTypes
      : relationshipTypes.filter(t => t.category === selectedCategory),
    [selectedCategory, relationshipTypes],
  );

  const groupedTypes = useMemo(() => filteredTypes.reduce((acc, type) => {
    const category = type.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(type);
    return acc;
  }, {} as Record<RelationshipCategory, RelationshipTypeConfig[]>), [filteredTypes]);

  const renderLineStylePreview = (style: EdgeLineStyle) => {
    switch (style) {
      case 'solid':
        return <div className="w-full h-0.5 bg-current" />;
      case 'dashed':
        return <div className="w-full h-0.5 border-t-2 border-dashed border-current" />;
      case 'dotted':
        return <div className="w-full h-0.5 border-t-2 border-dotted border-current" />;
      case 'double':
        return (
          <div className="w-full flex flex-col gap-0.5">
            <div className="w-full h-0.5 bg-current" />
            <div className="w-full h-0.5 bg-current" />
          </div>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose} role="presentation">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[800px] max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-500">
          <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-white">{t('graphEditor.relationshipType.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex h-[calc(85vh-140px)]">
          <div className="w-48 border-r border-gray-200 dark:border-slate-500 p-4 overflow-y-auto">
            <div className="space-y-1">
              {(Object.keys(CATEGORY_KEYS) as (RelationshipCategory | 'all')[]).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === category
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {t(CATEGORY_KEYS[category], { defaultValue: '' })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {loading && !isCreating && !editingType && (
              <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                <span className="sr-only">{t('common.loading')}</span>
              </div>
            )}

            {!loading && !isCreating && !editingType && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('graphEditor.relationshipType.totalCount', { count: filteredTypes.length })}
                  </p>
                  <button
                    onClick={handleCreate}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('graphEditor.relationshipType.createNew')}
                  </button>
                </div>

                <div className="space-y-4">
                  {(Object.keys(groupedTypes) as RelationshipCategory[]).map(category => (
                    <div key={category} className="border border-gray-200 dark:border-slate-500 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {t(CATEGORY_KEYS[category], { defaultValue: '' })}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          {t('graphEditor.relationshipType.itemCount', { count: groupedTypes[category].length })}
                        </span>
                      </button>

                      {expandedCategories.has(category) && (
                        <div className="divide-y divide-gray-200 dark:divide-slate-700">
                          {groupedTypes[category].map(type => (
                            <div
                              key={type.id}
                              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-6 h-6 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: type.color }}
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {/* i18n: dynamic key from backend relationship type. display_name may be a
                                          preset i18n key (is_builtin=true) or user-entered literal text. */}
                                      {t(type.display_name as never)}
                                    </span>
                                    {type.is_builtin && (
                                      <span title={t('graphEditor.relationshipType.builtinType')}>
                                        <svg aria-hidden="true"
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          className="text-gray-400"
                                        >
                                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>{type.name}</span>
                                    <span className="w-8">{renderLineStylePreview(type.line_style)}</span>
                                    <span>
                                      {type.show_arrow === true ? '→' : type.show_arrow === false ? '—' : '↔'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {!type.is_builtin && (
                                  <>
                                    <button
                                      onClick={() => handleEdit(type)}
                                      className="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                      title={t('graphEditor.relationshipType.editAction')}
                                    >
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteRelationshipType(type.id)}
                                      className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                      title={t('graphEditor.relationshipType.deleteAction')}
                                    >
                                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(isCreating || editingType) && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {isCreating ? t('graphEditor.relationshipType.createNew') : t('graphEditor.relationshipType.editTitle')}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('graphEditor.relationshipType.nameLabel')}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      disabled={!!editingType}
                      placeholder={t('graphEditor.relationshipType.namePlaceholder')}
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        editingType ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    {editingType && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('graphEditor.relationshipType.nameImmutable')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('graphEditor.relationshipType.displayNameLabel')}
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder={t('graphEditor.relationshipType.displayNamePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('graphEditor.relationshipType.categoryLabel')}
                    </label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value as RelationshipCategory })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {CATEGORY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey, { defaultValue: '' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('graphEditor.relationshipType.colorLabel')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        aria-label={t('graphEditor.relationshipType.colorLabel')}
                        className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-slate-500"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {DEFAULT_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          aria-label={t('graphEditor.relationshipType.colorSwatch', { hex: color })}
                          className={`w-6 h-6 rounded-full border-2 ${
                            formData.color === color
                              ? 'border-primary-500 ring-2 ring-primary-200'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('graphEditor.relationshipType.lineStyleLabel')}
                    </label>
                    <select
                      value={formData.line_style}
                      onChange={e => setFormData({ ...formData, line_style: e.target.value as EdgeLineStyle })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {LINE_STYLE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey, { defaultValue: '' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('graphEditor.relationshipType.arrowLabel')}
                    </label>
                    <select
                      value={typeof formData.show_arrow === 'boolean' ? String(formData.show_arrow) : 'auto'}
                      onChange={e => {
                        const value = e.target.value;
                        setFormData({
                          ...formData,
                          show_arrow: value === 'auto' ? 'auto' : value === 'true',
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {ARROW_OPTIONS.map(option => (
                        <option
                          key={String(option.value)}
                          value={typeof option.value === 'boolean' ? String(option.value) : 'auto'}
                        >
                          {t(option.labelKey, { defaultValue: '' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-slate-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('graphEditor.relationshipType.preview')}</p>
                    <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                      <svg aria-hidden="true" width="200" height="40" viewBox="0 0 200 40">
                        <line
                          x1="20"
                          y1="20"
                          x2="160"
                          y2="20"
                          stroke={formData.color}
                          strokeWidth="2"
                          strokeDasharray={
                            formData.line_style === 'dashed'
                              ? '8, 4'
                              : formData.line_style === 'dotted'
                              ? '2, 4'
                              : formData.line_style === 'double'
                              ? 'none'
                              : 'none'
                          }
                        />
                        {formData.line_style === 'double' && (
                          <>
                            <line x1="20" y1="17" x2="160" y2="17" stroke={formData.color} strokeWidth="2" />
                            <line x1="20" y1="23" x2="160" y2="23" stroke={formData.color} strokeWidth="2" />
                          </>
                        )}
                        {(formData.show_arrow === true || formData.show_arrow === 'auto') && (
                          <polygon
                            points="160,20 150,15 150,25"
                            fill={formData.color}
                          />
                        )}
                        <circle cx="20" cy="20" r="8" fill="#6B7280" />
                        <circle cx="180" cy="20" r="8" fill="#6B7280" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {t('graphEditor.relationshipType.cancel')}
                  </button>
                  <button
                    onClick={isCreating ? createRelationshipType : updateRelationshipType}
                    disabled={loading || !formData.name || !formData.display_name}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? t('graphEditor.relationshipType.saving') : t('graphEditor.relationshipType.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { domainsApi } from '../../services/api/domains';
import type { DomainTreeNode } from '@shared/types/graph';
import { message } from '@/utils/messageHelper';
import { useIsMobile } from '../../hooks';
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';

interface DomainManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#3B82F6',
];

interface FormData {
  name: string;
  description: string;
  color: string;
  parent_id: string | null;
  icon: string;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  color: PRESET_COLORS[0],
  parent_id: null,
  icon: '',
};

interface SortableDomainItemProps {
  domain: DomainTreeNode;
  onEdit: (domain: DomainTreeNode) => void;
  onDelete: (domainId: string) => void;
  depth?: number;
  isExpanded?: boolean;
  hasChildrenFn: (node: DomainTreeNode) => boolean;
  onToggleExpand: (id: string) => void;
  setSize?: number;
  posInSet?: number;
}

function SortableDomainItem({
  domain,
  onEdit,
  onDelete,
  depth = 0,
  isExpanded = false,
  hasChildrenFn,
  onToggleExpand,
  setSize,
  posInSet,
}: SortableDomainItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: domain.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const showChildren = hasChildrenFn(domain) && isExpanded;
  const hasChildren = hasChildrenFn(domain);
  const childrenId = `domain-children-${domain.id}`;
  const childCount = hasChildren ? domain.children.length : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-roledescription={t('graphMap.a11y.draggableNode')}
      aria-label={domain.name}
    >
      <div
        className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
          depth > 0 ? `ml-${  Math.min(depth * 4, 16)}` : ''
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <button
          type="button"
          aria-label={t('common.aria.dragHandle')}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>

        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(domain.id)}
            aria-expanded={isExpanded}
            aria-controls={childrenId}
            aria-label={
              isExpanded
                ? t('common.collapse', { defaultValue: '折叠' })
                : t('common.expand', { defaultValue: '展开' })
            }
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}

        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: domain.color }}
          aria-hidden="true"
        />

        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate min-w-0">
          {domain.icon && <span className="mr-1" aria-hidden="true">{domain.icon}</span>}
          {domain.name}
        </span>

        {domain.graphCount !== undefined && domain.graphCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
            {domain.graphCount}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {!domain.is_system && (
            <>
              <button
                onClick={() => onEdit(domain)}
                className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded"
                aria-label={t('common.edit')}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => onDelete(domain.id)}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                aria-label={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {showChildren && (
        <div role="group" id={childrenId}>
          {domain.children.map((child, index) => (
            <SortableDomainItem
              key={child.id}
              domain={child}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
              isExpanded={false}
              hasChildrenFn={hasChildrenFn}
              onToggleExpand={onToggleExpand}
              setSize={childCount}
              posInSet={index + 1}
            />
          ))}
        </div>
      )
      }
    </div>
  );
}

export const DomainManager: React.FC<DomainManagerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const deviceInfo = useIsMobile();
  const isMobile = deviceInfo.isMobile;
  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);

  const [domains, setDomains] = useState<DomainTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [aiColorRecommendation, setAiColorRecommendation] = useState<{
    color: string;
    reason: string;
  } | null>(null);
  const [isGeneratingColor, setIsGeneratingColor] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await domainsApi.getTree();
      setDomains(tree);
      const firstLevelIds = new Set(tree.map(d => d.id));
      setExpandedIds(firstLevelIds);
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      message.error(t('graphMap.domainManager.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDomains();
    }
  }, [isOpen, fetchDomains]);

  useEffect(() => {
    if (!isOpen) {
      setShowCreateForm(false);
      setEditingId(null);
      setFormData(initialFormData);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      await domainsApi.create({
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim() || undefined,
        parent_id: formData.parent_id || undefined,
        icon: formData.icon.trim() || undefined,
      });
      await fetchDomains();
      setShowCreateForm(false);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Failed to create domain:', error);
      message.error(t('graphMap.domainManager.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (domain: DomainTreeNode) => {
    setEditingId(domain.id);
    setFormData({
      name: domain.name,
      description: domain.description || '',
      color: domain.color,
      parent_id: domain.parent_id || null,
      icon: domain.icon || '',
    });
    setShowCreateForm(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    setSubmitting(true);
    try {
      await domainsApi.update(editingId, {
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim() || undefined,
        parent_id: formData.parent_id || undefined,
        icon: formData.icon.trim() || undefined,
      });
      await fetchDomains();
      setEditingId(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Failed to update domain:', error);
      message.error(t('graphMap.domainManager.updateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (domainId: string) => {
    setSubmitting(true);
    try {
      await domainsApi.delete(domainId);
      await fetchDomains();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete domain:', error);
      message.error(t('graphMap.domainManager.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(initialFormData);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = domains.findIndex(d => d.id === String(active.id));
    const newIndex = domains.findIndex(d => d.id === String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const newDomains = arrayMove(domains, oldIndex, newIndex);
    setDomains(newDomains);

    try {
      const reorderItems = newDomains.map((d, index) => ({
        id: d.id,
        parent_id: d.parent_id || null,
        sort_order: index,
      }));

      await domainsApi.reorder({ reorder_items: reorderItems });
    } catch (error) {
      console.error('Failed to reorder domains:', error);
      setDomains(arrayMove(newDomains, newIndex, oldIndex));
      message.error(t('graphMap.domainManager.reorderFailed'));
    }
  };

  const handleAIGenerateColor = async () => {
    if (!formData.name) return;

    setIsGeneratingColor(true);
    setAiColorRecommendation(null);

    try {
      const result = await domainsApi.generateColor(
        formData.name,
        formData.description || undefined
      );
      setAiColorRecommendation(result);
    } catch (error) {
      console.error('Failed to generate AI color:', error);
      message.error(t('graphMap.domainManager.generateColorFailed'));
    } finally {
      setIsGeneratingColor(false);
    }
  };

  const handleApplyAiColor = () => {
    if (aiColorRecommendation) {
      setFormData(prev => ({ ...prev, color: aiColorRecommendation.color }));
      setAiColorRecommendation(null);
    }
  };

  const getAllDomainsFlat = (nodes: DomainTreeNode[]): DomainTreeNode[] => {
    const result: DomainTreeNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        result.push(...getAllDomainsFlat(node.children));
      }
    }
    return result;
  };

  const renderColorPicker = (value: string, onChange: (color: string) => void) => (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-1.5">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              value === color
                ? 'border-gray-900 dark:border-white scale-110'
                : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={handleAIGenerateColor}
        disabled={isGeneratingColor || !formData.name}
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-primary-500 to-pink-500 text-white hover:from-primary-600 hover:to-pink-600 disabled:opacity-50 transition-all"
      >
        {isGeneratingColor ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {t('graphMap.domainManager.aiRecommend')}
      </button>
      {aiColorRecommendation && (
        <div className="mt-3 p-3 bg-gradient-to-r from-primary-50 to-pink-50 dark:from-primary-900/20 dark:to-pink-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-8 h-8 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: aiColorRecommendation.color }}
            />
            <div className="flex-1">
              <div className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {aiColorRecommendation.color}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {aiColorRecommendation.reason}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleApplyAiColor}
              className="flex-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
            >
              {t('graphMap.domainManager.applyColor')}
            </button>
            <button
              onClick={handleAIGenerateColor}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {t('graphMap.domainManager.tryAnother')}
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.domainManager.customColor')}</span>
        <input
          type="text"
          aria-required={true}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  );

  const renderForm = (isEdit: boolean, onCancel: () => void) => (
    <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-t border-b border-gray-200 dark:border-gray-600 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('graphMap.domainManager.nameRequired')} <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          type="text"
          aria-required={true}
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder={t('graphMap.domainManager.descriptionPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('graphMap.domainManager.descriptionOptional')}
        </label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('graphMap.domainManager.descriptionPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('graphMap.domainManager.colorRequired')} <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        {renderColorPicker(formData.color, color => setFormData(prev => ({ ...prev, color })))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('graphMap.domainManager.parentOptional')}
        </label>
        <select
          value={formData.parent_id || ''}
          onChange={e => setFormData(prev => ({ ...prev, parent_id: e.target.value || null }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">{t('graphMap.domainManager.noParent')}</option>
          {getAllDomainsFlat(domains)
            .filter(d => d.id !== editingId)
            .map(d => (
              <option key={d.id} value={d.id}>
                {'─'.repeat(getNodeDepth(domains, d.id))} {d.name}
              </option>
            ))
          }
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('graphMap.domainManager.iconOptional')}
        </label>
        <input
          type="text"
          value={formData.icon}
          onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))}
          placeholder={t('graphMap.domainManager.iconPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={isEdit ? handleUpdate : handleCreate}
          disabled={!formData.name.trim() || submitting}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? t('common.save') : t('common.create')}
        </button>
      </div>
    </div>
  );

  const getNodeDepth = (nodes: DomainTreeNode[], targetId: string, currentDepth: number = 0): number => {
    for (const node of nodes) {
      if (node.id === targetId) return currentDepth;
      if (node.children.length > 0) {
        const found = getNodeDepth(node.children, targetId, currentDepth + 1);
        if (found >= 0) return found;
      }
    }
    return -1;
  };

  const hasChildren = (node: DomainTreeNode): boolean => node.children.length > 0;

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
            ref={containerRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden ${
              isMobile ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-2xl mx-4'
            }`}
            onClick={e => e.stopPropagation()}
          >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('graphMap.domainManager.title')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('common.aria.close')}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setEditingId(null);
                setFormData(initialFormData);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('graphMap.domainManager.createDomain')}
            </button>
          </div>

          {showCreateForm && !editingId && renderForm(false, () => setShowCreateForm(false))}

          <div className={`${isMobile ? 'flex-1' : 'max-h-[500px]'} overflow-y-auto`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-sm">{t('graphMap.domainManager.noDomains')}</p>
                <p className="text-xs mt-1">{t('graphMap.domainManager.noDomainsHint')}</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={domains.map(d => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="py-2" role="tree" aria-label={t('graphMap.domainManager.treeLabel')}>
                    {domains.map(domain => (
                      <div key={domain.id}>
                        <SortableDomainItem
                          domain={domain}
                          onEdit={handleEdit}
                          onDelete={setDeleteConfirmId}
                          depth={0}
                          isExpanded={expandedIds.has(domain.id)}
                          hasChildrenFn={hasChildren}
                          onToggleExpand={toggleExpand}
                          setSize={domains.length}
                          posInSet={domains.findIndex(d => d.id === domain.id) + 1}
                        />

                        {deleteConfirmId === domain.id && (
                          <div className="mx-3 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                  {t('graphMap.domainManager.confirmDelete', { name: domain.name })}
                                </p>
                                {hasChildren(domain) && (
                                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                                    {t('graphMap.domainManager.hasChildren', { count: domain.children.length })}
                                  </p>
                                )}
                                <div className="flex justify-end gap-2 mt-3">
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={submitting}
                                    className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(domain.id)}
                                    disabled={submitting}
                                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                                  >
                                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('common.delete')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {editingId === domain.id && (
                          <div>
                            {renderForm(true, cancelEdit)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

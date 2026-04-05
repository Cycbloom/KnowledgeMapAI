import React, { useState, useEffect, useCallback } from 'react';
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
import { useIsMobile } from '../../hooks';

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
}

function SortableDomainItem({
  domain,
  onEdit,
  onDelete,
  depth = 0,
  isExpanded = false,
  hasChildrenFn,
  onToggleExpand,
}: SortableDomainItemProps) {
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

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
          depth > 0 ? 'ml-' + Math.min(depth * 4, 16) : ''
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <button
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {hasChildrenFn(domain) ? (
          <button
            onClick={() => onToggleExpand(domain.id)}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: domain.color }}
        />

        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate min-w-0">
          {domain.icon && <span className="mr-1">{domain.icon}</span>}
          {domain.name}
        </span>

        {domain.graphCount !== undefined && domain.graphCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
            {domain.graphCount}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!domain.is_system && (
            <>
              <button
                onClick={() => onEdit(domain)}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                title="编辑"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(domain.id)}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {showChildren &&
        domain.children.map(child => (
          <SortableDomainItem
            key={child.id}
            domain={child}
            onEdit={onEdit}
            onDelete={onDelete}
            depth={depth + 1}
            isExpanded={false}
            hasChildrenFn={hasChildrenFn}
            onToggleExpand={onToggleExpand}
          />
        ))
      }
    </div>
  );
}

export const DomainManager: React.FC<DomainManagerProps> = ({ isOpen, onClose }) => {
  const deviceInfo = useIsMobile();
  const isMobile = deviceInfo.isMobile;

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

  const flattenDomains = (nodes: DomainTreeNode[], depth: number = 0): Array<{ node: DomainTreeNode; depth: number }> => {
    const result: Array<{ node: DomainTreeNode; depth: number }> = [];
    for (const node of nodes) {
      result.push({ node, depth });
      if (expandedIds.has(node.id) && node.children.length > 0) {
        result.push(...flattenDomains(node.children, depth + 1));
      }
    }
    return result;
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
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
      >
        {isGeneratingColor ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        AI 推荐
      </button>
      {aiColorRecommendation && (
        <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
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
              className="flex-1 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
            >
              应用此颜色
            </button>
            <button
              onClick={handleAIGenerateColor}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              换一个
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">自定义:</span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  const renderForm = (isEdit: boolean, onCancel: () => void) => (
    <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-t border-b border-gray-200 dark:border-gray-600 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="输入领域名称..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          描述（可选）
        </label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="描述这个知识领域..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          颜色 <span className="text-red-500">*</span>
        </label>
        {renderColorPicker(formData.color, color => setFormData(prev => ({ ...prev, color })))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          父级领域（可选）
        </label>
        <select
          value={formData.parent_id || ''}
          onChange={e => setFormData(prev => ({ ...prev, parent_id: e.target.value || null }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">无（顶级领域）</option>
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
          图标（可选）
        </label>
        <input
          type="text"
          value={formData.icon}
          onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))}
          placeholder="输入图标名称或 emoji..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <button
          onClick={isEdit ? handleUpdate : handleCreate}
          disabled={!formData.name.trim() || submitting}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? '保存' : '创建'}
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

  const renderTreeNode = (node: DomainTreeNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const showChildren = hasChildren(node) && isExpanded;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
            depth > 0 ? 'ml-' + Math.min(depth * 4, 16) : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          {hasChildren(node) ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: node.color }}
          />

          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate min-w-0">
            {node.icon && <span className="mr-1">{node.icon}</span>}
            {node.name}
          </span>

          {node.graphCount !== undefined && node.graphCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              {node.graphCount}
            </span>
          )}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!node.is_system && (
              <>
                <button
                  onClick={() => handleEdit(node)}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                  title="编辑"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(node.id)}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {deleteConfirmId === node.id && (
          <div
            className="mx-3 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            style={{ marginLeft: `${(depth + 1) * 20 + 12}px` }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  确定删除「{node.name}」？
                </p>
                {hasChildren(node) && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                    该领域包含 {node.children.length} 个子领域，将一并删除
                  </p>
                )}
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDelete(node.id)}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingId === node.id && (
          <div style={{ marginLeft: `${depth * 20}px` }}>
            {renderForm(true, cancelEdit)}
          </div>
        )}

        {showChildren &&
          node.children.map(child => renderTreeNode(child, depth + 1))
        }
      </div>
    );
  };

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
          className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden ${
            isMobile ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-2xl mx-4'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              领域管理
            </h2>
            <button
              onClick={onClose}
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              新建领域
            </button>
          </div>

          {showCreateForm && !editingId && renderForm(false, () => setShowCreateForm(false))}

          <div className={`${isMobile ? 'flex-1' : 'max-h-[500px]'} overflow-y-auto`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-sm">暂无领域</p>
                <p className="text-xs mt-1">点击上方按钮创建第一个领域</p>
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
                  <div className="py-2">
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
                        />

                        {deleteConfirmId === domain.id && (
                          <div className="mx-3 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                  确定删除「{domain.name}」？
                                </p>
                                {hasChildren(domain) && (
                                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                                    该领域包含 {domain.children.length} 个子领域，将一并删除
                                  </p>
                                )}
                                <div className="flex justify-end gap-2 mt-3">
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={submitting}
                                    className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={() => handleDelete(domain.id)}
                                    disabled={submitting}
                                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                                  >
                                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    删除
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

import React, { useState, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Palette, Minus, ArrowRight } from 'lucide-react';
import type { Edge, EdgeLineStyle, RelationshipCategory } from '../../../types';
import { RELATIONSHIP_CATEGORY_LABELS, type PresetRelationshipTypeConfig } from '../../../config/relationshipTypes';
import { useFocusTrap, useEscapeKey } from '../../../hooks/common';
import { message } from '../../../utils/messageHelper';

interface UpdateEdgeData {
  custom_label?: string;
  relationship_type?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean | null;
}

interface EdgeEditDialogProps {
  isOpen: boolean;
  edge: Edge | null;
  onClose: () => void;
  onSave: (data: UpdateEdgeData) => Promise<void>;
  relationshipTypes: PresetRelationshipTypeConfig[];
}

const LINE_STYLE_OPTIONS: { value: EdgeLineStyle; label: string }[] = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
  { value: 'double', label: '双线' },
];

const ARROW_OPTIONS: { value: boolean | null; label: string }[] = [
  { value: null, label: '自动' },
  { value: true, label: '显示' },
  { value: false, label: '隐藏' },
];

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#22C55E', '#F97316', '#6366F1',
  '#84CC16', '#14B8A6', '#64748B', '#0EA5E9', '#A855F7',
];

export const EdgeEditDialog: React.FC<EdgeEditDialogProps> = ({
  isOpen,
  edge,
  onClose,
  onSave,
  relationshipTypes
}) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [customLineStyle, setCustomLineStyle] = useState<EdgeLineStyle>('solid');
  const [showArrow, setShowArrow] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'style'>('basic');

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = [
    { id: 'basic', label: '基本信息' },
    { id: 'style', label: '样式设置' },
  ] as const;

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(tabs[0].id);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = tabs.length - 1;
        setActiveTab(tabs[lastIndex].id);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (edge) {
      setLabel(edge.custom_label || '');
      setRelationshipType(edge.relationship_type || '');
      setCustomColor(edge.custom_color || '');
      setCustomLineStyle(edge.custom_line_style || 'solid');
      setShowArrow(edge.show_arrow !== undefined ? edge.show_arrow : null);
    }
  }, [edge]);

  const handleSave = async () => {
    if (!edge) return;
    
    setIsSaving(true);
    try {
      await onSave({
        custom_label: label || undefined,
        relationship_type: relationshipType || undefined,
        custom_color: customColor || undefined,
        custom_line_style: customLineStyle,
        show_arrow: showArrow,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save edge:', error);
      message.error(t('graphEditor.edgeEdit.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresetColorClick = (color: string) => {
    setCustomColor(color);
  };

  const contentRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);

  if (!isOpen || !edge) return null;

  const groupedRelationshipTypes = relationshipTypes.reduce((acc, type) => {
    const category = type.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(type);
    return acc;
  }, {} as Record<string, PresetRelationshipTypeConfig[]>);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edge-edit-dialog-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-500">
          <h2 id="edge-edit-dialog-title" className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            编辑边
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-slate-500" role="tablist" aria-label="编辑边">
          <button
            ref={(el) => { tabRefs.current[0] = el; }}
            role="tab"
            id={`${tabIdPrefix}-basic`}
            aria-selected={activeTab === 'basic'}
            aria-controls={`${panelIdPrefix}-basic`}
            tabIndex={activeTab === 'basic' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 0)}
            onClick={() => setActiveTab('basic')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'basic'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            基本信息
          </button>
          <button
            ref={(el) => { tabRefs.current[1] = el; }}
            role="tab"
            id={`${tabIdPrefix}-style`}
            aria-selected={activeTab === 'style'}
            aria-controls={`${panelIdPrefix}-style`}
            tabIndex={activeTab === 'style' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 1)}
            onClick={() => setActiveTab('style')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'style'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            样式设置
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {activeTab === 'basic' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-basic`}
              aria-labelledby={`${tabIdPrefix}-basic`}
              tabIndex={0}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  标签
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="输入边的标签（可选）"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  关系类型
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                >
                  <option value="">选择关系类型</option>
                  {Object.entries(groupedRelationshipTypes).map(([category, types]) => (
                    <optgroup key={category} label={t(RELATIONSHIP_CATEGORY_LABELS[category as RelationshipCategory]) || category}>
                      {types.map((type) => (
                        <option key={type.id} value={type.name}>
                          {t(type.display_name)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-style`}
              aria-labelledby={`${tabIdPrefix}-style`}
              tabIndex={0}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Palette size={16} className="inline mr-1" />
                  自定义颜色
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={customColor || '#3B82F6'}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-slate-500"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                  />
                  {customColor && (
                    <button
                      onClick={() => setCustomColor('')}
                      className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      清除
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handlePresetColorClick(color)}
                      className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                        customColor === color ? 'border-primary-500 ring-2 ring-primary-300' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Minus size={16} className="inline mr-1" />
                  线型
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LINE_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setCustomLineStyle(option.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        customLineStyle === option.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <ArrowRight size={16} className="inline mr-1" />
                  箭头显示
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ARROW_OPTIONS.map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => setShowArrow(option.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        showArrow === option.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-500 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={16} />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

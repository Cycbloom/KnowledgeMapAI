import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from '../../types';
import { X, ArrowLeft, Save } from 'lucide-react';
import { useFormDraft } from '../../hooks';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { FormInput } from '../common/FormInput';
import { FormTextarea } from '../common/FormTextarea';
import { FormSelect } from '../common/FormSelect';

interface NodeFormState {
  title: string;
  content: string;
  summary: string;
  level: string;
  tags: string[];
}

interface CombinedNodeEditSidebarProps {
  node: Node;
  graphColor: string;
  graphTitle: string;
  nodeForm: NodeFormState;
  setNodeForm: (form: NodeFormState) => void;
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  prevSidebarMode: 'outline' | 'detail' | 'edit' | 'connections';
}

const COMBINED_NODE_EDIT_DRAFT_KEY = 'combined_node_edit_draft';

export const CombinedNodeEditSidebar: React.FC<CombinedNodeEditSidebarProps> = ({
  graphColor,
  graphTitle,
  nodeForm,
  setNodeForm,
  onSave,
  onClose,
  onBack,
  prevSidebarMode
}) => {
  const { t } = useTranslation();

  const {
    setValue: setDraft,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<NodeFormState>({
    key: COMBINED_NODE_EDIT_DRAFT_KEY,
    initialValue: nodeForm,
  });

  // Persist current form state to draft (debounced via useFormDraft)
  useEffect(() => {
    setDraft(nodeForm);
  }, [nodeForm, setDraft]);

  // On restore, apply draft values to parent
  const handleRestore = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(COMBINED_NODE_EDIT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as NodeFormState;
        setNodeForm({
          title: draft.title ?? '',
          content: draft.content ?? '',
          summary: draft.summary ?? '',
          level: draft.level ?? 'normal',
          tags: draft.tags ?? [],
        });
      }
    } catch {
      // ignore parse errors
    }
    onRestore();
  }, [onRestore, setNodeForm]);

  const handleSave = useCallback(() => {
    clearDraft();
    onSave();
  }, [clearDraft, onSave]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          {prevSidebarMode === 'outline' && (
            <button 
              onClick={onBack}
              className="mr-1 p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
              title="返回大纲"
              aria-label="返回大纲"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-3 h-3 rounded-full bg-primary-500"></div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">编辑节点</h3>
        </div>
        <button onClick={onClose} aria-label={t('common.aria.close')} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <X size={20} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: graphColor }}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">{graphTitle}</span>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        <FormInput
          label="标题"
          type="text"
          value={nodeForm.title}
          onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
          placeholder="输入节点标题"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            概览
            <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(20-30字短概述)</span>
          </label>
          <FormInput
            type="text"
            value={nodeForm.summary}
            onChange={(e) => setNodeForm({ ...nodeForm, summary: e.target.value })}
            maxLength={200}
            className="text-sm"
            placeholder="简短概览，概括核心内容..."
          />
        </div>

        <FormInput
          label="标签 (逗号分隔)"
          type="text"
          value={nodeForm.tags.join(', ')}
          onChange={(e) => {
            const tags = e.target.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
            setNodeForm({ ...nodeForm, tags });
          }}
          placeholder="例如: 重要, 待办, 概念"
        />

        <FormSelect
          label="层级"
          value={nodeForm.level}
          onChange={(e) => setNodeForm({ ...nodeForm, level: e.target.value })}
          className="text-sm"
        >
          <option value="root">根节点</option>
          <option value="core">核心节点</option>
          <option value="sub">次级节点</option>
          <option value="normal">普通节点</option>
          <option value="leaf">叶子节点</option>
        </FormSelect>

        <FormTextarea
          label="内容"
          value={nodeForm.content}
          onChange={(e) => setNodeForm({ ...nodeForm, content: e.target.value })}
          className="h-64 resize-none font-mono text-sm"
          placeholder="支持 Markdown 格式..."
        />
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900 z-10">
        <button
          onClick={handleSave}
          disabled={!nodeForm.title.trim()}
          className={`w-full py-3 rounded-xl flex items-center justify-center font-bold text-white shadow-lg transition-all ${
            !nodeForm.title.trim()
              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-primary-600 to-primary-600 hover:shadow-primary-200 dark:hover:shadow-primary-900/30 active:scale-[0.99]'
          }`}
        >
          <Save className="mr-2" size={18} />
          保存节点
        </button>
      </div>
      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={handleRestore}
        title={t('common.restoreDraftTitle')}
        message={t('common.restoreDraftMessage')}
        isDangerous={false}
      />
    </div>
  );
};

import React from 'react';
import { Node } from '../../types';
import { X, ArrowLeft, Save } from 'lucide-react';

interface NodeFormState {
  title: string;
  content: string;
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
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          {prevSidebarMode === 'outline' && (
            <button 
              onClick={onBack}
              className="mr-1 p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
              title="返回大纲"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-3 h-3 rounded-full bg-primary-500"></div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">编辑节点</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
          <input
            type="text"
            value={nodeForm.title}
            onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="输入节点标题"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标签 (逗号分隔)</label>
          <input
            type="text"
            value={nodeForm.tags.join(', ')}
            onChange={(e) => {
              const tags = e.target.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
              setNodeForm({ ...nodeForm, tags });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="例如: 重要, 待办, 概念"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">层级</label>
          <select
            value={nodeForm.level}
            onChange={(e) => setNodeForm({ ...nodeForm, level: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="root">根节点</option>
            <option value="core">核心节点</option>
            <option value="sub">次级节点</option>
            <option value="normal">普通节点</option>
            <option value="leaf">叶子节点</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容</label>
          <textarea
            value={nodeForm.content}
            onChange={(e) => setNodeForm({ ...nodeForm, content: e.target.value })}
            className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="支持 Markdown 格式..."
          />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900 z-10">
        <button
          onClick={onSave}
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
    </div>
  );
};

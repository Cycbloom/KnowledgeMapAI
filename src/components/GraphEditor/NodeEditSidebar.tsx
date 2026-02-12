import React from 'react';
import { Node, NodeLevel } from '../../types';
import { getLevel } from '../../lib/graphUtils';
import { X, ArrowLeft, Save, Loader2 } from 'lucide-react';

interface NodeFormState {
  title: string;
  content: string;
  color: string;
  parentNodeId: string;
  level: NodeLevel;
  tags: string[];
}

interface NodeEditSidebarProps {
  mode: 'create' | 'edit';
  nodeForm: NodeFormState;
  setNodeForm: (form: NodeFormState) => void;
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  prevSidebarMode: 'none' | 'create' | 'edit' | 'outline' | 'detail';
  loading: boolean;
  nodes: Node[];
}

export const NodeEditSidebar: React.FC<NodeEditSidebarProps> = ({
  mode,
  nodeForm,
  setNodeForm,
  onSave,
  onClose,
  onBack,
  prevSidebarMode,
  loading,
  nodes
}) => {
  return (
    <div className="h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
         <div className="flex items-center space-x-2">
           {prevSidebarMode === 'outline' && (
             <button 
               onClick={onBack}
               className="mr-1 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
               title="返回大纲"
             >
               <ArrowLeft size={18} />
             </button>
           )}
           <div className={`w-3 h-3 rounded-full ${mode === 'create' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
           <h3 className="text-lg font-bold text-gray-800">
             {mode === 'create' ? '创建新节点' : '编辑节点'}
           </h3>
         </div>
         <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
           <X size={20} />
         </button>
       </div>

       <div className="space-y-4 flex-1 overflow-y-auto pr-1">
         <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              type="text"
              value={nodeForm.title}
              onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="输入节点标题"
            />
         </div>
         
         <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">父节点 (可选)</label>
            <select
              value={nodeForm.parentNodeId}
              onChange={(e) => setNodeForm({ ...nodeForm, parentNodeId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">无父节点 (根节点)</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
         </div>

         <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
             <input
               type="text"
               value={nodeForm.tags.join(', ')}
               onChange={(e) => {
                 const tags = e.target.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
                 setNodeForm({ ...nodeForm, tags });
               }}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
               placeholder="例如: 重要, 待办, 概念"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">颜色</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={nodeForm.color}
                  onChange={(e) => setNodeForm({ ...nodeForm, color: e.target.value })}
                  className="h-9 w-9 p-0.5 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-xs text-gray-500 font-mono">{nodeForm.color}</span>
              </div>
           </div>
           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">层级</label>
              <select
                value={nodeForm.level}
                onChange={(e) => setNodeForm({ ...nodeForm, level: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="root">根节点</option>
                <option value="core">核心节点</option>
                <option value="sub">次级节点</option>
                <option value="normal">普通节点</option>
                <option value="leaf">叶子节点</option>
              </select>
           </div>
         </div>

         <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
            <textarea
              value={nodeForm.content}
              onChange={(e) => setNodeForm({ ...nodeForm, content: e.target.value })}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none font-mono text-sm"
              placeholder="支持 Markdown 格式..."
            />
         </div>
       </div>

       <div className="mt-6 pt-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
         <button
           onClick={onSave}
           disabled={loading || !nodeForm.title.trim()}
           className={`w-full py-3 rounded-xl flex items-center justify-center font-bold text-white shadow-lg transition-all ${
             loading || !nodeForm.title.trim() 
               ? 'bg-gray-300 cursor-not-allowed' 
               : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-200 active:scale-[0.99]'
           }`}
         >
           {loading ? (
             <>
               <Loader2 className="animate-spin mr-2" size={18} />
               保存中...
             </>
           ) : (
             <>
               <Save className="mr-2" size={18} />
               保存节点
             </>
           )}
         </button>
       </div>
    </div>
  );
};

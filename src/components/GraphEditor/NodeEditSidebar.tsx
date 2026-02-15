import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Node as GraphNode, NodeLevel } from '../../types';
import { getLevelColor, getLevelLabel } from '../../lib/graphUtils';
import { X, ArrowLeft, Save, Loader2, Search, ChevronDown, Circle, MousePointer2 } from 'lucide-react';

interface NodeFormState {
  title: string;
  content: string;
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
  nodes: GraphNode[];
  currentNodeId?: string;
  isSelectingParent?: boolean;
  onStartSelectingParent?: () => void;
  onCancelSelectingParent?: () => void;
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
  nodes,
  currentNodeId,
  isSelectingParent = false,
  onStartSelectingParent,
  onCancelSelectingParent
}) => {
  const [parentSearch, setParentSearch] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedParent = useMemo(() => {
    return nodes.find(n => n.id === nodeForm.parentNodeId);
  }, [nodes, nodeForm.parentNodeId]);

  const filteredNodes = useMemo(() => {
    const search = parentSearch.toLowerCase();
    return nodes
      .filter(n => {
        if (currentNodeId && n.id === currentNodeId) return false;
        if (!search) return true;
        return n.title.toLowerCase().includes(search);
      })
      .sort((a, b) => {
        const levelOrder = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
        const levelA = levelOrder[a.level || 'normal'] ?? 3;
        const levelB = levelOrder[b.level || 'normal'] ?? 3;
        return levelA - levelB;
      });
  }, [nodes, parentSearch, currentNodeId]);

  useEffect(() => {
    if (selectedParent) {
      setParentSearch(selectedParent.title);
    } else {
      setParentSearch('');
    }
  }, [selectedParent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as globalThis.Node)) {
        setShowParentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleParentSelect = (node: GraphNode | null) => {
    setNodeForm({ ...nodeForm, parentNodeId: node?.id || '' });
    setParentSearch(node?.title || '');
    setShowParentDropdown(false);
  };

  const handleParentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParentSearch(e.target.value);
    if (!e.target.value.trim()) {
      setNodeForm({ ...nodeForm, parentNodeId: '' });
    }
    setShowParentDropdown(true);
  };

  const handleClearParent = () => {
    setNodeForm({ ...nodeForm, parentNodeId: '' });
    setParentSearch('');
    inputRef.current?.focus();
  };

  const getLevelBadgeStyle = (level: NodeLevel) => {
    const styles = {
      root: 'bg-purple-100 text-purple-700 border-purple-200',
      core: 'bg-red-100 text-red-700 border-red-200',
      sub: 'bg-orange-100 text-orange-700 border-orange-200',
      normal: 'bg-blue-100 text-blue-700 border-blue-200',
      leaf: 'bg-green-100 text-green-700 border-green-200'
    };
    return styles[level] || styles.normal;
  };

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

       {isSelectingParent && (
         <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               <MousePointer2 size={16} className="text-amber-600 animate-pulse" />
               <span className="text-sm text-amber-700 font-medium">请在图谱上点击选择父节点</span>
             </div>
             <button
               onClick={onCancelSelectingParent}
               className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 rounded transition-colors"
             >
               取消
             </button>
           </div>
         </div>
       )}

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
         
         <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">父节点 (可选)</label>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10">
                  <Search size={16} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={parentSearch}
                  onChange={handleParentInputChange}
                  onFocus={() => setShowParentDropdown(true)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="搜索选择父节点..."
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {nodeForm.parentNodeId && (
                    <button
                      onClick={handleClearParent}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="清除选择"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setShowParentDropdown(!showParentDropdown)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <ChevronDown size={14} className={`transition-transform ${showParentDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                
                {showParentDropdown && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <button
                      onClick={() => handleParentSelect(null)}
                      className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2 border-b ${
                        !nodeForm.parentNodeId ? 'bg-blue-50 text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      <Circle size={12} className="text-gray-400" />
                      <span className="text-sm">无父节点 (根节点)</span>
                    </button>
                    
                    {filteredNodes.length === 0 ? (
                      <div className="px-3 py-4 text-center text-gray-400 text-sm">
                        {parentSearch ? '没有匹配的节点' : '没有可选的节点'}
                      </div>
                    ) : (
                      filteredNodes.map(node => (
                        <button
                          key={node.id}
                          onClick={() => handleParentSelect(node)}
                          className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between ${
                            nodeForm.parentNodeId === node.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full ${getLevelColor(node.level || 'normal')}`}></div>
                            <span className="truncate text-sm text-gray-800">{node.title}</span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${getLevelBadgeStyle(node.level || 'normal')}`}>
                            {getLevelLabel(node.level || 'normal')}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={isSelectingParent ? onCancelSelectingParent : onStartSelectingParent}
                className={`p-2 rounded-lg border transition-all ${
                  isSelectingParent
                    ? 'bg-amber-100 border-amber-300 text-amber-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-blue-500 hover:border-blue-300'
                }`}
                title={isSelectingParent ? '取消选择' : '从图谱选择'}
              >
                <MousePointer2 size={16} className={isSelectingParent ? 'animate-pulse' : ''} />
              </button>
            </div>

            {nodeForm.parentNodeId && (
              <div className="mt-2 px-2 py-1.5 bg-blue-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-blue-600">已选择：</span>
                  <span className="text-sm text-blue-800 font-medium truncate">{selectedParent?.title}</span>
                </div>
                <button
                  onClick={handleClearParent}
                  className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded flex-shrink-0"
                  title="清除选择"
                >
                  <X size={12} />
                </button>
              </div>
            )}
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

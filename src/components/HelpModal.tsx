import React from 'react';
import { X, MousePointer2, Keyboard, Command, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">操作指南</h2>
            <p className="text-gray-500 text-sm mt-1">快速掌握知识图谱的操作技巧</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Mouse Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <MousePointer2 size={20} />
              <h3 className="font-bold text-lg">鼠标操作 (3D 视图)</h3>
            </div>
            <div className="bg-blue-50/50 rounded-xl p-4 space-y-3 border border-blue-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">旋转视角</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">左键拖拽</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">平移画布</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">右键拖拽</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">缩放视图</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">滚轮滚动</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">选中节点</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">左键点击</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">框选节点</span>
                <span className="text-sm bg-white px-2 py-1 rounded border border-blue-200 text-gray-600 shadow-sm">Shift + 左键拖拽</span>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Keyboard size={20} />
              <h3 className="font-bold text-lg">键盘快捷键</h3>
            </div>
            <div className="bg-purple-50/50 rounded-xl p-4 space-y-3 border border-purple-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">撤销操作</span>
                <div className="flex gap-1">
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Ctrl</kbd>
                   <span className="text-gray-400">+</span>
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Z</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">重做操作</span>
                <div className="flex gap-1">
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Ctrl</kbd>
                   <span className="text-gray-400">+</span>
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Shift</kbd>
                   <span className="text-gray-400">+</span>
                   <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Z</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">专注模式开关</span>
                <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">F</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">退出模式</span>
                <kbd className="bg-white px-2 py-1 rounded border border-gray-300 text-xs font-mono text-gray-600 shadow-sm">Esc</kbd>
              </div>
            </div>
          </div>

          {/* Advanced Features */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Sparkles size={20} />
              <h3 className="font-bold text-lg">AI 高级功能</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                    <Command size={16} /> 智能拓展 (Infinite Expansion)
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    选中任意节点，点击“智能拓展”，AI 将自动分析节点内容并生成相关的子节点。支持后台批量运行，适合快速构建知识体系。
                  </p>
               </div>
               <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
                    <Command size={16} /> 自动出题 (Study Cards)
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    AI 可根据节点内容自动生成单选、多选、问答等多种类型的复习卡片，并自动加入 FSRS 记忆算法复习队列。
                  </p>
               </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors"
          >
            我明白了
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Settings, Shield, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { useGraph, useUpdateGraphMutation } from '../../hooks/useQueries';
import toast from 'react-hot-toast';

interface GraphSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
}

export const GraphSettingsModal = ({ isOpen, onClose, graphId }: GraphSettingsModalProps) => {
  const { data: graph } = useGraph(graphId);
  const updateGraphMutation = useUpdateGraphMutation();
  
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [learningDirection, setLearningDirection] = useState<'top_down' | 'bottom_up'>('top_down');

  useEffect(() => {
    if (graph?.settings) {
      setGamificationEnabled(graph.settings.gamification_enabled !== false);
      setLearningDirection(graph.settings.learning_direction || 'top_down');
    }
  }, [graph]);

  const handleSave = async () => {
    try {
      await updateGraphMutation.mutateAsync({
        id: graphId,
        data: {
          settings: {
            ...graph?.settings,
            gamification_enabled: gamificationEnabled,
            learning_direction: learningDirection
          }
        }
      });
      toast.success('设置已保存');
      onClose();
    } catch (error) {
      toast.error('保存失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Settings size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">图谱设置</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Gamification Switch */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-gray-700 font-bold">
                <Shield size={18} />
                <span>闯关模式 (Gamification)</span>
              </div>
              <button 
                onClick={() => setGamificationEnabled(!gamificationEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${gamificationEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${gamificationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              开启后，节点将被锁定，必须先掌握前置知识点才能解锁。关闭后所有节点可见。
            </p>
          </div>

          {/* Learning Direction */}
          <div className={`space-y-3 transition-opacity ${gamificationEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <h3 className="font-bold text-gray-700 flex items-center">
              学习顺序 (Learning Order)
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLearningDirection('top_down')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                  learningDirection === 'top_down' 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                    : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                <ArrowDown size={24} className="mb-2" />
                <span className="font-bold text-sm">自顶向下</span>
                <span className="text-xs opacity-70 mt-1">先学根节点，解锁子节点</span>
              </button>

              <button
                onClick={() => setLearningDirection('bottom_up')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                  learningDirection === 'bottom_up' 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                    : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                <ArrowUp size={24} className="mb-2" />
                <span className="font-bold text-sm">自底向上</span>
                <span className="text-xs opacity-70 mt-1">先学叶节点，解锁父节点</span>
              </button>
            </div>
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              {learningDirection === 'top_down' 
                ? '传统的学习路径：从概览到细节。' 
                : '构建式学习路径：从基础部分组装成整体。适合"叶节点是父节点一部分"的场景。'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={updateGraphMutation.isPending}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Save size={18} className="mr-2" />
            {updateGraphMutation.isPending ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};

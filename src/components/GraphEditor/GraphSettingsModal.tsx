import React, { useState, useLayoutEffect, useRef } from 'react';
import { X, Settings, Shield, ArrowUp, ArrowDown, Save, Type, Zap, Activity, Gauge, MessageSquare } from 'lucide-react';
import { useGraph, useUpdateGraphMutation } from '../../hooks/useQueries';
import { useMessageStore } from '../../store/useMessageStore';
import { usePerformanceStore } from '../../store/usePerformanceStore';
import { PromptSettingsPanel } from '../PromptSettingsPanel';
import { AIActionSettingsPanel } from '../AIActionSettingsPanel';

interface GraphSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
}

export const GraphSettingsModal = ({ isOpen, onClose, graphId }: GraphSettingsModalProps) => {
  const { data: graph } = useGraph(graphId);
  const updateGraphMutation = useUpdateGraphMutation();
  const { addMessage } = useMessageStore();
  const { quality, setQuality, showStats, toggleStats } = usePerformanceStore();
  
  const [activeTab, setActiveTab] = useState<'general' | 'prompts' | 'actions'>('general');
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [learningDirection, setLearningDirection] = useState<'top_down' | 'bottom_up'>('top_down');
  const [textDisplayLevel, setTextDisplayLevel] = useState<'all' | 'important' | 'root_only'>('important');
  const prevSettingsRef = useRef(graph?.settings);

  useLayoutEffect(() => {
    const currentSettings = graph?.settings;
    if (currentSettings && currentSettings !== prevSettingsRef.current) {
      prevSettingsRef.current = currentSettings;
      setGamificationEnabled(currentSettings.gamification_enabled !== false);
      setLearningDirection(currentSettings.learning_direction || 'top_down');
      setTextDisplayLevel(currentSettings.text_display_level || 'important');
    }
  }, [graph?.settings]);

  const handleSave = async () => {
    try {
      await updateGraphMutation.mutateAsync({
        id: graphId,
        data: {
          settings: {
            ...graph?.settings,
            gamification_enabled: gamificationEnabled,
            learning_direction: learningDirection,
            text_display_level: textDisplayLevel
          }
        }
      });
      addMessage({ type: 'success', content: '设置已保存' });
      onClose();
    } catch (error) {
      addMessage({ type: 'error', content: '保存失败' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${activeTab === 'prompts' ? 'max-w-4xl' : 'max-w-md'} transition-all duration-300 overflow-hidden animate-fade-in-up`}>
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

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings size={16} className="mr-2" />
            常规设置
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${
              activeTab === 'prompts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare size={16} className="mr-2" />
              AI 提示词
            </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${
              activeTab === 'actions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap size={16} className="mr-2" />
              AI 动作
            </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              {/* Performance Settings */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 flex items-center">
                  <Zap size={18} className="mr-2" />
                  性能与画质 (Performance)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setQuality('high')}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center ${
                      quality === 'high' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-100'
                    }`}
                  >
                    <Zap size={16} className="mb-1" />
                    高画质
                  </button>
                  <button
                    onClick={() => setQuality('medium')}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center ${
                      quality === 'medium' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-100'
                    }`}
                  >
                    <Activity size={16} className="mb-1" />
                    平衡
                  </button>
                  <button
                    onClick={() => setQuality('low')}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center ${
                      quality === 'low' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-100'
                    }`}
                  >
                    <Gauge size={16} className="mb-1" />
                    高性能
                  </button>
                </div>
                
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-600">显示性能统计 (FPS)</span>
                  <button 
                    onClick={toggleStats}
                    className={`w-10 h-5 rounded-full transition-colors relative ${showStats ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${showStats ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {quality === 'high' ? '启用泛光特效，最大视野距离。' : 
                   quality === 'medium' ? '关闭部分特效，适中视野。' : 
                   '关闭特效，简化几何体，适合低端设备。'}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4"></div>

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

              {/* Text Display Level */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 flex items-center">
                  <Type size={18} className="mr-2" />
                  文本显示层级 (Label Display)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTextDisplayLevel('all')}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-bold transition-all ${
                      textDisplayLevel === 'all' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-100'
                    }`}
                  >
                    全部显示
                  </button>
                  <button
                    onClick={() => setTextDisplayLevel('important')}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-bold transition-all ${
                      textDisplayLevel === 'important' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-100'
                    }`}
                  >
                    核心节点
                  </button>
                  <button
                    onClick={() => setTextDisplayLevel('root_only')}
                    className={`py-2 px-1 rounded-lg border-2 text-xs font-bold transition-all ${
                      textDisplayLevel === 'root_only' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-gray-100 hover:border-indigo-100'
                    }`}
                  >
                    仅根节点
                  </button>
                </div>
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  {textDisplayLevel === 'all' 
                    ? '在任何距离下显示所有节点的标题（可能较拥挤）。' 
                    : textDisplayLevel === 'important'
                      ? '根据节点层级自动调整可见距离（根节点最远，叶子节点最近）。'
                      : '仅显示最顶层的根节点标题。'}
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
          ) : activeTab === 'prompts' ? (
            <PromptSettingsPanel graphId={graphId} scope="graph" />
          ) : (
            <AIActionSettingsPanel graphId={graphId} scope="graph" />
          )}
        </div>

        {/* Footer - Only show for General settings */}
        {activeTab === 'general' && (
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
        )}
      </div>
    </div>
  );
};

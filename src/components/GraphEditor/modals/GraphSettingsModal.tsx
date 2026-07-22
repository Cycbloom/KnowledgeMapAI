import { useState, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Settings, Shield, ArrowUp, ArrowDown, Save, Type, Zap, Activity, Gauge, MessageSquare } from 'lucide-react';
import { useGraph } from '../../../hooks/queries';
import { useUpdateGraphMutation } from '../../../hooks/mutations';
import { message } from "../../../utils/messageHelper";
import { usePerformanceStore } from '../../../store/usePerformanceStore';
import { PromptSettingsPanel } from '../panels/PromptSettingsPanel';
import { AIActionSettingsPanel } from '../panels/AIActionSettingsPanel';
import { ModalShell } from '../../common';

interface GraphSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
}

export const GraphSettingsModal = ({ isOpen, onClose, graphId }: GraphSettingsModalProps) => {
  const { t } = useTranslation();
  const { data: graph } = useGraph(graphId);
  const updateGraphMutation = useUpdateGraphMutation();
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
      message.success(t('graphEditor.settings.saved'));
      onClose();
    } catch (error) {
      message.error(t('graphEditor.settings.saveFailed'));
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titleId="graph-settings-modal-title"
      className={`bg-white dark:bg-slate-800 rounded-xl sm:rounded-xl shadow-2xl w-full ${activeTab === 'prompts' ? 'max-w-4xl' : 'max-w-2xl'} transition-all duration-300 overflow-hidden animate-fade-in-up max-h-[95dvh] sm:max-h-[90dvh] flex flex-col`}
      overlayClassName="p-2 sm:p-4"
    >
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <Settings size={24} />
            </div>
            <h2 id="graph-settings-modal-title" className="text-xl font-bold text-gray-800 dark:text-gray-100">图谱设置</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.aria.close')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 touch-target">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-100 dark:border-slate-700 px-4 sm:px-6 shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center min-h-[44px] touch-target ${
              activeTab === 'general'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Settings size={16} className="mr-2" />
            常规设置
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center min-h-[44px] touch-target ${
              activeTab === 'prompts'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <MessageSquare size={16} className="mr-2" />
              AI 提示词
            </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center min-h-[44px] touch-target ${
              activeTab === 'actions'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Zap size={16} className="mr-2" />
              AI 动作
            </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              {/* Performance Settings */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Zap size={18} className="mr-2" />
                  性能与画质 (Performance)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setQuality('high')}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[60px] touch-target ${
                      quality === 'high' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-100 dark:border-slate-600 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    <Zap size={16} className="mb-1" />
                    高画质
                  </button>
                  <button
                    onClick={() => setQuality('medium')}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[60px] touch-target ${
                      quality === 'medium' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-100 dark:border-slate-600 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    <Activity size={16} className="mb-1" />
                    平衡
                  </button>
                  <button
                    onClick={() => setQuality('low')}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[60px] touch-target ${
                      quality === 'low' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-100 dark:border-slate-600 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    <Gauge size={16} className="mb-1" />
                    高性能
                  </button>
                </div>
                
                <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-300">显示性能统计 (FPS)</span>
                  <button
                    onClick={toggleStats}
                    className={`relative w-12 h-6 rounded-full transition-colors touch-target shrink-0 ${showStats ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-0 left-0 bg-white w-6 h-6 rounded-full transition-transform ${showStats ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {quality === 'high' ? '启用泛光特效，最大视野距离。' : 
                   quality === 'medium' ? '关闭部分特效，适中视野。' : 
                   '关闭特效，简化几何体，适合低端设备。'}
                </p>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4"></div>

              {/* Gamification Switch */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-bold">
                    <Shield size={18} />
                    <span>闯关模式 (Gamification)</span>
                  </div>
                  <button
                    onClick={() => setGamificationEnabled(!gamificationEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors touch-target shrink-0 ${gamificationEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-0 left-0 bg-white w-6 h-6 rounded-full transition-transform ${gamificationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  开启后，节点将被锁定，必须先掌握前置知识点才能解锁。关闭后所有节点可见。
                </p>
              </div>

              {/* Text Display Level */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Type size={18} className="mr-2" />
                  文本显示层级 (Label Display)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTextDisplayLevel('all')}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all min-h-[44px] touch-target ${
                      textDisplayLevel === 'all' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-100 dark:border-slate-600 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    全部显示
                  </button>
                  <button
                    onClick={() => setTextDisplayLevel('important')}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all min-h-[44px] touch-target ${
                      textDisplayLevel === 'important' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-100 dark:border-slate-600 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    核心节点
                  </button>
                  <button
                    onClick={() => setTextDisplayLevel('root_only')}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all min-h-[44px] touch-target ${
                      textDisplayLevel === 'root_only' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-100 dark:border-slate-600 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    仅根节点
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  {textDisplayLevel === 'all' 
                    ? '在任何距离下显示所有节点的标题（可能较拥挤）。' 
                    : textDisplayLevel === 'important'
                      ? '根据节点层级自动调整可见距离（根节点最远，叶子节点最近）。'
                      : '仅显示最顶层的根节点标题。'}
                </p>
              </div>

              {/* Learning Direction */}
              <div className={`space-y-3 transition-opacity ${gamificationEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  学习顺序 (Learning Order)
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setLearningDirection('top_down')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all min-h-[100px] touch-target ${
                      learningDirection === 'top_down' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-200 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-900/30 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ArrowDown size={24} className="mb-2" />
                    <span className="font-bold text-sm">自顶向下</span>
                    <span className="text-xs opacity-70 mt-1">先学根节点，解锁子节点</span>
                  </button>

                  <button
                    onClick={() => setLearningDirection('bottom_up')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all min-h-[100px] touch-target ${
                      learningDirection === 'bottom_up' 
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300' 
                        : 'border-gray-200 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-900/30 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ArrowUp size={24} className="mb-2" />
                    <span className="font-bold text-sm">自底向上</span>
                    <span className="text-xs opacity-70 mt-1">先学叶节点，解锁父节点</span>
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
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
          <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
            <button
              onClick={handleSave}
              disabled={updateGraphMutation.isPending}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors flex items-center min-h-[44px] touch-target"
            >
              <Save size={18} className="mr-2" />
              {updateGraphMutation.isPending ? '保存中...' : '保存设置'}
            </button>
          </div>
        )}
    </ModalShell>
  );
};

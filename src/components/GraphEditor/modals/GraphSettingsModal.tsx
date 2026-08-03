import { useState, useLayoutEffect, useRef, useId, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = [
    { id: 'general', label: t('graphEditor.settings.tabGeneral') },
    { id: 'prompts', label: t('graphEditor.settings.tabPrompts') },
    { id: 'actions', label: t('graphEditor.settings.tabActions') },
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
    } catch (_) {
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
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 dark:border-slate-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <Settings size={24} />
            </div>
            <h2 id="graph-settings-modal-title" className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('graphEditor.settings.title')}</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.aria.close')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 touch-target">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-100 dark:border-slate-500 px-4 sm:px-6 shrink-0" role="tablist" aria-label={t('graphEditor.settings.title')}>
          <button
            ref={(el) => { tabRefs.current[0] = el; }}
            role="tab"
            id={`${tabIdPrefix}-general`}
            aria-selected={activeTab === 'general'}
            aria-controls={`${panelIdPrefix}-general`}
            tabIndex={activeTab === 'general' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 0)}
            onClick={() => setActiveTab('general')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center min-h-[44px] touch-target ${
              activeTab === 'general'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Settings size={16} className="mr-2" />
            {t('graphEditor.settings.tabGeneral')}
          </button>
          <button
            ref={(el) => { tabRefs.current[1] = el; }}
            role="tab"
            id={`${tabIdPrefix}-prompts`}
            aria-selected={activeTab === 'prompts'}
            aria-controls={`${panelIdPrefix}-prompts`}
            tabIndex={activeTab === 'prompts' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 1)}
            onClick={() => setActiveTab('prompts')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center min-h-[44px] touch-target ${
              activeTab === 'prompts'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <MessageSquare size={16} className="mr-2" />
              {t('graphEditor.settings.tabPrompts')}
            </button>
          <button
            ref={(el) => { tabRefs.current[2] = el; }}
            role="tab"
            id={`${tabIdPrefix}-actions`}
            aria-selected={activeTab === 'actions'}
            aria-controls={`${panelIdPrefix}-actions`}
            tabIndex={activeTab === 'actions' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 2)}
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center min-h-[44px] touch-target ${
              activeTab === 'actions'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Zap size={16} className="mr-2" />
              {t('graphEditor.settings.tabActions')}
            </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {activeTab === 'general' ? (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-general`}
              aria-labelledby={`${tabIdPrefix}-general`}
              tabIndex={0}
              className="space-y-6"
            >
              {/* Performance Settings */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Zap size={18} className="mr-2" />
                  {t('graphEditor.settings.performanceTitle')}
                </h3>
                <div
                  role="radiogroup"
                  aria-label={t('graphEditor.settings.qualityGroupLabel')}
                  className="grid grid-cols-3 gap-2"
                >
                  <button
                    onClick={() => setQuality('high')}
                    role="radio"
                    aria-checked={quality === 'high'}
                    tabIndex={quality === 'high' ? 0 : -1}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[60px] touch-target ${
                      quality === 'high'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-100 dark:border-slate-500 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    <Zap size={16} className="mb-1" />
                    {t('graphEditor.settings.qualityHigh')}
                  </button>
                  <button
                    onClick={() => setQuality('medium')}
                    role="radio"
                    aria-checked={quality === 'medium'}
                    tabIndex={quality === 'medium' ? 0 : -1}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[60px] touch-target ${
                      quality === 'medium'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-100 dark:border-slate-500 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    <Activity size={16} className="mb-1" />
                    {t('graphEditor.settings.qualityMedium')}
                  </button>
                  <button
                    onClick={() => setQuality('low')}
                    role="radio"
                    aria-checked={quality === 'low'}
                    tabIndex={quality === 'low' ? 0 : -1}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col items-center justify-center min-h-[60px] touch-target ${
                      quality === 'low'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-100 dark:border-slate-500 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    <Gauge size={16} className="mb-1" />
                    {t('graphEditor.settings.qualityLow')}
                  </button>
                </div>

                <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{t('graphEditor.settings.showStats')}</span>
                  <button
                    onClick={toggleStats}
                    role="switch"
                    aria-checked={showStats}
                    aria-label={t('graphEditor.settings.showStatsLabel')}
                    className={`relative w-12 h-6 rounded-full transition-colors touch-target shrink-0 ${showStats ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-0 left-0 bg-white w-6 h-6 rounded-full transition-transform ${showStats ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {quality === 'high' ? t('graphEditor.settings.qualityHighDesc') :
                   quality === 'medium' ? t('graphEditor.settings.qualityMediumDesc') :
                   t('graphEditor.settings.qualityLowDesc')}
                </p>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-500 pt-4"></div>

              {/* Gamification Switch */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-bold">
                    <Shield size={18} />
                    <span>{t('graphEditor.settings.gamificationTitle')}</span>
                  </div>
                  <button
                    onClick={() => setGamificationEnabled(!gamificationEnabled)}
                    role="switch"
                    aria-checked={gamificationEnabled}
                    aria-label={t('graphEditor.settings.gamificationLabel')}
                    className={`relative w-12 h-6 rounded-full transition-colors touch-target shrink-0 ${gamificationEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-0 left-0 bg-white w-6 h-6 rounded-full transition-transform ${gamificationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  {t('graphEditor.settings.gamificationDesc')}
                </p>
              </div>

              {/* Text Display Level */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  <Type size={18} className="mr-2" />
                  {t('graphEditor.settings.textDisplayTitle')}
                </h3>
                <div
                  role="radiogroup"
                  aria-label={t('graphEditor.settings.textDisplayLevelGroupLabel')}
                  className="grid grid-cols-3 gap-2"
                >
                  <button
                    onClick={() => setTextDisplayLevel('all')}
                    role="radio"
                    aria-checked={textDisplayLevel === 'all'}
                    tabIndex={textDisplayLevel === 'all' ? 0 : -1}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all min-h-[44px] touch-target ${
                      textDisplayLevel === 'all'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-100 dark:border-slate-500 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    {t('graphEditor.settings.textDisplayAll')}
                  </button>
                  <button
                    onClick={() => setTextDisplayLevel('important')}
                    role="radio"
                    aria-checked={textDisplayLevel === 'important'}
                    tabIndex={textDisplayLevel === 'important' ? 0 : -1}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all min-h-[44px] touch-target ${
                      textDisplayLevel === 'important'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-100 dark:border-slate-500 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    {t('graphEditor.settings.textDisplayImportant')}
                  </button>
                  <button
                    onClick={() => setTextDisplayLevel('root_only')}
                    role="radio"
                    aria-checked={textDisplayLevel === 'root_only'}
                    tabIndex={textDisplayLevel === 'root_only' ? 0 : -1}
                    className={`py-3 px-2 rounded-lg border-2 text-xs font-bold transition-all min-h-[44px] touch-target ${
                      textDisplayLevel === 'root_only'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-100 dark:border-slate-500 hover:border-primary-100 dark:hover:border-primary-900/30'
                    }`}
                  >
                    {t('graphEditor.settings.textDisplayRootOnly')}
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  {textDisplayLevel === 'all'
                    ? t('graphEditor.settings.textDisplayAllDesc')
                    : textDisplayLevel === 'important'
                      ? t('graphEditor.settings.textDisplayImportantDesc')
                      : t('graphEditor.settings.textDisplayRootOnlyDesc')}
                </p>
              </div>

              {/* Learning Direction */}
              <div className={`space-y-3 transition-opacity ${gamificationEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center">
                  {t('graphEditor.settings.learningDirectionTitle')}
                </h3>

                <div
                  role="radiogroup"
                  aria-label={t('graphEditor.settings.learningDirectionGroupLabel')}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <button
                    onClick={() => setLearningDirection('top_down')}
                    role="radio"
                    aria-checked={learningDirection === 'top_down'}
                    tabIndex={learningDirection === 'top_down' ? 0 : -1}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all min-h-[100px] touch-target ${
                      learningDirection === 'top_down'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-200 dark:border-slate-500 hover:border-primary-200 dark:hover:border-primary-900/30 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ArrowDown size={24} className="mb-2" />
                    <span className="font-bold text-sm">{t('graphEditor.settings.directionTopDown')}</span>
                    <span className="text-xs opacity-70 mt-1">{t('graphEditor.settings.directionTopDownDesc')}</span>
                  </button>

                  <button
                    onClick={() => setLearningDirection('bottom_up')}
                    role="radio"
                    aria-checked={learningDirection === 'bottom_up'}
                    tabIndex={learningDirection === 'bottom_up' ? 0 : -1}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all min-h-[100px] touch-target ${
                      learningDirection === 'bottom_up'
                        ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'border-gray-200 dark:border-slate-500 hover:border-primary-200 dark:hover:border-primary-900/30 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ArrowUp size={24} className="mb-2" />
                    <span className="font-bold text-sm">{t('graphEditor.settings.directionBottomUp')}</span>
                    <span className="text-xs opacity-70 mt-1">{t('graphEditor.settings.directionBottomUpDesc')}</span>
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  {learningDirection === 'top_down'
                    ? t('graphEditor.settings.directionTopDownHint')
                    : t('graphEditor.settings.directionBottomUpHint')}
                </p>
              </div>
            </div>
          ) : activeTab === 'prompts' ? (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-prompts`}
              aria-labelledby={`${tabIdPrefix}-prompts`}
              tabIndex={0}
            >
              <PromptSettingsPanel graphId={graphId} scope="graph" />
            </div>
          ) : (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-actions`}
              aria-labelledby={`${tabIdPrefix}-actions`}
              tabIndex={0}
            >
              <AIActionSettingsPanel graphId={graphId} scope="graph" />
            </div>
          )}
        </div>

        {/* Footer - Only show for General settings */}
        {activeTab === 'general' && (
          <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-slate-500 flex justify-end">
            <button
              onClick={handleSave}
              disabled={updateGraphMutation.isPending}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors flex items-center min-h-[44px] touch-target"
            >
              <Save size={18} className="mr-2" />
              {updateGraphMutation.isPending ? t('graphEditor.settings.saving') : t('graphEditor.settings.save')}
            </button>
          </div>
        )}
    </ModalShell>
  );
};

import React from 'react';
import { Target, BarChart3, Zap, Loader2, Sparkles, FileText, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTokenCount, getTokenWarningLevel, type TokenEstimation } from './utils/tokenEstimation';

export type AnalysisMode = 'quick' | 'deep' | 'custom';

interface Skill {
  id: string;
  name: string;
  description: string;
}

interface AnalysisConfirmPanelProps {
  mode: AnalysisMode;
  skill?: Skill;
  customPrompt?: string;
  selectedGraphIds: string[];
  graphTitles: string[];
  estimatedTokens: TokenEstimation;
  onConfirm: () => void;
  onCancel: () => void;
  onCustomPromptChange?: (prompt: string) => void;
  isLoading?: boolean;
}

export const AnalysisConfirmPanel: React.FC<AnalysisConfirmPanelProps> = ({
  mode,
  skill,
  customPrompt,
  selectedGraphIds,
  graphTitles,
  estimatedTokens,
  onConfirm,
  onCancel,
  onCustomPromptChange,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  const MODE_CONFIG: Record<AnalysisMode, { label: string; description: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    quick: {
      label: t('graphMap.analysisConfirm.mode.quick'),
      description: t('graphMap.analysisConfirm.mode.quickDesc'),
      icon: <Zap className="w-4 h-4" />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    },
    deep: {
      label: t('graphMap.analysisConfirm.mode.deep'),
      description: t('graphMap.analysisConfirm.mode.deepDesc'),
      icon: <Target className="w-4 h-4" />,
      color: 'text-primary-500',
      bgColor: 'bg-primary-100 dark:bg-primary-900/40',
    },
    custom: {
      label: t('graphMap.analysisConfirm.mode.custom'),
      description: t('graphMap.analysisConfirm.mode.customDesc'),
      icon: <FileText className="w-4 h-4" />,
      color: 'text-primary-500',
      bgColor: 'bg-primary-100 dark:bg-primary-900/40',
    },
  };

  const modeConfig = MODE_CONFIG[mode];
  const warningLevel = getTokenWarningLevel(estimatedTokens);
  const displayTitles = graphTitles.length > 5 
    ? [...graphTitles.slice(0, 5), t('graphMap.analysisConfirm.moreGraphs', { count: graphTitles.length - 5 })]
    : graphTitles;

  const warningColors = {
    low: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    high: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-500" />
          {t('graphMap.analysisConfirm.title')}
        </h3>
      </div>

      <div className={`p-3 rounded-lg ${modeConfig.bgColor}`}>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-medium ${modeConfig.color}`}>
            {modeConfig.icon}
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {t('graphMap.analysisConfirm.analysisTypeLabel')}
          </span>
          <span className="text-gray-900 dark:text-white font-medium">
            {modeConfig.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          {skill?.description || modeConfig.description}
        </p>
      </div>

      {mode === 'custom' && onCustomPromptChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('graphMap.analysisConfirm.analysisGoal')}
          </label>
          <textarea
            value={customPrompt || ''}
            onChange={e => onCustomPromptChange(e.target.value)}
            disabled={isLoading}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 resize-none"
            placeholder={t('graphMap.analysisConfirm.analysisGoalPlaceholder')}
          />
          {!customPrompt?.trim() && (
            <p className="text-xs text-red-500 mt-1">{t('graphMap.analysisConfirm.enterAnalysisGoal')}</p>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <BarChart3 className="w-4 h-4 text-primary-500" />
          <span>{t('graphMap.analysisConfirm.analysisScope', { count: selectedGraphIds.length })}</span>
        </div>
        {selectedGraphIds.length === 0 && (
          <div className="mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {t('graphMap.analysisConfirm.noGraphSelected')}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {t('graphMap.analysisConfirm.noGraphSelectedHint')}
                </p>
              </div>
            </div>
          </div>
        )}
        {selectedGraphIds.length > 0 && (
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            <ul className="space-y-1">
              {displayTitles.map((title, index) => (
                <li 
                  key={index} 
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                  <span className="truncate">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={`p-3 rounded-lg border ${warningColors[warningLevel]}`}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Zap className="w-4 h-4" />
          <span>{t('graphMap.analysisConfirm.estimatedConsumption')}</span>
          <span>
            {t('graphMap.analysisConfirm.tokenRange', { min: formatTokenCount(estimatedTokens.min), max: formatTokenCount(estimatedTokens.max) })}
          </span>
        </div>
        {warningLevel === 'high' && (
          <p className="text-xs mt-1 opacity-80">
            {t('graphMap.analysisConfirm.highTokenWarning')}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading || (mode === 'custom' && !customPrompt?.trim())}
          className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('graphMap.analysisConfirm.analyzing')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t('graphMap.analysisConfirm.startAnalysis')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

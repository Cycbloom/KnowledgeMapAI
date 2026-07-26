import React, { useState, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorScheme, LinkStyle, LinkAnimation, NodeSizeMode, EdgeWidthMode, GraphColorMode } from '../../../types';
import { getColorSchemeNames, COLOR_SCHEMES } from '../../../config/learningStatusColors';
import { PRESET_RELATIONSHIP_TYPES } from '../../../config/relationshipTypes';
import { useFocusTrap } from '../../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../../hooks/common/useEscapeKey';

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors ${
      checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

interface GraphStyleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentColorScheme: ColorScheme;
  currentLinkStyle: LinkStyle;
  currentLinkAnimation: LinkAnimation;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onLinkStyleChange: (style: LinkStyle) => void;
  onLinkAnimationChange: (animation: LinkAnimation) => void;
  nodeSizeMode?: NodeSizeMode;
  onNodeSizeModeChange?: (mode: NodeSizeMode) => void;
  edgeWidthMode?: EdgeWidthMode;
  onEdgeWidthModeChange?: (mode: EdgeWidthMode) => void;
  coloringMode?: GraphColorMode;
  showLabels?: boolean;
  onShowLabelsChange?: (show: boolean) => void;
  showArrows?: boolean;
  onShowArrowsChange?: (show: boolean) => void;
  onOpenRelationshipTypeSettings?: () => void;
}

export const GraphStyleSettings: React.FC<GraphStyleSettingsProps> = ({
  isOpen,
  onClose,
  currentColorScheme,
  currentLinkStyle,
  currentLinkAnimation,
  onColorSchemeChange,
  onLinkStyleChange,
  onLinkAnimationChange,
  nodeSizeMode = 'fixed',
  onNodeSizeModeChange,
  edgeWidthMode = 'fixed',
  onEdgeWidthModeChange,
  coloringMode = 'level',
  showLabels = true,
  onShowLabelsChange,
  showArrows = true,
  onShowArrowsChange,
  onOpenRelationshipTypeSettings
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<'colors' | 'links' | 'animations' | 'nodes' | 'edges' | 'edgeSettings'>('colors');
  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = [
    { id: 'colors', label: t('graphStyleSettings.tabs.colors') },
    { id: 'links', label: t('graphStyleSettings.tabs.links') },
    { id: 'animations', label: t('graphStyleSettings.tabs.animations') },
    { id: 'nodes', label: t('graphStyleSettings.tabs.nodes') },
    { id: 'edges', label: t('graphStyleSettings.tabs.edges') },
    { id: 'edgeSettings', label: t('graphStyleSettings.tabs.edgeSettings') },
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

  const commonRelationshipTypes = PRESET_RELATIONSHIP_TYPES.slice(0, 8);

  if (!isOpen) return null;

  const colorSchemes = getColorSchemeNames();
  const currentSchemeName = colorSchemes.find(s => s.key === currentColorScheme)?.name;
  const linkStyles: { key: LinkStyle; name: string }[] = [
    { key: 'curved', name: t('graphStyleSettings.linkStyles.curved') },
    { key: 'straight', name: t('graphStyleSettings.linkStyles.straight') },
    { key: 'step', name: t('graphStyleSettings.linkStyles.step') },
    { key: 'bezier', name: t('graphStyleSettings.linkStyles.bezier') }
  ];
  const linkAnimations: { key: LinkAnimation; name: string }[] = [
    { key: 'none', name: t('graphStyleSettings.linkAnimations.none') },
    { key: 'flow', name: t('graphStyleSettings.linkAnimations.flow') },
    { key: 'pulse', name: t('graphStyleSettings.linkAnimations.pulse') },
    { key: 'dash', name: t('graphStyleSettings.linkAnimations.dash') }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose} role="presentation">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-500">
          <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-white">{t('graphStyleSettings.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-slate-500" role="tablist" aria-label={t('graphStyleSettings.title')}>
          <button
            ref={(el) => { tabRefs.current[0] = el; }}
            role="tab"
            id={`${tabIdPrefix}-colors`}
            aria-selected={activeTab === 'colors'}
            aria-controls={`${panelIdPrefix}-colors`}
            tabIndex={activeTab === 'colors' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 0)}
            onClick={() => setActiveTab('colors')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'colors'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('graphStyleSettings.tabs.colors')}
          </button>
          <button
            ref={(el) => { tabRefs.current[1] = el; }}
            role="tab"
            id={`${tabIdPrefix}-links`}
            aria-selected={activeTab === 'links'}
            aria-controls={`${panelIdPrefix}-links`}
            tabIndex={activeTab === 'links' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 1)}
            onClick={() => setActiveTab('links')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'links'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('graphStyleSettings.tabs.links')}
          </button>
          <button
            ref={(el) => { tabRefs.current[2] = el; }}
            role="tab"
            id={`${tabIdPrefix}-animations`}
            aria-selected={activeTab === 'animations'}
            aria-controls={`${panelIdPrefix}-animations`}
            tabIndex={activeTab === 'animations' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 2)}
            onClick={() => setActiveTab('animations')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'animations'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('graphStyleSettings.tabs.animations')}
          </button>
          <button
            ref={(el) => { tabRefs.current[3] = el; }}
            role="tab"
            id={`${tabIdPrefix}-nodes`}
            aria-selected={activeTab === 'nodes'}
            aria-controls={`${panelIdPrefix}-nodes`}
            tabIndex={activeTab === 'nodes' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 3)}
            onClick={() => setActiveTab('nodes')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'nodes'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('graphStyleSettings.tabs.nodes')}
          </button>
          <button
            ref={(el) => { tabRefs.current[4] = el; }}
            role="tab"
            id={`${tabIdPrefix}-edges`}
            aria-selected={activeTab === 'edges'}
            aria-controls={`${panelIdPrefix}-edges`}
            tabIndex={activeTab === 'edges' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 4)}
            onClick={() => setActiveTab('edges')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'edges'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('graphStyleSettings.tabs.edges')}
          </button>
          <button
            ref={(el) => { tabRefs.current[5] = el; }}
            role="tab"
            id={`${tabIdPrefix}-edgeSettings`}
            aria-selected={activeTab === 'edgeSettings'}
            aria-controls={`${panelIdPrefix}-edgeSettings`}
            tabIndex={activeTab === 'edgeSettings' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 5)}
            onClick={() => setActiveTab('edgeSettings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'edgeSettings'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('graphStyleSettings.tabs.edgeSettings')}
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'colors' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-colors`}
              aria-labelledby={`${tabIdPrefix}-colors`}
              tabIndex={0}
              className="space-y-4"
            >
              {coloringMode === 'level' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {t('graphStyleSettings.colorScheme.levelModeHint')}
                  </p>
                </div>
              )}

              {coloringMode === 'heatmap' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {t('graphStyleSettings.colorScheme.heatmapModeHint')}
                  </p>
                </div>
              )}

              {coloringMode === 'decay' && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    {t('graphStyleSettings.colorScheme.decayModeHint')}
                  </p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('graphStyleSettings.colorScheme.selectTitle')}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {colorSchemes.map((scheme) => {
                    // Get representative colors for the scheme
                    const schemeColors = COLOR_SCHEMES[scheme.key] || COLOR_SCHEMES.default;
                    const previewColors = [
                      schemeColors.mastered.primary,
                      schemeColors.due.primary,
                      schemeColors.new.primary
                    ];

                    return (
                      <button
                        key={scheme.key}
                        onClick={() => onColorSchemeChange(scheme.key)}
                        disabled={coloringMode !== 'status'}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          currentColorScheme === scheme.key
                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-slate-500 hover:border-gray-300 dark:hover:border-slate-600'
                        } ${coloringMode !== 'status' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {previewColors.map((color, idx) => (
                              <div 
                                key={idx} 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{scheme.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{t('graphStyleSettings.colorScheme.currentScheme')}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {currentSchemeName ? t(currentSchemeName) : ''}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {(() => {
                      const currentColors = COLOR_SCHEMES[currentColorScheme] || COLOR_SCHEMES.default;
                      return [
                        currentColors.mastered.primary,
                        currentColors.due.primary,
                        currentColors.new.primary,
                        currentColors.learning.primary,
                        currentColors.locked.primary
                      ].map((color, idx) => (
                        <div 
                          key={idx} 
                          className="w-8 h-8 rounded-full" 
                          style={{ backgroundColor: color }}
                        />
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-links`}
              aria-labelledby={`${tabIdPrefix}-links`}
              tabIndex={0}
              className="space-y-4"
            >
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('graphStyleSettings.tabs.links')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {linkStyles.map((style) => (
                    <button
                      key={style.key}
                      onClick={() => onLinkStyleChange(style.key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        currentLinkStyle === style.key
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-slate-500 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <svg aria-hidden="true" width="100" height="40" viewBox="0 0 100 40">
                          {style.key === 'curved' && (
                            <path d="M 10 20 Q 50 10 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                          {style.key === 'straight' && (
                            <path d="M 10 20 L 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                          {style.key === 'step' && (
                            <path d="M 10 20 L 50 20 L 50 20 L 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                          {style.key === 'bezier' && (
                            <path d="M 10 20 Q 50 5 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 mt-2 block">{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'animations' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-animations`}
              aria-labelledby={`${tabIdPrefix}-animations`}
              tabIndex={0}
              className="space-y-4"
            >
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('graphStyleSettings.tabs.animations')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {linkAnimations.map((animation) => (
                    <button
                      key={animation.key}
                      onClick={() => onLinkAnimationChange(animation.key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        currentLinkAnimation === animation.key
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-slate-500 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <svg aria-hidden="true" width="100" height="40" viewBox="0 0 100 40">
                          <path
                            d="M 10 20 Q 50 10 90 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={animation.key === 'dash' ? '5, 5' : animation.key === 'flow' ? '10, 10' : 'none'}
                            className={animation.key !== 'none' ? 'animate-pulse' : ''}
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 mt-2 block">{animation.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-500">
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">{t('graphStyleSettings.animationDesc.title')}</h4>
                  <ul className="text-xs text-primary-800 dark:text-primary-200 space-y-1">
                    <li>• <strong>{t('graphStyleSettings.linkAnimations.flow')}</strong>: {t('graphStyleSettings.animationDesc.flow')}</li>
                    <li>• <strong>{t('graphStyleSettings.linkAnimations.pulse')}</strong>: {t('graphStyleSettings.animationDesc.pulse')}</li>
                    <li>• <strong>{t('graphStyleSettings.linkAnimations.dash')}</strong>: {t('graphStyleSettings.animationDesc.dash')}</li>
                    <li>• <strong>{t('graphStyleSettings.linkAnimations.none')}</strong>: {t('graphStyleSettings.animationDesc.none')}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-nodes`}
              aria-labelledby={`${tabIdPrefix}-nodes`}
              tabIndex={0}
              className="space-y-4"
            >
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('graphStyleSettings.nodeSizeMode.title')}</h3>
                <div className="space-y-2">
                  {[
                    { key: 'fixed' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.fixed.name'), description: t('graphStyleSettings.nodeSizeMode.fixed.description') },
                    { key: 'importance' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.importance.name'), description: t('graphStyleSettings.nodeSizeMode.importance.description') },
                    { key: 'degree' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.degree.name'), description: t('graphStyleSettings.nodeSizeMode.degree.description') },
                    { key: 'children' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.children.name'), description: t('graphStyleSettings.nodeSizeMode.children.description') }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => onNodeSizeModeChange?.(mode.key)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        nodeSizeMode === mode.key
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-slate-500 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{mode.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'edges' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-edges`}
              aria-labelledby={`${tabIdPrefix}-edges`}
              tabIndex={0}
              className="space-y-4"
            >
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('graphStyleSettings.edgeWidthMode.title')}</h3>
                <div className="space-y-2">
                  {[
                    { key: 'fixed' as EdgeWidthMode, name: t('graphStyleSettings.edgeWidthMode.fixed.name'), description: t('graphStyleSettings.edgeWidthMode.fixed.description') },
                    { key: 'strength' as EdgeWidthMode, name: t('graphStyleSettings.edgeWidthMode.strength.name'), description: t('graphStyleSettings.edgeWidthMode.strength.description') },
                    { key: 'relationship' as EdgeWidthMode, name: t('graphStyleSettings.edgeWidthMode.relationship.name'), description: t('graphStyleSettings.edgeWidthMode.relationship.description') }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => onEdgeWidthModeChange?.(mode.key)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        edgeWidthMode === mode.key
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-slate-500 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{mode.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'edgeSettings' && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-edgeSettings`}
              aria-labelledby={`${tabIdPrefix}-edgeSettings`}
              tabIndex={0}
              className="space-y-4"
            >
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{t('graphStyleSettings.edgeSettings.showLabels')}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphStyleSettings.edgeSettings.showLabelsDesc')}</div>
                </div>
                <ToggleSwitch
                  checked={showLabels}
                  onChange={(checked) => onShowLabelsChange?.(checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{t('graphStyleSettings.edgeSettings.showArrows')}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphStyleSettings.edgeSettings.showArrowsDesc')}</div>
                </div>
                <ToggleSwitch
                  checked={showArrows}
                  onChange={(checked) => onShowArrowsChange?.(checked)}
                />
              </div>
              
              {onOpenRelationshipTypeSettings && (
                <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{t('graphStyleSettings.edgeSettings.relationshipTypeManagement')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphStyleSettings.edgeSettings.relationshipTypeManagementDesc')}</div>
                    </div>
                    <button
                      onClick={onOpenRelationshipTypeSettings}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      {t('graphStyleSettings.edgeSettings.manage')}
                    </button>
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('graphStyleSettings.edgeSettings.commonRelationshipTypes')}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {commonRelationshipTypes.map(type => (
                    <div
                      key={type.name}
                      className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 dark:border-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: type.color }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t(type.display_name)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-500 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('graphStyleSettings.actions.cancel')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            {t('graphStyleSettings.actions.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
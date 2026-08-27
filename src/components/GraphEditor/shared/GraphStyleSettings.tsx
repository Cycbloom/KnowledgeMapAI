import React, { useState, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ColorScheme,
  LinkStyle,
  LinkAnimation,
  NodeSizeMode,
  EdgeWidthMode,
  GraphColorMode,
  NodeShape,
  CenterDotShape,
  LinkCapStyle,
  ArrowStyle,
  GridStyle,
} from '../../../types';
import {
  Palette,
  Shapes,
  Waypoints,
  LayoutGrid,
  ArrowRightLeft,
  Check,
  RotateCcw,
  Circle,
  Square,
  Diamond,
  Hexagon,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { getColorSchemeNames, COLOR_SCHEMES } from '../../../config/learningStatusColors';
import { PRESET_RELATIONSHIP_TYPES } from '../../../config/relationshipTypes';
import { useFocusTrap } from '../../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../../hooks/common/useEscapeKey';
import { useGraphStyleSettingsStore } from '../../../store/useGraphStyleSettingsStore';

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    aria-pressed={checked}
    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
      checked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
    {children}
  </h3>
);

interface OptionCardProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const OptionCard: React.FC<OptionCardProps> = ({ active, disabled, onClick, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`relative text-left p-3 rounded-xl border transition-all duration-150 ${
      disabled
        ? 'opacity-40 cursor-not-allowed'
        : active
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500/40 shadow-sm'
          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm'
    }`}
  >
    {active && (
      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </span>
    )}
    {children}
  </button>
);

const IconRow: React.FC<{ icon?: LucideIcon; color?: string; children?: React.ReactNode }> = ({ icon: Icon, color, children }) => (
  <div className="flex items-center justify-center h-10 text-slate-500 dark:text-slate-300" style={color ? { color } : undefined}>
    {Icon ? <Icon className="w-6 h-6" /> : children}
  </div>
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
  /** 全局「节点光晕」开关 */
  nodeGlow?: boolean;
  onNodeGlowChange?: (enabled: boolean) => void;
  showLabels?: boolean;
  onShowLabelsChange?: (show: boolean) => void;
  showArrows?: boolean;
  onShowArrowsChange?: (show: boolean) => void;
  onOpenRelationshipTypeSettings?: () => void;
}

type TabId = 'colors' | 'nodes' | 'links' | 'grid' | 'edges';

type PresetKey = 'classic' | 'flow' | 'geometry' | 'minimal';

/** 各预设的主题组合，尽量让用户一眼看到风格差异 */
interface PresetDef {
  key: PresetKey;
  colorScheme: ColorScheme;
  linkStyle: LinkStyle;
  linkAnimation: LinkAnimation;
  nodeShape: NodeShape;
  centerDotShape: CenterDotShape;
  linkCap: LinkCapStyle;
  arrowStyle: ArrowStyle;
  linkWidth: number;
  gridStyle: GridStyle;
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
  nodeGlow = false,
  onNodeGlowChange,
  showLabels = true,
  onShowLabelsChange,
  showArrows = true,
  onShowArrowsChange,
  onOpenRelationshipTypeSettings,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<TabId>('colors');
  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);

  // 持久化的新增样式设置
  const {
    nodeShape,
    centerDotShape,
    linkCap,
    arrowStyle,
    linkWidth,
    gridStyle,
    setNodeShape,
    setCenterDotShape,
    setLinkCap,
    setArrowStyle,
    setLinkWidth,
    setGridStyle,
    resetStyleSettings,
  } = useGraphStyleSettingsStore();

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'colors', label: t('graphStyleSettings.tabs.colors'), icon: Palette },
    { id: 'nodes', label: t('graphStyleSettings.tabs.nodes'), icon: Shapes },
    { id: 'links', label: t('graphStyleSettings.tabs.links'), icon: Waypoints },
    { id: 'grid', label: t('graphStyleSettings.tabs.grid'), icon: LayoutGrid },
    { id: 'edges', label: t('graphStyleSettings.tabs.edges'), icon: ArrowRightLeft },
  ];

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
    { key: 'bezier', name: t('graphStyleSettings.linkStyles.bezier') },
  ];
  const linkAnimations: { key: LinkAnimation; name: string }[] = [
    { key: 'none', name: t('graphStyleSettings.linkAnimations.none') },
    { key: 'flow', name: t('graphStyleSettings.linkAnimations.flow') },
    { key: 'pulse', name: t('graphStyleSettings.linkAnimations.pulse') },
    { key: 'dash', name: t('graphStyleSettings.linkAnimations.dash') },
  ];
  const nodeShapes: { key: NodeShape; icon: LucideIcon; label: string }[] = [
    { key: 'circle', icon: Circle, label: t('graphStyleSettings.nodeShapes.circle') },
    { key: 'square', icon: Square, label: t('graphStyleSettings.nodeShapes.square') },
    { key: 'diamond', icon: Diamond, label: t('graphStyleSettings.nodeShapes.diamond') },
    { key: 'hexagon', icon: Hexagon, label: t('graphStyleSettings.nodeShapes.hexagon') },
    { key: 'star', icon: Star, label: t('graphStyleSettings.nodeShapes.star') },
  ];
  const centerDotShapes: { key: CenterDotShape; label: string }[] = [
    { key: 'circle', label: t('graphStyleSettings.centerDotShapes.circle') },
    { key: 'diamond', label: t('graphStyleSettings.centerDotShapes.diamond') },
    { key: 'star', label: t('graphStyleSettings.centerDotShapes.star') },
    { key: 'none', label: t('graphStyleSettings.centerDotShapes.none') },
  ];
  const linkCaps: { key: LinkCapStyle; label: string }[] = [
    { key: 'round', label: t('graphStyleSettings.linkCaps.round') },
    { key: 'square', label: t('graphStyleSettings.linkCaps.square') },
    { key: 'butt', label: t('graphStyleSettings.linkCaps.butt') },
  ];
  const arrowStyles: { key: ArrowStyle; label: string; icon?: LucideIcon }[] = [
    { key: 'triangle', label: t('graphStyleSettings.arrowStyles.triangle') },
    { key: 'chevron', label: t('graphStyleSettings.arrowStyles.chevron') },
    { key: 'circle', label: t('graphStyleSettings.arrowStyles.circle') },
  ];
  const gridStyles: { key: GridStyle; label: string; description: string }[] = [
    { key: 'hidden', label: t('graphStyleSettings.gridStyles.hidden'), description: t('graphStyleSettings.gridStyles.hiddenDesc') },
    { key: 'lines', label: t('graphStyleSettings.gridStyles.lines'), description: t('graphStyleSettings.gridStyles.linesDesc') },
    { key: 'dots', label: t('graphStyleSettings.gridStyles.dots'), description: t('graphStyleSettings.gridStyles.dotsDesc') },
  ];

  const presets: { key: PresetKey; name: string }[] = [
    { key: 'classic', name: t('graphStyleSettings.presets.classic') },
    { key: 'flow', name: t('graphStyleSettings.presets.flow') },
    { key: 'geometry', name: t('graphStyleSettings.presets.geometry') },
    { key: 'minimal', name: t('graphStyleSettings.presets.minimal') },
  ];

  const applyPreset = (preset: PresetDef) => {
    onColorSchemeChange(preset.colorScheme);
    onLinkStyleChange(preset.linkStyle);
    onLinkAnimationChange(preset.linkAnimation);
    setNodeShape(preset.nodeShape);
    setCenterDotShape(preset.centerDotShape);
    setLinkCap(preset.linkCap);
    setArrowStyle(preset.arrowStyle);
    setLinkWidth(preset.linkWidth);
    setGridStyle(preset.gridStyle);
  };

  const handlePreset = (key: PresetKey) => {
    switch (key) {
      case 'classic':
        applyPreset({ key: 'classic', colorScheme: 'default', linkStyle: 'curved', linkAnimation: 'none', nodeShape: 'circle', centerDotShape: 'circle', linkCap: 'round', arrowStyle: 'triangle', linkWidth: 2, gridStyle: 'hidden' });
        break;
      case 'flow':
        applyPreset({ key: 'flow', colorScheme: 'ocean', linkStyle: 'curved', linkAnimation: 'flow', nodeShape: 'circle', centerDotShape: 'circle', linkCap: 'round', arrowStyle: 'triangle', linkWidth: 2, gridStyle: 'dots' });
        break;
      case 'geometry':
        applyPreset({ key: 'geometry', colorScheme: 'nature', linkStyle: 'bezier', linkAnimation: 'none', nodeShape: 'hexagon', centerDotShape: 'diamond', linkCap: 'square', arrowStyle: 'chevron', linkWidth: 1.5, gridStyle: 'lines' });
        break;
      case 'minimal':
        applyPreset({ key: 'minimal', colorScheme: 'default', linkStyle: 'straight', linkAnimation: 'none', nodeShape: 'circle', centerDotShape: 'none', linkCap: 'butt', arrowStyle: 'circle', linkWidth: 1.5, gridStyle: 'hidden' });
        break;
    }
  };

  const handleReset = () => {
    resetStyleSettings();
    onColorSchemeChange('default');
    onLinkStyleChange('curved');
    onLinkAnimationChange('none');
    onNodeSizeModeChange?.('fixed');
    onEdgeWidthModeChange?.('fixed');
    onNodeGlowChange?.(false);
    onShowLabelsChange?.(true);
    onShowArrowsChange?.(true);
  };

  const coloringHint = coloringMode === 'level' ? t('graphStyleSettings.colorScheme.levelModeHint') : null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose} role="presentation">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 w-[680px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                {t('graphStyleSettings.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('graphStyleSettings.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.aria.close')}
              className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* 预设 */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{t('graphStyleSettings.presets.title')}</span>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset.key)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 图标 Tab */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-3 gap-1" role="tablist" aria-label={t('graphStyleSettings.title')}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              id={`${tabIdPrefix}-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`${panelIdPrefix}-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 text-xs font-medium rounded-t-xl transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50/70 dark:bg-primary-900/10 border-b-2 border-primary-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'colors' && (
            <div role="tabpanel" id={`${panelIdPrefix}-colors`} aria-labelledby={`${tabIdPrefix}-colors`} tabIndex={0} className="space-y-6">
              {coloringHint && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                  <span className="text-xs text-amber-800 dark:text-amber-200">{coloringHint}</span>
                </div>
              )}

              <div>
                <SectionTitle>{t('graphStyleSettings.colorScheme.selectTitle')}</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  {colorSchemes.map((scheme) => {
                    const schemeColors = COLOR_SCHEMES[scheme.key] || COLOR_SCHEMES.default;
                    const previewColors = [schemeColors.mastered.primary, schemeColors.due.primary, schemeColors.new.primary];
                    return (
                      <OptionCard
                        key={scheme.key}
                        active={currentColorScheme === scheme.key}
                        disabled={coloringMode !== 'status'}
                        onClick={() => onColorSchemeChange(scheme.key)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex space-x-0.5">
                            {previewColors.map((color, idx) => (
                              <div key={idx} className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">{t(scheme.name)}</span>
                        </div>
                      </OptionCard>
                    );
                  })}
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <SectionTitle>{t('graphStyleSettings.colorScheme.currentScheme')}</SectionTitle>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{currentSchemeName ? t(currentSchemeName) : ''}</p>
                  <div className="flex space-x-2">
                    {(() => {
                      const currentColors = COLOR_SCHEMES[currentColorScheme] || COLOR_SCHEMES.default;
                      return [currentColors.mastered.primary, currentColors.due.primary, currentColors.new.primary, currentColors.learning.primary, currentColors.locked.primary].map((color, idx) => (
                        <div key={idx} className="w-7 h-7 rounded-full ring-1 ring-black/5" style={{ backgroundColor: color }} />
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div role="tabpanel" id={`${panelIdPrefix}-nodes`} aria-labelledby={`${tabIdPrefix}-nodes`} tabIndex={0} className="space-y-6">
              <div>
                <SectionTitle>{t('graphStyleSettings.nodeShape.title')}</SectionTitle>
                <div className="grid grid-cols-5 gap-3">
                  {nodeShapes.map((shape) => (
                    <OptionCard key={shape.key} active={nodeShape === shape.key} onClick={() => setNodeShape(shape.key)}>
                      <IconRow icon={shape.icon} />
                      <div className="text-xs text-center text-slate-600 dark:text-slate-300 mt-2">{shape.label}</div>
                    </OptionCard>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.centerDotShape.title')}</SectionTitle>
                <div className="grid grid-cols-4 gap-3">
                  {centerDotShapes.map((shape) => (
                    <OptionCard key={shape.key} active={centerDotShape === shape.key} onClick={() => setCenterDotShape(shape.key)}>
                      <div className="flex items-center justify-center h-10">
                        {shape.key === 'circle' && <Circle className="w-6 h-6 text-slate-500 dark:text-slate-300" strokeWidth={2.5} />}
                        {shape.key === 'diamond' && <Diamond className="w-6 h-6 text-slate-500 dark:text-slate-300" strokeWidth={2.5} />}
                        {shape.key === 'star' && <Star className="w-6 h-6 text-slate-500 dark:text-slate-300" strokeWidth={2.5} />}
                        {shape.key === 'none' && <span className="text-2xl text-slate-300 dark:text-slate-600 leading-none">—</span>}
                      </div>
                      <div className="text-xs text-center text-slate-600 dark:text-slate-300 mt-2">{shape.label}</div>
                    </OptionCard>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.nodeSizeMode.title')}</SectionTitle>
                <div className="space-y-2">
                  {[
                    { key: 'fixed' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.fixed.name'), description: t('graphStyleSettings.nodeSizeMode.fixed.description') },
                    { key: 'importance' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.importance.name'), description: t('graphStyleSettings.nodeSizeMode.importance.description') },
                    { key: 'degree' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.degree.name'), description: t('graphStyleSettings.nodeSizeMode.degree.description') },
                    { key: 'children' as NodeSizeMode, name: t('graphStyleSettings.nodeSizeMode.children.name'), description: t('graphStyleSettings.nodeSizeMode.children.description') },
                  ].map((mode) => (
                    <OptionCard key={mode.key} active={nodeSizeMode === mode.key} onClick={() => onNodeSizeModeChange?.(mode.key)}>
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{mode.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mode.description}</div>
                    </OptionCard>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{t('graphStyleSettings.nodeGlow.title')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t('graphStyleSettings.nodeGlow.description')}</div>
                </div>
                <ToggleSwitch checked={nodeGlow} onChange={(checked) => onNodeGlowChange?.(checked)} />
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div role="tabpanel" id={`${panelIdPrefix}-links`} aria-labelledby={`${tabIdPrefix}-links`} tabIndex={0} className="space-y-6">
              <div>
                <SectionTitle>{t('graphStyleSettings.tabs.links')}</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  {linkStyles.map((style) => (
                    <OptionCard key={style.key} active={currentLinkStyle === style.key} onClick={() => onLinkStyleChange(style.key)}>
                      <div className="flex items-center justify-center h-10">
                        <svg aria-hidden="true" width="100" height="40" viewBox="0 0 100 40" className="text-slate-500 dark:text-slate-300">
                          {style.key === 'curved' && <path d="M 10 20 Q 50 10 90 20" fill="none" stroke="currentColor" strokeWidth="2" />}
                          {style.key === 'straight' && <path d="M 10 20 L 90 20" fill="none" stroke="currentColor" strokeWidth="2" />}
                          {style.key === 'step' && <path d="M 10 20 L 50 20 L 50 20 L 90 20" fill="none" stroke="currentColor" strokeWidth="2" />}
                          {style.key === 'bezier' && <path d="M 10 20 Q 50 5 90 20" fill="none" stroke="currentColor" strokeWidth="2" />}
                        </svg>
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 mt-2 block text-center">{style.name}</span>
                    </OptionCard>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.linkWidth.title')}</SectionTitle>
                <div className="px-1">
                  <div className="text-sm text-slate-700 dark:text-slate-300 mb-2">{t('graphStyleSettings.linkWidth.value', { value: linkWidth })}</div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.5}
                    value={linkWidth}
                    onChange={(e) => setLinkWidth(Number(e.target.value))}
                    className="w-full accent-primary-600"
                    aria-label={t('graphStyleSettings.linkWidth.title')}
                  />
                </div>
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.linkCap.title')}</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  {linkCaps.map((cap) => (
                    <OptionCard key={cap.key} active={linkCap === cap.key} onClick={() => setLinkCap(cap.key)}>
                      <div className="flex items-center justify-center h-10">
                        <svg aria-hidden="true" width="70" height="30" viewBox="0 0 70 30" className="text-slate-500 dark:text-slate-300">
                          <line x1={5} y1={15} x2={65} y2={15} stroke="currentColor" strokeWidth={cap.key === 'butt' ? 4 : 3} strokeLinecap={cap.key} />
                        </svg>
                      </div>
                      <div className="text-sm text-center text-slate-700 dark:text-slate-300 mt-2">{cap.label}</div>
                    </OptionCard>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.arrowStyles.title')}</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  {arrowStyles.map((arrow) => (
                    <OptionCard key={arrow.key} active={arrowStyle === arrow.key} onClick={() => setArrowStyle(arrow.key)}>
                      <div className="flex items-center justify-center h-10">
                        <svg aria-hidden="true" width="70" height="30" viewBox="0 0 70 30" className="text-slate-500 dark:text-slate-300">
                          {arrow.key === 'triangle' && <path d="M 8 6 L 62 12 L 8 18 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />}
                          {arrow.key === 'chevron' && <path d="M 12 5 L 56 15 L 12 25" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
                          {arrow.key === 'circle' && <circle cx={34} cy={15} r={9} fill="none" stroke="currentColor" strokeWidth="2.4" />}
                        </svg>
                      </div>
                      <div className="text-sm text-center text-slate-700 dark:text-slate-300 mt-2">{arrow.label}</div>
                    </OptionCard>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.linkAnimations.title')}</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  {linkAnimations.map((animation) => (
                    <OptionCard key={animation.key} active={currentLinkAnimation === animation.key} onClick={() => onLinkAnimationChange(animation.key)}>
                      <div className="flex items-center justify-center h-10">
                        <svg aria-hidden="true" width="100" height="40" viewBox="0 0 100 40" className="text-slate-500 dark:text-slate-300">
                          <path d="M 10 20 Q 50 10 90 20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={animation.key === 'dash' ? '5, 5' : 'none'} className={animation.key === 'pulse' ? 'animate-pulse' : ''} />
                          {animation.key === 'flow' && (
                            <path d="M 10 20 Q 50 10 90 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="0.2 0.8" style={{ animation: 'flowPreview 1.4s linear infinite' }} />
                          )}
                          <style>{`@keyframes flowPreview { to { stroke-dashoffset: -1; } }`}</style>
                        </svg>
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 mt-2 block text-center">{animation.name}</span>
                    </OptionCard>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'grid' && (
            <div role="tabpanel" id={`${panelIdPrefix}-grid`} aria-labelledby={`${tabIdPrefix}-grid`} tabIndex={0} className="space-y-3">
              {gridStyles.map((style) => (
                <OptionCard key={style.key} active={gridStyle === style.key} onClick={() => setGridStyle(style.key)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-12 rounded-lg border flex items-center justify-center overflow-hidden ${
                      style.key === 'dots'
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : 'bg-slate-50 dark:bg-slate-800/60'
                    }`}>
                      {style.key === 'lines' ? (
                        <svg aria-hidden="true" width="56" height="36" className="text-slate-300 dark:text-slate-500">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <line key={`v${i}`} x1={10 + i * 12} y1={4} x2={10 + i * 12} y2={32} stroke="currentColor" strokeWidth="1" />
                          ))}
                          {Array.from({ length: 3 }).map((_, i) => (
                            <line key={`h${i}`} x1={4} y1={8 + i * 11} x2={52} y2={8 + i * 11} stroke="currentColor" strokeWidth="1" />
                          ))}
                        </svg>
                      ) : style.key === 'dots' ? (
                        <svg aria-hidden="true" width="56" height="36" className="text-slate-400 dark:text-slate-500">
                          {Array.from({ length: 4 }).map((_, i) =>
                            Array.from({ length: 3 }).map((__, j) => (
                              <circle key={`${i}-${j}`} cx={10 + i * 13} cy={8 + j * 12} r={1.4} fill="currentColor" />
                            )),
                          )}
                        </svg>
                      ) : (
                        <span className="text-lg text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{style.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{style.description}</div>
                    </div>
                  </div>
                </OptionCard>
              ))}
            </div>
          )}

          {activeTab === 'edges' && (
            <div role="tabpanel" id={`${panelIdPrefix}-edges`} aria-labelledby={`${tabIdPrefix}-edges`} tabIndex={0} className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{t('graphStyleSettings.edgeSettings.showLabels')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t('graphStyleSettings.edgeSettings.showLabelsDesc')}</div>
                </div>
                <ToggleSwitch checked={showLabels} onChange={(checked) => onShowLabelsChange?.(checked)} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{t('graphStyleSettings.edgeSettings.showArrows')}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{t('graphStyleSettings.edgeSettings.showArrowsDesc')}</div>
                </div>
                <ToggleSwitch checked={showArrows} onChange={(checked) => onShowArrowsChange?.(checked)} />
              </div>

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.edgeWidthMode.title')}</SectionTitle>
                <div className="space-y-2">
                  {[
                    { key: 'fixed' as EdgeWidthMode, name: t('graphStyleSettings.edgeWidthMode.fixed.name'), description: t('graphStyleSettings.edgeWidthMode.fixed.description') },
                    { key: 'strength' as EdgeWidthMode, name: t('graphStyleSettings.edgeWidthMode.strength.name'), description: t('graphStyleSettings.edgeWidthMode.strength.description') },
                    { key: 'relationship' as EdgeWidthMode, name: t('graphStyleSettings.edgeWidthMode.relationship.name'), description: t('graphStyleSettings.edgeWidthMode.relationship.description') },
                  ].map((mode) => (
                    <OptionCard key={mode.key} active={edgeWidthMode === mode.key} onClick={() => onEdgeWidthModeChange?.(mode.key)}>
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{mode.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mode.description}</div>
                    </OptionCard>
                  ))}
                </div>
              </div>

              {onOpenRelationshipTypeSettings && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{t('graphStyleSettings.edgeSettings.relationshipTypeManagement')}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{t('graphStyleSettings.edgeSettings.relationshipTypeManagementDesc')}</div>
                    </div>
                    <button onClick={onOpenRelationshipTypeSettings} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                      {t('graphStyleSettings.edgeSettings.manage')}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-1">
                <SectionTitle>{t('graphStyleSettings.edgeSettings.commonRelationshipTypes')}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {commonRelationshipTypes.map(type => (
                    <div key={type.name} className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: type.color }} />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{t(type.display_name)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t('graphStyleSettings.actions.reset')}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              {t('graphStyleSettings.actions.cancel')}
            </button>
            <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm">
              {t('graphStyleSettings.actions.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
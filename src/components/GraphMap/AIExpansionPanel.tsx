import React, { useState, useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles, Network, ChevronDown, ChevronUp, Check, Settings2, Layers, GitBranch, BookOpen, Briefcase, GraduationCap, PenTool, Link, Plus, Lock } from 'lucide-react';
import type { GraphRelationType, InfiniteExpansionProgress } from '../../types';
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';

type ExpansionMode = 'depth' | 'width';
type DepthStyle = 'academic' | 'practical' | 'beginner' | 'custom';

const DEPTH_HINT_NUMBERS = [1, 2, 3, 4] as const;
type DepthHintNumber = (typeof DEPTH_HINT_NUMBERS)[number];

const WIDTH_HINT_NUMBERS = [1, 2, 3, 4, 5] as const;
type WidthHintNumber = (typeof WIDTH_HINT_NUMBERS)[number];

interface ExpansionResultNode {
  id?: string;
  title: string;
  content?: string;
}

interface ExpansionResult {
  root: ExpansionResultNode;
  coreNodes: ExpansionResultNode[];
}

interface AIExpansionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGraphId: string;
  sourceGraphTitle: string;
  sourceGraphDescription?: string;
  onDepthExpand: (config: {
    style: DepthStyle;
    customPrompt?: string;
    sources?: string[];
    depth: number;
  }) => Promise<ExpansionResult | null>;
  onWidthExpand: (config: {
    max_depth: number;
    max_graphs_per_level: number;
    relation_types: GraphRelationType[];
    auto_generate_nodes: boolean;
    node_depth: number;
  }) => Promise<void>;
  progress?: InfiniteExpansionProgress | null;
  isRunning?: boolean;
  onEditPrompt?: (mode: ExpansionMode) => void;
  hasNodes?: boolean;
  /** 仅深度拓展：隐藏宽度拓展入口，强制 depth 模式 */
  depthOnly?: boolean;
}

const styleOptionDefs = [
  {
    value: 'academic',
    labelKey: 'graphEditor.graphMap.aiExpansion.styleAcademic',
    detailsKey: 'graphEditor.graphMap.aiExpansion.styleAcademicDetails',
    icon: GraduationCap,
  },
  {
    value: 'practical',
    labelKey: 'graphEditor.graphMap.aiExpansion.stylePractical',
    detailsKey: 'graphEditor.graphMap.aiExpansion.stylePracticalDetails',
    icon: Briefcase,
  },
  {
    value: 'beginner',
    labelKey: 'graphEditor.graphMap.aiExpansion.styleBeginner',
    detailsKey: 'graphEditor.graphMap.aiExpansion.styleBeginnerDetails',
    icon: BookOpen,
  },
  {
    value: 'custom',
    labelKey: 'graphEditor.graphMap.aiExpansion.styleCustom',
    detailsKey: 'graphEditor.graphMap.aiExpansion.styleCustomDetails',
    icon: PenTool,
  },
] as const satisfies readonly {
  value: DepthStyle;
  labelKey: string;
  detailsKey: string;
  icon: typeof GraduationCap;
}[];

const relationTypeOptionDefs = [
  { value: 'prerequisite', labelKey: 'graphEditor.graphMap.aiExpansion.relationPrerequisite', color: 'bg-primary-500' },
  { value: 'extension', labelKey: 'graphEditor.graphMap.aiExpansion.relationExtension', color: 'bg-green-500' },
  { value: 'related', labelKey: 'graphEditor.graphMap.aiExpansion.relationRelated', color: 'bg-amber-500' },
] as const satisfies readonly {
  value: GraphRelationType;
  labelKey: string;
  color: string;
}[];

export const AIExpansionPanel: React.FC<AIExpansionPanelProps> = ({
  isOpen,
  onClose,
  sourceGraphId: _sourceGraphId,
  sourceGraphTitle,
  sourceGraphDescription: _sourceGraphDescription,
  onDepthExpand,
  onWidthExpand,
  progress,
  isRunning = false,
  onEditPrompt,
  hasNodes = false,
  depthOnly = false,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ExpansionMode>(
    depthOnly ? 'depth' : hasNodes ? 'width' : 'depth',
  );

  const [depthStyle, setDepthStyle] = useState<DepthStyle>('academic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [depthLevel, setDepthLevel] = useState<DepthHintNumber>(2);

  const [maxDepth, setMaxDepth] = useState<WidthHintNumber>(2);
  const [maxGraphsPerLevel, setMaxGraphsPerLevel] = useState(3);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<GraphRelationType[]>(['prerequisite', 'extension', 'related']);
  // 预构建已选关系类型集合，避免渲染选项时对每个类型线性 includes（原为 O(options*selectedTypes)）
  const selectedRelationTypeSet = useMemo(
    () => new Set(selectedRelationTypes),
    [selectedRelationTypes],
  );
  const [autoGenerateNodes, setAutoGenerateNodes] = useState(false);
  const [nodeDepth, setNodeDepth] = useState(2);
  // 图内已有节点时，深度拓展默认锁定（通常只生成一次），需解锁后才能再次生成
  const [depthUnlocked, setDepthUnlocked] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [depthProgress, setDepthProgress] = useState<{
    status: 'idle' | 'submitted' | 'completed';
    currentStep: string;
    nodesCreated: number;
    error?: string;
  }>({ status: 'idle', currentStep: '', nodesCreated: 0 });

  const styleOptions = styleOptionDefs.map((opt) => ({
    ...opt,
    label: t(opt.labelKey),
    details: t(opt.detailsKey),
  }));

  const relationTypeOptions = relationTypeOptionDefs.map((opt) => ({
    ...opt,
    label: t(opt.labelKey),
  }));

  const toggleRelationType = (type: GraphRelationType) => {
    setSelectedRelationTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleAddSource = () => {
    if (newSource.trim()) {
      setSources(prev => [...prev, newSource.trim()]);
      setNewSource('');
    }
  };

  const handleRemoveSource = (index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (mode === 'depth') {
        if (hasNodes && !depthUnlocked) {
          setIsSubmitting(false);
          return;
        }
        if (depthStyle === 'custom' && !customPrompt.trim()) {
          setIsSubmitting(false);
          return;
        }

        // 完全后台化：提交单个递归构建后台任务，宿主负责 startTracking 右下角通知
        await onDepthExpand({
          style: depthStyle,
          customPrompt: depthStyle === 'custom' ? customPrompt : undefined,
          sources: sources.length > 0 ? sources : undefined,
          depth: depthLevel,
        });

        setDepthProgress({ status: 'submitted', currentStep: t('graphEditor.graphMap.aiExpansion.submitted'), nodesCreated: 0 });
      } else {
        if (selectedRelationTypes.length === 0) {
          setIsSubmitting(false);
          return;
        }
        // 宽度拓展：后台批量任务（infinite_graph_expansion），宿主负责 startTracking 右下角通知
        await onWidthExpand({
          max_depth: maxDepth,
          max_graphs_per_level: maxGraphsPerLevel,
          relation_types: selectedRelationTypes,
          auto_generate_nodes: autoGenerateNodes,
          node_depth: nodeDepth,
        });

        setDepthProgress({ status: 'submitted', currentStep: t('graphEditor.graphMap.aiExpansion.submitted'), nodesCreated: 0 });
      }
    } catch (error) {
      console.error('Failed to start expansion:', error);
      setDepthProgress(prev => ({ ...prev, status: 'idle', error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isRunning && progress) {
      setIsSubmitting(false);
    }
  }, [isRunning, progress]);
  
  useEffect(() => {
    if (isOpen) {
      setDepthProgress({ status: 'idle', currentStep: '', nodesCreated: 0 });
      // 每次打开弹窗都需重新解锁：图内已有节点时深度拓展默认回到锁定态
      setDepthUnlocked(false);
    }
  }, [isOpen]);

  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              {t('graphEditor.graphMap.aiExpansion.title')}
            </h2>
            <div className="flex items-center gap-2">
              {onEditPrompt && (
                <button
                  onClick={() => onEditPrompt(mode)}
                  className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                  title={t('graphEditor.graphMap.aiExpansion.editPrompt')}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                <Network className="w-4 h-4" />
                <span className="font-medium">{t('graphEditor.graphMap.aiExpansion.sourceGraph')}</span>
                <span>{sourceGraphTitle}</span>
              </div>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                {t('graphEditor.graphMap.aiExpansion.expansionHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('graphEditor.graphMap.aiExpansion.expansionMethod')}
              </label>
              <div className={`grid gap-2 ${depthOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <button
                  onClick={() => setMode('depth')}
                  disabled={isRunning}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    mode === 'depth'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-primary-500" />
                    <span className="text-gray-900 dark:text-white font-medium">{t('graphEditor.graphMap.aiExpansion.depthExpansion')}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('graphEditor.graphMap.aiExpansion.depthExpansionDesc')}
                  </p>
                </button>
                {!depthOnly ? (
                  <button
                    onClick={() => setMode('width')}
                    disabled={isRunning}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      mode === 'width'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-gray-900 dark:text-white">{t('graphEditor.graphMap.aiExpansion.widthExpansion')}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('graphEditor.graphMap.aiExpansion.widthExpansionDesc')}
                    </p>
                  </button>
                ) : null}
              </div>
            </div>

            {mode === 'depth' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('graphEditor.graphMap.aiExpansion.generationStyle')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {styleOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setDepthStyle(option.value)}
                        disabled={isRunning}
                        className={`p-2 rounded-lg border-2 transition-all text-left ${
                          depthStyle === option.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{String(option.label)}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{String(option.details)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {depthStyle === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('graphEditor.graphMap.aiExpansion.customRules')}
                    </label>
                    <textarea
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      disabled={isRunning}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                      placeholder={t('graphEditor.graphMap.aiExpansion.customRulesPlaceholder')}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('graphEditor.graphMap.aiExpansion.referenceSources')}
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSource}
                        onChange={e => setNewSource(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSource()}
                        disabled={isRunning}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        placeholder={t('graphEditor.graphMap.aiExpansion.referenceSourcesPlaceholder')}
                      />
                      <button
                        onClick={handleAddSource}
                        disabled={isRunning || !newSource.trim()}
                        className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sources.map((source, index) => (
                          <div key={index} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-xs">
                            <Link className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{source}</span>
                            <button
                              onClick={() => handleRemoveSource(index)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('graphEditor.graphMap.aiExpansion.depthLevel', { count: depthLevel })}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={depthLevel}
                    onChange={e => setDepthLevel(DEPTH_HINT_NUMBERS[Number(e.target.value) - 1])}
                    disabled={isRunning}
                    aria-label={t('graphEditor.graphMap.aiExpansion.depthLevel', { count: depthLevel })}
                    className="w-full h-2 bg-primary-200 dark:bg-primary-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{t('graphEditor.graphMap.aiExpansion.depthLevelMin')}</span>
                    <span>{t('graphEditor.graphMap.aiExpansion.depthLevelMax')}</span>
                  </div>
                </div>

                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <p className="text-xs text-primary-600 dark:text-primary-400">
                    {t(`graphEditor.graphMap.aiExpansion.depthHint${depthLevel}`)}
                  </p>
                </div>

                {depthProgress.status !== 'idle' && (
                  <div role="status" className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      {depthProgress.status === 'completed' ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                      )}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {depthProgress.status === 'completed' ? t('graphEditor.graphMap.aiExpansion.generationComplete') : depthProgress.currentStep}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {t('graphEditor.graphMap.aiExpansion.nodesCreated', { count: depthProgress.nodesCreated })}
                    </div>
                    {depthProgress.error && (
                      <div className="text-sm text-red-500 mt-1">{depthProgress.error}</div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {mode === 'width' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('graphEditor.graphMap.aiExpansion.relationType')}
                  </label>
                  <div className="flex gap-2">
                    {relationTypeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleRelationType(option.value)}
                        disabled={isRunning}
                        className={`flex-1 p-2 rounded-lg border-2 transition-all text-center ${
                          selectedRelationTypeSet.has(option.value)
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${option.color}`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {String(option.label)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('graphEditor.graphMap.aiExpansion.widthDepth', { count: maxDepth })}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={e => setMaxDepth(WIDTH_HINT_NUMBERS[Number(e.target.value) - 1])}
                    disabled={isRunning}
                    aria-label={t('graphEditor.graphMap.aiExpansion.widthDepth', { count: maxDepth })}
                    className="w-full h-2 bg-emerald-200 dark:bg-emerald-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{t('graphEditor.graphMap.aiExpansion.depthLevelMin')}</span>
                    <span>{t('graphEditor.graphMap.aiExpansion.widthDepthMax')}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {t('graphEditor.graphMap.aiExpansion.advancedOptions')}
                </button>

                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('graphEditor.graphMap.aiExpansion.maxGraphsPerLevel', { count: maxGraphsPerLevel })}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={maxGraphsPerLevel}
                        onChange={e => setMaxGraphsPerLevel(Number(e.target.value))}
                        disabled={isRunning}
                        aria-label={t('graphEditor.graphMap.aiExpansion.maxGraphsPerLevel', { count: maxGraphsPerLevel })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <input
                        type="checkbox"
                        id="autoGenerateNodes"
                        checked={autoGenerateNodes}
                        onChange={e => setAutoGenerateNodes(e.target.checked)}
                        disabled={isRunning}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="autoGenerateNodes" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span>{t('graphEditor.graphMap.aiExpansion.autoGenerateNodes')}</span>
                      </label>
                    </div>

                    {autoGenerateNodes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('graphEditor.graphMap.aiExpansion.nodeDepth', { count: nodeDepth })}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          value={nodeDepth}
                          onChange={e => setNodeDepth(Number(e.target.value))}
                          disabled={isRunning}
                          aria-label={t('graphEditor.graphMap.aiExpansion.nodeDepth', { count: nodeDepth })}
                          className="w-full h-2 bg-primary-200 dark:bg-primary-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {t(`graphEditor.graphMap.aiExpansion.widthHint${maxDepth}`)}
                  </p>
                  {autoGenerateNodes && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                      {t('graphEditor.graphMap.aiExpansion.autoGenerateNodesHint', { count: nodeDepth })}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {(isRunning || isSubmitting) && progress && (
              <div role="status" className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('graphEditor.graphMap.aiExpansion.expanding')}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{t('graphEditor.graphMap.aiExpansion.currentDepth')}</span>
                    <span>{progress.current_depth} / {maxDepth}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{t('graphEditor.graphMap.aiExpansion.graphsCreated')}</span>
                    <span>{progress.total_graphs_created}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{t('graphEditor.graphMap.aiExpansion.nodesCreatedLabel')}</span>
                    <span>{progress.total_nodes_created}</span>
                  </div>
                  {progress.current_graph_title && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      {t('graphEditor.graphMap.aiExpansion.processing', { title: progress.current_graph_title })}
                    </div>
                  )}
                </div>

                {progress.created_graphs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {t('graphEditor.graphMap.aiExpansion.createdGraphs')}
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {progress.created_graphs.slice(-5).map((g, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            g.relation_type === 'prerequisite' ? 'bg-primary-500' :
                            g.relation_type === 'extension' ? 'bg-green-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{g.title}</span>
                          <span className="text-gray-400">{t('graphEditor.graphMap.aiExpansion.nodeCountShort', { count: g.node_count ?? 0 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {progress?.status === 'completed' && (
              <div role="status" className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{t('graphEditor.graphMap.aiExpansion.expandComplete')}</span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  {t('graphEditor.graphMap.aiExpansion.expandCompleteDesc', {
                    graphs: progress.total_graphs_created,
                    nodes: progress.total_nodes_created,
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 sticky bottom-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {mode === 'depth'
                ? depthProgress.status === 'completed'
                  ? t('graphEditor.graphMap.aiExpansion.close')
                  : t('graphEditor.graphMap.aiExpansion.cancel')
                : (depthProgress.status === 'submitted' || progress?.status === 'completed')
                  ? t('graphEditor.graphMap.aiExpansion.close')
                  : t('graphEditor.graphMap.aiExpansion.cancel')}
            </button>
            {depthProgress.status !== 'submitted' && progress?.status !== 'running' && (
              <div className="flex items-center gap-2">
                {mode === 'depth' && hasNodes && !depthUnlocked && (
                  <button
                    onClick={() => setDepthUnlocked(true)}
                    disabled={isSubmitting || isRunning}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('graphEditor.graphMap.aiExpansion.depthLockedHint')}
                  >
                    <Lock className="w-4 h-4" />
                    {t('graphEditor.graphMap.aiExpansion.unlockDepth')}
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={(mode === 'depth' && ((depthStyle === 'custom' && !customPrompt.trim()) || (hasNodes && !depthUnlocked))) || (mode === 'width' && selectedRelationTypes.length === 0) || isSubmitting || isRunning}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('graphEditor.graphMap.aiExpansion.starting')}
                    </>
                  ) : (
                    <>
                      {mode === 'depth' && hasNodes && !depthUnlocked && <Lock className="w-4 h-4" />}
                      <Sparkles className="w-4 h-4" />
                      {t('graphEditor.graphMap.aiExpansion.startExpand')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

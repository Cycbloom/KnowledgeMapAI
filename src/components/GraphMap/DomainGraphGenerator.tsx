import React, { useState } from 'react';
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  Sparkles,
  Network,
  Check,
  Search,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings2,
  ArrowRight,
  GitBranch,
  Plus,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Map,
} from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

export interface RecommendedGraph {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface GraphRelation {
  from_title: string;
  to_title: string;
  type: 'prerequisite' | 'extension' | 'related';
  reason?: string;
}

interface CreatedGraph {
  graphId: string;
  title: string;
  isNew: boolean;
}

interface FailedGraph {
  title: string;
  error: string;
  reason: string;
}

interface BatchCreateResult {
  created: CreatedGraph[];
  failed?: FailedGraph[];
  summary?: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
}

interface DomainGraphGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateDomain: (domain: string, count: number) => Promise<{ graphs: RecommendedGraph[]; relations: GraphRelation[] }>;
  onBatchCreate: (graphs: RecommendedGraph[], relations: GraphRelation[], domain?: string) => Promise<BatchCreateResult>;
  onInitializeGraphs?: (graphIds: string[]) => Promise<void>;
  onLoadSourceGraphs?: () => Promise<{ graphs: SourceGraph[] }>;
  onLoadDomains?: () => Promise<{ domains: DomainItem[] }>;
  onExpandDomain?: (graphIds: string[], count: number, domain?: string) => Promise<{ recommendations: RecommendedGraph[]; relations: GraphRelation[] }>;
}

interface DomainItem {
  name: string;
  count: number;
}

const relationTypeConfig = {
  prerequisite: { label: '前置知识', color: 'bg-primary-500', textColor: 'text-primary-600 dark:text-primary-400' },
  extension: { label: '扩展知识', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
  related: { label: '相关知识', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
};

const priorityConfig = {
  high: { label: '高优先级', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: '中优先级', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: '低优先级', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' },
};

type Step = 'input' | 'select' | 'creating' | 'initialize_prompt' | 'initializing' | 'complete';
type GenerationMode = 'new' | 'expand';

interface CreateProgress {
  current: number;
  total: number;
  status: 'pending' | 'creating' | 'completed' | 'error';
  error?: string;
}

interface SourceGraph {
  id: string;
  title: string;
  description?: string;
  node_count?: number;
}

export const DomainGraphGenerator: React.FC<DomainGraphGeneratorProps> = ({
  isOpen,
  onClose,
  onGenerateDomain,
  onBatchCreate,
  onInitializeGraphs,
  onLoadSourceGraphs,
  onLoadDomains,
  onExpandDomain,
}) => {
  const [mode, setMode] = useState<GenerationMode>('new');
  const { t } = useTranslation();
  const [domain, setDomain] = useState('');
  const [expandDomain, setExpandDomain] = useState('');
  const [graphCount, setGraphCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [recommendedGraphs, setRecommendedGraphs] = useState<RecommendedGraph[]>([]);
  const [graphRelations, setGraphRelations] = useState<GraphRelation[]>([]);
  const [selectedGraphs, setSelectedGraphs] = useState<Set<number>>(new Set());
  const [selectedSourceGraphs, setSelectedSourceGraphs] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [availableDomains, setAvailableDomains] = useState<DomainItem[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [createProgress, setCreateProgress] = useState<CreateProgress>({
    current: 0,
    total: 0,
    status: 'pending',
  });
  const [error, setError] = useState<string | null>(null);
  const [createdGraphs, setCreatedGraphs] = useState<CreatedGraph[]>([]);
  const [failedGraphs, setFailedGraphs] = useState<FailedGraph[] | undefined>();
  const [showFailedDetails, setShowFailedDetails] = useState(false);
  const [sourceGraphs, setSourceGraphs] = useState<SourceGraph[]>([]);
  const [isLoadingSourceGraphs, setIsLoadingSourceGraphs] = useState(false);

  const loadSourceGraphs = async () => {
    if (!onLoadSourceGraphs) return;
    try {
      setIsLoadingSourceGraphs(true);
      const result = await onLoadSourceGraphs();
      if (result?.graphs) {
        setSourceGraphs(result.graphs);
      }
    } catch (err) {
      console.error('Failed to load source graphs:', err);
    } finally {
      setIsLoadingSourceGraphs(false);
    }
  };

  const loadDomains = async () => {
    if (!onLoadDomains) return;
    try {
      setIsLoadingDomains(true);
      const result = await onLoadDomains();
      if (result?.domains) {
        setAvailableDomains(result.domains);
      }
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setIsLoadingDomains(false);
    }
  };

  const toggleSourceGraph = (graphId: string) => {
    setSelectedSourceGraphs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(graphId)) {
        newSet.delete(graphId);
      } else {
        if (newSet.size >= 5) return prev;
        newSet.add(graphId);
      }
      return newSet;
    });
  };

  const handleGenerate = async () => {
    if (mode === 'new' && !domain.trim()) return;
    if (mode === 'expand' && selectedSourceGraphs.size === 0 && !expandDomain.trim()) return;

    setIsGenerating(true);
    setError(null);
    setRecommendedGraphs([]);
    setGraphRelations([]);
    setSelectedGraphs(new Set());
    setCreatedGraphs([]);

    try {
      let result;
      if (mode === 'new') {
        result = await onGenerateDomain(domain.trim(), graphCount);
        setRecommendedGraphs(result.graphs);
      } else {
        if (!onExpandDomain) return;
        result = await onExpandDomain(
          Array.from(selectedSourceGraphs),
          graphCount,
          expandDomain.trim() || undefined
        );
        setRecommendedGraphs(result.recommendations);
      }
      setGraphRelations(result.relations);
      setStep('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成推荐图谱失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModeChange = (newMode: GenerationMode) => {
    setMode(newMode);
    setStep('input');
    setError(null);
    if (newMode === 'expand') {
      loadSourceGraphs();
      loadDomains();
    }
  };

  const toggleGraph = (index: number) => {
    const newSelected = new Set(selectedGraphs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedGraphs(newSelected);
  };

  const toggleAll = () => {
    if (selectedGraphs.size === recommendedGraphs.length) {
      setSelectedGraphs(new Set());
    } else {
      setSelectedGraphs(new Set(recommendedGraphs.map((_, i) => i)));
    }
  };

  const getFilteredRelations = (): GraphRelation[] => {
    const selectedTitles = new Set(
      recommendedGraphs
        .filter((_, i) => selectedGraphs.has(i))
        .map(g => g.title.toLowerCase())
    );
    
    return graphRelations.filter(rel => 
      selectedTitles.has(rel.from_title.toLowerCase()) && 
      selectedTitles.has(rel.to_title.toLowerCase())
    );
  };

  const handleBatchCreate = async () => {
    if (selectedGraphs.size === 0) return;

    const selectedItems = recommendedGraphs.filter((_, i) => selectedGraphs.has(i));
    const filteredRelations = getFilteredRelations();
    
    setIsCreating(true);
    setStep('creating');
    setCreateProgress({
      current: 0,
      total: selectedItems.length,
      status: 'creating',
    });

    try {
      const effectiveDomain = mode === 'expand' ? expandDomain.trim() : domain.trim();
      const result = await onBatchCreate(selectedItems, filteredRelations, effectiveDomain || undefined);
      setCreatedGraphs(result.created);
      setFailedGraphs(result.failed);
      setCreateProgress(prev => ({ ...prev, status: 'completed', current: prev.total }));
      
      const newGraphs = result.created.filter(g => g.isNew);
      if (newGraphs.length > 0 && onInitializeGraphs) {
        setStep('initialize_prompt');
      } else {
        setStep('complete');
      }
    } catch (err) {
      setCreateProgress(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : '批量创建失败',
      }));
    } finally {
      setIsCreating(false);
    }
  };

  const handleInitialize = async () => {
    const newGraphIds = createdGraphs.filter(g => g.isNew).map(g => g.graphId);
    if (newGraphIds.length === 0 || !onInitializeGraphs) return;

    setIsInitializing(true);
    setStep('initializing');

    try {
      await onInitializeGraphs(newGraphIds);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败');
      setStep('complete');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!failedGraphs || failedGraphs.length === 0) return;
    const retryItems = failedGraphs.map(fg => ({ title: fg.title, description: '', priority: 'medium' as const }));
    setIsCreating(true);
    setStep('creating');
    try {
      const effectiveDomain = mode === 'expand' ? expandDomain.trim() : domain.trim();
      const result = await onBatchCreate(retryItems, [], effectiveDomain || undefined);
      setCreatedGraphs(prev => [...prev, ...result.created]);
      setFailedGraphs(result.failed);
      setShowFailedDetails(false);
      if (!result.failed || result.failed.length === 0) {
        setStep('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating && !isCreating && !isInitializing) {
      setMode('new');
      setDomain('');
      setExpandDomain('');
      setRecommendedGraphs([]);
      setGraphRelations([]);
      setSelectedGraphs(new Set());
      setSelectedSourceGraphs(new Set());
      setCreatedGraphs([]);
      setFailedGraphs(undefined);
      setShowFailedDetails(false);
      setSourceGraphs([]);
      setStep('input');
      setError(null);
      setShowRelations(false);
      setCreateProgress({ current: 0, total: 0, status: 'pending' });
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isGenerating) {
      if (mode === 'new' && domain.trim()) {
        handleGenerate();
      } else if (mode === 'expand' && (selectedSourceGraphs.size > 0 || expandDomain.trim())) {
        handleGenerate();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-primary-500" />
              领域图谱批量生成
            </h2>
            <button
              onClick={handleClose}
              disabled={isGenerating || isCreating || isInitializing}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {step === 'input' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleModeChange('new')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      mode === 'new'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    从零开始
                  </button>
                  <button
                    onClick={() => handleModeChange('expand')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      mode === 'expand'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    从现有图谱扩展                  </button>
                </div>

                {mode === 'new' && (
                  <>
                    <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <p className="text-sm text-primary-700 dark:text-primary-300">
                        输入一个领域主题，AI 将为您生成推荐的知识图谱列表，并分析它们之间的学习依赖关系。                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        领域主题
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={domain}
                          onChange={e => setDomain(e.target.value)}
                          onKeyDown={handleKeyDown}
                          disabled={isGenerating}
                          placeholder="例如：机器学习、前端开发、数据结构..."
                          className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </>
                )}

                {mode === 'expand' && (
                  <>
                    <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <p className="text-sm text-primary-700 dark:text-primary-300">
                        选择现有图谱或选择领域，AI 将基于它们推荐相关的新知识图谱，帮助您扩展知识体系。                      </p>
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                        可以选择图谱、选择领域，或两者结合。                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        选择领域（可选）
                      </label>
                      {isLoadingDomains ? (
                        <div className="flex items-center gap-2 py-2.5 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700">
                          <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">加载领域...</span>
                        </div>
                      ) : availableDomains.length > 0 ? (
                        <select
                          value={expandDomain}
                          onChange={e => setExpandDomain(e.target.value)}
                          disabled={isGenerating}
                          className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                        >
                          <option value="">-- 请选择领域 --</option>
                          {availableDomains.map(domain => (
                            <option key={domain.name} value={domain.name}>
                              {domain.name} ({domain.count} 个图谱)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <EmptyState
                          icon={<Map size={32} />}
                          title={t('graphMap.empty.domains')}
                          className="min-h-0 py-6"
                        />
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        选择领域后，AI 会将该领域内的所有图谱信息纳入推荐参考。                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          选择现有图谱（可选，最多 5 个）
                        </label>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          已选择 {selectedSourceGraphs.size} / 5
                        </span>
                      </div>

                      {isLoadingSourceGraphs ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            加载图谱中...
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {sourceGraphs.map((graph) => (
                            <button
                              key={graph.id}
                              onClick={() => toggleSourceGraph(graph.id)}
                              disabled={!selectedSourceGraphs.has(graph.id) && selectedSourceGraphs.size >= 5}
                              className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                                selectedSourceGraphs.has(graph.id)
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              } ${
                                !selectedSourceGraphs.has(graph.id) && selectedSourceGraphs.size >= 5
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  selectedSourceGraphs.has(graph.id)
                                    ? 'bg-primary-500 text-white'
                                    : 'border-2 border-gray-300 dark:border-gray-600'
                                }`}>
                                  {selectedSourceGraphs.has(graph.id) && <Check className="w-3 h-3" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white truncate">
                                    {graph.title}
                                  </div>
                                  {graph.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                      {graph.description}
                                    </p>
                                  )}
                                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {graph.node_count || 0} 个节点                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <Settings2 className="w-4 h-4" />
                  高级选项
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
                        生成数量
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={5}
                          max={30}
                          value={graphCount}
                          onChange={e => setGraphCount(parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                        <input
                          type="number"
                          min={5}
                          max={30}
                          value={graphCount}
                          onChange={e => {
                            const value = Math.min(30, Math.max(5, parseInt(e.target.value) || 5));
                            setGraphCount(value);
                          }}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-center"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        推荐图谱数量，创建后可选择性初始化知识点。                      </p>
                    </div>
                  </motion.div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'select' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                    <Check className="w-4 h-4" />
                    <span>{mode === 'new' ? `基于「${domain}」为您` : '基于现有图谱'}推荐 {recommendedGraphs.length} 个知识图谱，发现 {graphRelations.length} 条依赖关系</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    已选 {selectedGraphs.size} / {recommendedGraphs.length} 个 </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowRelations(!showRelations)}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
                    >
                      <GitBranch className="w-4 h-4" />
                      {showRelations ? '隐藏关系' : '查看关系'}
                    </button>
                    <button
                      onClick={toggleAll}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                    >
                      {selectedGraphs.size === recommendedGraphs.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                </div>

                {showRelations && graphRelations.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      知识依赖关系
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {graphRelations.map((rel, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{rel.from_title}</span>
                          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{rel.to_title}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${relationTypeConfig[rel.type].textColor} bg-opacity-20`}>
                            {relationTypeConfig[rel.type].label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {recommendedGraphs.map((graph, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => toggleGraph(idx)}
                      className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                        selectedGraphs.has(idx)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedGraphs.has(idx)
                            ? 'bg-primary-500 text-white'
                            : 'border-2 border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedGraphs.has(idx) && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {graph.title}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${priorityConfig[graph.priority].color}`}>
                              {priorityConfig[graph.priority].label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {graph.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'creating' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      正在创建图谱...
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>进度</span>
                      <span>{createProgress.current} / {createProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-primary-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(createProgress.current / createProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'initialize_prompt' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">创建成功</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    成功创建 {createdGraphs.length} 个图谱，其中 {createdGraphs.filter(g => g.isNew).length} 个为新图谱
                  </p>
                </div>

                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-primary-500" />
                    <span className="font-medium text-primary-700 dark:text-primary-300">是否初始化知识点？</span>
                  </div>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mb-3">
                    初始化将为新创建的知识图谱生成基础知识点，帮助您快速开始学习。此过程将在后台异步执行。
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleInitialize}
                      disabled={isInitializing}
                      className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {isInitializing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          正在初始化...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          开始初始化
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setStep('complete')}
                      disabled={isInitializing}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      稍后再说
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'initializing' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      正在初始化知识点...
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    初始化任务已提交，正在后台异步执行。您可以关闭此窗口，稍后在任务列表中查看进度。                  </p>
                </div>
              </motion.div>
            )}

            {step === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">操作完成</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    共创建 {createdGraphs.length} 个图谱
                    {failedGraphs && failedGraphs.length > 0 && `，${failedGraphs.length} 个失败`}
                  </p>
                </div>

                {failedGraphs && failedGraphs.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <button
                      onClick={() => setShowFailedDetails(!showFailedDetails)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        失败项目 ({failedGraphs.length})
                      </span>
                      {showFailedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showFailedDetails && (
                      <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                        {failedGraphs.map((fg, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs p-2 bg-white dark:bg-gray-800 rounded">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="font-medium text-red-800 dark:text-red-200">{fg.title}</div>
                              <div className="text-red-600 dark:text-red-400 mt-0.5">{fg.error}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={handleRetryFailed}
                      disabled={isCreating}
                      className="mt-2 w-full px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-4 h-4 ${isCreating ? 'animate-spin' : ''}`} />
                      重试失败项                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleClose()}
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    查看已创建图谱                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </motion.div>
            )}

            {createProgress.status === 'error' && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">创建失败</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {createProgress.error}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 sticky bottom-0">
            {step === 'input' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={(mode === 'new' && !domain.trim()) || (mode === 'expand' && selectedSourceGraphs.size === 0 && !expandDomain.trim()) || isGenerating}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      生成推荐
                    </>
                  )}
                </button>
              </>
            )}

            {step === 'select' && (
              <>
                <button
                  onClick={() => {
                    setStep('input');
                    setRecommendedGraphs([]);
                    setGraphRelations([]);
                    setSelectedGraphs(new Set());
                  }}
                  disabled={isCreating}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={handleBatchCreate}
                  disabled={selectedGraphs.size === 0 || isCreating}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      创建图谱 ({selectedGraphs.size})
                    </>
                  )}
                </button>
              </>
            )}

            {(step === 'creating' || step === 'initializing') && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                后台执行
              </button>
            )}

            {step === 'complete' && null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DomainGraphGenerator;

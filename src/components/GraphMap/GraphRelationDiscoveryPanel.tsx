import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Sparkles, GitBranch, Layers, Lightbulb, Loader2, 
  Check, Filter, ChevronDown, ChevronUp, Plus, AlertCircle
} from 'lucide-react';
import type { 
  DiscoveryResult, 
  DiscoveredRelation, 
  GraphRelationType,
  IntelligentSuggestion
} from '@shared/types/graph';
import { GRAPH_RELATION_COLORS, GRAPH_RELATION_LABELS } from '@shared/types/graph';

interface GraphRelationDiscoveryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  discoveryResult: DiscoveryResult | null;
  intelligentSuggestions: IntelligentSuggestion | null;
  isLoading: boolean;
  onDiscover: (options?: { graph_ids?: string[]; max_suggestions?: number }) => void;
  onCreateRelation: (relation: DiscoveredRelation) => Promise<void>;
  onGraphClick: (graphId: string) => void;
  createdRelationIds: Set<string>;
}

type FilterType = 'all' | GraphRelationType;
type SortBy = 'confidence' | 'type';

export const GraphRelationDiscoveryPanel: React.FC<GraphRelationDiscoveryPanelProps> = ({
  isOpen,
  onClose,
  discoveryResult,
  intelligentSuggestions,
  isLoading,
  onDiscover,
  onCreateRelation,
  onGraphClick,
  createdRelationIds,
}) => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('confidence');
  const [showFilters, setShowFilters] = useState(false);
  const [creatingRelationId, setCreatingRelationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'relations' | 'insights' | 'suggestions'>('relations');

  if (!isOpen) return null;

  const getRelationKey = (rel: DiscoveredRelation) => 
    `${rel.source_graph_id}-${rel.target_graph_id}-${rel.relation_type}`;

  const filteredRelations = discoveryResult?.discovered_relations.filter(rel => {
    if (filterType === 'all') return true;
    return rel.relation_type === filterType;
  }) || [];

  const sortedRelations = [...filteredRelations].sort((a, b) => {
    if (sortBy === 'confidence') {
      return b.confidence - a.confidence;
    }
    return a.relation_type.localeCompare(b.relation_type);
  });

  const handleCreateRelation = async (rel: DiscoveredRelation) => {
    const key = getRelationKey(rel);
    setCreatingRelationId(key);
    try {
      await onCreateRelation(rel);
    } finally {
      setCreatingRelationId(null);
    }
  };

  const isRelationCreated = (rel: DiscoveredRelation) => {
    return createdRelationIds.has(getRelationKey(rel));
  };

  const isRelationCreating = (rel: DiscoveredRelation) => {
    return creatingRelationId === getRelationKey(rel);
  };

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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              智能关系发现
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-400">正在分析图谱关系...</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">这可能需要几秒钟</p>
              </div>
            ) : !discoveryResult ? (
              <div className="flex flex-col items-center justify-center py-12">
                <GitBranch className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  点击下方按钮开始智能分析
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 text-center max-w-md">
                  AI将分析您的知识图谱，发现潜在的关联关系、交叉学科知识网络，并提供学习建议
                </p>
                <button
                  onClick={() => onDiscover()}
                  className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  开始智能分析
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {discoveryResult.analysis_summary.total_graphs_analyzed}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">分析图谱</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {discoveryResult.analysis_summary.relations_discovered}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">发现关系</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {discoveryResult.analysis_summary.cross_domain_clusters}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">跨学科群</div>
                  </div>
                </div>

                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('relations')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'relations'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    发现的关系 ({sortedRelations.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('insights')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'insights'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    跨学科洞察 ({discoveryResult.cross_domain_insights.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'suggestions'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {t('graphEditor.graphMap.relationDiscovery.learningSuggestions')}
                  </button>
                </div>

                {activeTab === 'relations' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <Filter className="w-4 h-4" />
                        {t('graphEditor.graphMap.relationDiscovery.filter')}
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div className="flex gap-2">
                        <select
                          value={sortBy}
                          onChange={e => setSortBy(e.target.value as SortBy)}
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                        >
                          <option value="confidence">{t('graphEditor.graphMap.relationDiscovery.sortByConfidence')}</option>
                          <option value="type">{t('graphEditor.graphMap.relationDiscovery.sortByType')}</option>
                        </select>
                      </div>
                    </div>

                    {showFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex flex-wrap gap-2"
                      >
                        <button
                          onClick={() => setFilterType('all')}
                          className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            filterType === 'all'
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {t('graphEditor.graphMap.relationDiscovery.all')}
                        </button>
                        {(['prerequisite', 'extension', 'related', 'cross_domain'] as GraphRelationType[]).map(type => (
                          <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${
                              filterType === type
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: GRAPH_RELATION_COLORS[type] }}
                            />
                            {GRAPH_RELATION_LABELS[type]}
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {sortedRelations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {t('graphEditor.graphMap.relationDiscovery.noRelationsFound')}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sortedRelations.map((rel, idx) => {
                          const isCreated = isRelationCreated(rel);
                          const isCreating = isRelationCreating(rel);
                          
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`p-3 rounded-lg border ${
                                isCreated 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                  : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div 
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: GRAPH_RELATION_COLORS[rel.relation_type] }}
                                    />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                      {GRAPH_RELATION_LABELS[rel.relation_type]}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {t('graphEditor.graphMap.relationDiscovery.confidence')} {(rel.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 text-sm">
                                    <button
                                      onClick={() => onGraphClick(rel.source_graph_id)}
                                      className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[150px]"
                                    >
                                      {rel.source_graph_title}
                                    </button>
                                    <span className="text-gray-400">→</span>
                                    <button
                                      onClick={() => onGraphClick(rel.target_graph_id)}
                                      className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[150px]"
                                    >
                                      {rel.target_graph_title}
                                    </button>
                                  </div>
                                  
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                    {rel.reason}
                                  </p>
                                  
                                  {rel.shared_concepts.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {rel.shared_concepts.slice(0, 3).map((concept, i) => (
                                        <span
                                          key={i}
                                          className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300 rounded"
                                        >
                                          {concept}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => handleCreateRelation(rel)}
                                  disabled={isCreated || isCreating}
                                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 ${
                                    isCreated
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default'
                                      : isCreating
                                      ? 'bg-gray-100 dark:bg-slate-600 text-gray-400 cursor-wait'
                                      : 'bg-purple-500 text-white hover:bg-purple-600'
                                  }`}
                                >
                                  {isCreated ? (
                                    <>
                                      <Check className="w-4 h-4" />
                                      {t('graphEditor.graphMap.relationDiscovery.created')}
                                    </>
                                  ) : isCreating ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      {t('graphEditor.graphMap.relationDiscovery.creating')}
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4" />
                                      {t('graphEditor.graphMap.relationDiscovery.create')}
                                    </>
                                  )}
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'insights' && (
                  <div className="space-y-3">
                    {discoveryResult.cross_domain_insights.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {t('graphEditor.graphMap.relationDiscovery.noCrossDomainFound')}
                      </div>
                    ) : (
                      discoveryResult.cross_domain_insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Layers className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                              {insight.domains.join(' × ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {insight.description}
                          </p>
                          {insight.intersection_topics.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('graphEditor.graphMap.relationDiscovery.crossTopics')}</div>
                              <div className="flex flex-wrap gap-1">
                                {insight.intersection_topics.map((topic, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded"
                                  >
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {insight.related_graph_ids.map(graphId => (
                              <button
                                key={graphId}
                                onClick={() => onGraphClick(graphId)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {t('graphEditor.graphMap.relationDiscovery.viewGraph')}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'suggestions' && intelligentSuggestions && (
                  <div className="space-y-4">
                    {intelligentSuggestions.learning_path_suggestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-green-500" />
                          {t('graphEditor.graphMap.relationDiscovery.learningPathSuggestions')}
                        </h4>
                        <div className="space-y-2">
                          {intelligentSuggestions.learning_path_suggestions.map((path, idx) => (
                            <div key={idx} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {path.description}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>预计时间：{path.estimated_time}</span>
                                <span>•</span>
                                <span>难度：{
                                  path.difficulty === 'beginner' ? '入门' :
                                  path.difficulty === 'intermediate' ? '中级' : '高级'
                                }</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {intelligentSuggestions.knowledge_gaps.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          知识缺口
                        </h4>
                        <div className="space-y-2">
                          {intelligentSuggestions.knowledge_gaps.map((gap, idx) => (
                            <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                  {gap.missing_topic}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  gap.importance === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  gap.importance === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {gap.importance === 'high' ? '高优先' : gap.importance === 'medium' ? '中优先' : '低优先'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                建议：{
                                  gap.suggested_action === 'create' ? '创建新图谱' :
                                  gap.suggested_action === 'merge' ? '合并现有图谱' : '扩展现有图谱'
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {intelligentSuggestions.cross_domain_opportunities.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-purple-500" />
                          跨领域学习机会
                        </h4>
                        <div className="space-y-2">
                          {intelligentSuggestions.cross_domain_opportunities.map((opp, idx) => (
                            <div key={idx} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {opp.domains.join(' + ')}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {opp.potential_benefits}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {discoveryResult?.analysis_summary.isolated_graphs.length 
                ? `${discoveryResult.analysis_summary.isolated_graphs.length} 个图谱仍处于孤立状态` 
                : ''}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                关闭
              </button>
              {discoveryResult && (
                <button
                  onClick={() => onDiscover()}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  重新分析
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

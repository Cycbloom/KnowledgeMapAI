import React, { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Sparkles, GitBranch, Layers, Lightbulb, Loader2, 
  Check, Filter, ChevronDown, ChevronUp, Plus, AlertCircle
} from 'lucide-react';
import {
  GRAPH_RELATION_COLORS,
  GRAPH_RELATION_LABELS,
  type DiscoveryResult,
  type DiscoveredRelation,
  type GraphRelationType,
  type IntelligentSuggestion,
} from '@shared/types/graph';
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';

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

  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);
  const titleId = useId();

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
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              {t('graphMap.relationDiscovery.title')}
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
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.analyzing')}</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('graphMap.relationDiscovery.analyzingHint')}</p>
              </div>
            ) : !discoveryResult ? (
              <div className="flex flex-col items-center justify-center py-12">
                <GitBranch className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {t('graphMap.relationDiscovery.startPrompt')}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 text-center max-w-md">
                  {t('graphMap.relationDiscovery.startDesc')}
                </p>
                <button
                  onClick={() => onDiscover()}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('graphMap.relationDiscovery.startAnalysis')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {discoveryResult.analysis_summary.total_graphs_analyzed}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.graphsAnalyzed')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {discoveryResult.analysis_summary.relations_discovered}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.relationsFound')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {discoveryResult.analysis_summary.cross_domain_clusters}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.crossDomainClusters')}</div>
                  </div>
                </div>

                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('relations')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'relations'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {t('graphMap.relationDiscovery.discoveredRelations', { count: sortedRelations.length })}
                  </button>
                  <button
                    onClick={() => setActiveTab('insights')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'insights'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {t('graphMap.relationDiscovery.crossDomainInsights', { count: discoveryResult.cross_domain_insights.length })}
                  </button>
                  <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'suggestions'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
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
                              ? 'bg-primary-500 text-white'
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
                                ? 'bg-primary-500 text-white'
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
                                      className="text-primary-600 dark:text-primary-400 underline truncate max-w-[150px]"
                                    >
                                      {rel.source_graph_title}
                                    </button>
                                    <span className="text-gray-400">→</span>
                                    <button
                                      onClick={() => onGraphClick(rel.target_graph_id)}
                                      className="text-primary-600 dark:text-primary-400 underline truncate max-w-[150px]"
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
                                      : 'bg-primary-500 text-white hover:bg-primary-600'
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
                          className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Layers className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
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
                                    className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300 rounded"
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
                                className="text-xs text-primary-600 dark:text-primary-400 underline"
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
                                <span>{t('graphMap.relationDiscovery.estimatedTime')}{path.estimated_time}</span>
                                <span>•</span>
                                <span>{t('graphMap.relationDiscovery.difficulty')}{
                                  path.difficulty === 'beginner' ? t('graphMap.relationDiscovery.difficultyBeginner') :
                                  path.difficulty === 'intermediate' ? t('graphMap.relationDiscovery.difficultyIntermediate') :
                                  t('graphMap.relationDiscovery.difficultyAdvanced')
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
                          {t('graphMap.relationDiscovery.knowledgeGaps')}
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
                                  {gap.importance === 'high' ? t('graphMap.relationDiscovery.priorityHigh') : gap.importance === 'medium' ? t('graphMap.relationDiscovery.priorityMedium') : t('graphMap.relationDiscovery.priorityLow')}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t('graphMap.relationDiscovery.suggestion')}{
                                  gap.suggested_action === 'create' ? t('graphMap.relationDiscovery.suggestedActionCreate') :
                                  gap.suggested_action === 'merge' ? t('graphMap.relationDiscovery.suggestedActionMerge') :
                                  t('graphMap.relationDiscovery.suggestedActionExpand')
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
                          <Lightbulb className="w-4 h-4 text-primary-500" />
                          {t('graphMap.relationDiscovery.crossDomainOpportunities')}
                        </h4>
                        <div className="space-y-2">
                          {intelligentSuggestions.cross_domain_opportunities.map((opp, idx) => (
                            <div key={idx} className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
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
                ? t('graphMap.relationDiscovery.isolatedGraphs', { count: discoveryResult.analysis_summary.isolated_graphs.length })
                : ''}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('graphMap.relationDiscovery.close')}
              </button>
              {discoveryResult && (
                <button
                  onClick={() => onDiscover()}
                  disabled={isLoading}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('graphMap.relationDiscovery.reanalyze')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

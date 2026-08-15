import React, { useState, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Check,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import type {
  RelationAnalysisResult,
} from './types';
import {
  GRAPH_RELATION_COLORS,
  GRAPH_RELATION_LABELS,
  type DiscoveredRelation,
  type GraphRelationType,
} from '@shared/types/graph';

interface RelationsResultSectionProps {
  result: RelationAnalysisResult;
  onGraphClick?: (graphId: string) => void;
  onCreateRelation?: (sourceId: string, targetId: string, relationType: string) => Promise<void>;
}

type FilterType = 'all' | GraphRelationType;
type SortBy = 'confidence' | 'type';

export const RelationsResultSection: React.FC<RelationsResultSectionProps> = ({
  result,
  onGraphClick,
  onCreateRelation,
}) => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('confidence');
  const [showFilters, setShowFilters] = useState(false);
  const [creatingRelationKey, setCreatingRelationKey] = useState<string | null>(null);
  const [createdRelations, setCreatedRelations] = useState<Set<string>>(new Set());
  const filtersControlsId = useId();

  const getRelationKey = (rel: DiscoveredRelation) =>
    `${rel.source_graph_id}-${rel.target_graph_id}-${rel.relation_type}`;

  // useMemo 合并过滤+排序为单次计算，避免每次渲染重复扫描数组
  const sortedRelations = useMemo(() => {
    const filtered = result.discovered_relations.filter((rel) => {
      if (filterType === 'all') return true;
      return rel.relation_type === filterType;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'confidence') {
        return b.confidence - a.confidence;
      }
      return a.relation_type.localeCompare(b.relation_type);
    });
  }, [result.discovered_relations, filterType, sortBy]);

  const handleCreateRelation = async (rel: DiscoveredRelation) => {
    const key = getRelationKey(rel);
    if (!onCreateRelation) return;

    setCreatingRelationKey(key);
    try {
      await onCreateRelation(rel.source_graph_id, rel.target_graph_id, rel.relation_type);
      setCreatedRelations((prev) => new Set(prev).add(key));
    } finally {
      setCreatingRelationKey(null);
    }
  };

  const isRelationCreated = (rel: DiscoveredRelation) => {
    return createdRelations.has(getRelationKey(rel));
  };

  const isRelationCreating = (rel: DiscoveredRelation) => {
    return creatingRelationKey === getRelationKey(rel);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {result.analysis_summary.total_graphs_analyzed}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.graphsAnalyzed')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {result.analysis_summary.relations_discovered}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.relationsFound')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {result.analysis_summary.isolated_graphs.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.relationDiscovery.isolatedGraphsShort')}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-controls={filtersControlsId}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <Filter className="w-4 h-4" />
          {t('graphMap.relationDiscovery.filter')}
          {showFilters ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
        >
          <option value="confidence">{t('graphMap.relationDiscovery.sortByConfidence')}</option>
          <option value="type">{t('graphMap.relationDiscovery.sortByType')}</option>
        </select>
      </div>

      {showFilters && (
        <motion.div
          id={filtersControlsId}
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
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {t('graphMap.relationDiscovery.all')}
          </button>
          {(
            ['prerequisite', 'extension', 'related', 'cross_domain'] as GraphRelationType[]
          ).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${
                filterType === type
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: GRAPH_RELATION_COLORS[type] }}
              />
              {t(GRAPH_RELATION_LABELS[type])}
            </button>
          ))}
        </motion.div>
      )}

      {sortedRelations.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {t('graphMap.relationDiscovery.noRelationsFound')}
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
                transition={{ delay: idx * 0.03 }}
                className={`p-3 rounded-lg border transition-colors ${
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
                        {t(GRAPH_RELATION_LABELS[rel.relation_type])}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {t('graphMap.relationDiscovery.confidence', { value: (rel.confidence * 100).toFixed(0) })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      {onGraphClick ? (
                        <button
                          onClick={() => onGraphClick(rel.source_graph_id)}
                          className="text-primary-600 dark:text-primary-400 underline truncate max-w-[140px]"
                        >
                          {rel.source_graph_title}
                        </button>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[140px]">
                          {rel.source_graph_title}
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {onGraphClick ? (
                        <button
                          onClick={() => onGraphClick(rel.target_graph_id)}
                          className="text-primary-600 dark:text-primary-400 underline truncate max-w-[140px]"
                        >
                          {rel.target_graph_title}
                        </button>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[140px]">
                          {rel.target_graph_title}
                        </span>
                      )}
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
                        {rel.shared_concepts.length > 3 && (
                          <span className="px-1.5 py-0.5 text-xs text-gray-400 dark:text-gray-500">
                            +{rel.shared_concepts.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {onCreateRelation && (
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
                          {t('graphMap.relationDiscovery.created')}
                        </>
                      ) : isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('graphMap.relationDiscovery.creating')}
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          {t('graphMap.relationDiscovery.create')}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {result.analysis_summary.isolated_graphs.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <span className="font-medium">{t('graphMap.relationDiscovery.tip')}</span>
            {t('graphMap.relationDiscovery.isolatedTip', { count: result.analysis_summary.isolated_graphs.length })}
          </p>
        </div>
      )}
    </div>
  );
};

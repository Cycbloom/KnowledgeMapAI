import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queries/config';
import { graphsApi } from '../../services/api/graphs';
import { message } from '../../utils/messageHelper';
import type {
  DiscoveryResult, 
  IntelligentSuggestion, 
  DiscoveredRelation,
  GraphRelationType 
} from '@shared/types/graph';

interface UseGraphRelationDiscoveryOptions {
  autoFetch?: boolean;
  graphIds?: string[];
}

export function useGraphRelationDiscovery(options: UseGraphRelationDiscoveryOptions = {}) {
  const { t } = useTranslation();
  const { autoFetch = false, graphIds } = options;
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [intelligentSuggestions, setIntelligentSuggestions] = useState<IntelligentSuggestion | null>(null);
  const [createdRelationIds, setCreatedRelationIds] = useState<Set<string>>(new Set());

  const discoverMutation = useMutation({
    mutationFn: (opts?: { graph_ids?: string[]; max_suggestions?: number }) => 
      graphsApi.discoverRelations(opts),
    onSuccess: (data: DiscoveryResult) => {
      setDiscoveryResult(data);
      message.success(t('graphMap.relationDiscovery.discoveredRelationsToast', { count: data.analysis_summary.relations_discovered }));
    },
    onError: (error: Error) => {
      message.error(t('graphMap.relationDiscovery.discoveryFailed', { error: error.message }));
    },
  });

  const createRelationMutation = useMutation({
    mutationFn: (relation: DiscoveredRelation) => 
      graphsApi.createDiscoveredRelation({
        source_graph_id: relation.source_graph_id,
        target_graph_id: relation.target_graph_id,
        relation_type: relation.relation_type as GraphRelationType,
        context: relation.reason,
        confidence: relation.confidence,
        shared_concepts: relation.shared_concepts,
      }),
    onSuccess: (_, relation) => {
      const key = `${relation.source_graph_id}-${relation.target_graph_id}-${relation.relation_type}`;
      setCreatedRelationIds(prev => new Set(prev).add(key));
      message.success(t('graphMap.relationDiscovery.relationCreated', { source: relation.source_graph_title, target: relation.target_graph_title }));
    },
    onError: (error: Error) => {
      message.error(t('graphMap.relationDiscovery.createFailed', { error: error.message }));
    },
  });

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.intelligentSuggestions(graphIds ?? []),
    queryFn: () => graphsApi.getIntelligentSuggestions(graphIds),
    enabled: autoFetch && !!discoveryResult,
    staleTime: 5 * 60 * 1000,
  });

  const discover = useCallback(async (opts?: { graph_ids?: string[]; max_suggestions?: number }) => {
    setDiscoveryResult(null);
    setIntelligentSuggestions(null);
    setCreatedRelationIds(new Set());
    return discoverMutation.mutateAsync(opts);
  }, [discoverMutation]);

  const createRelation = useCallback(async (relation: DiscoveredRelation) => {
    return createRelationMutation.mutateAsync(relation);
  }, [createRelationMutation]);

  const fetchSuggestions = useCallback(async () => {
    const result = await graphsApi.getIntelligentSuggestions(graphIds);
    setIntelligentSuggestions(result);
    return result;
  }, [graphIds]);

  const getRelationKey = (rel: DiscoveredRelation) => 
    `${rel.source_graph_id}-${rel.target_graph_id}-${rel.relation_type}`;

  const isRelationCreated = useCallback((rel: DiscoveredRelation) => {
    return createdRelationIds.has(getRelationKey(rel));
  }, [createdRelationIds]);

  const isRelationCreating = useCallback((rel: DiscoveredRelation) => {
    return createRelationMutation.isPending && 
           createRelationMutation.variables?.source_graph_id === rel.source_graph_id &&
           createRelationMutation.variables?.target_graph_id === rel.target_graph_id;
  }, [createRelationMutation]);

  return {
    discoveryResult,
    intelligentSuggestions: intelligentSuggestions || suggestionsQuery.data || null,
    isLoading: discoverMutation.isPending,
    isCreating: createRelationMutation.isPending,
    discover,
    createRelation,
    fetchSuggestions,
    isRelationCreated,
    isRelationCreating,
    createdRelationIds,
  };
}
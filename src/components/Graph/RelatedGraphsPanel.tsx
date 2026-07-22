import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { motion } from 'framer-motion';
import {
  FolderOpen,
  ExternalLink,
  Trash2,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Network
} from 'lucide-react';
import { api } from '../../services/api';
import { message } from '../../utils/messageHelper';
import { useError } from "../../hooks";
import { EmptyState } from '../common/EmptyState';

interface GraphRelation {
  id: string;
  sourceGraphId: string;
  targetGraphId: string;
  relationType: 'prerequisite' | 'extension' | 'related';
  context: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  targetGraph?: {
    id: string;
    title: string;
    description: string | null;
    nodeCount?: number;
  };
}

interface RelatedGraphsPanelProps {
  graphId: string;
  onNavigateToGraph?: (graphId: string) => void;
}

export const RelatedGraphsPanel: React.FC<RelatedGraphsPanelProps> = ({
  graphId,
  onNavigateToGraph
}) => {
  const [relations, setRelations] = useState<{
    prerequisites: GraphRelation[];
    extensions: GraphRelation[];
    related: GraphRelation[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_showAddModal, _setShowAddModal] = useState(false);

  const { t } = useTranslation();
  const { handleError } = useError();

  const fetchRelations = async () => {
    setIsLoading(true);
    try {
      const result = await api.graphs.getRelations(graphId);
      setRelations(result as unknown as {
        prerequisites: GraphRelation[];
        extensions: GraphRelation[];
        related: GraphRelation[];
      });
    } catch (error) {
      handleError(error, { context: 'Relations', fallbackMessage: t('graphMap.graph.getRelationsFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (graphId) {
      fetchRelations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId]);

  const handleDeleteRelation = async (relationId: string) => {
    try {
      await api.graphs.deleteRelation(graphId, relationId);
      message.success(t('toast.graph.relationDeleted'));
      fetchRelations();
    } catch (error) {
      handleError(error, { context: 'DeleteRelation', fallbackMessage: t('graphMap.graph.deleteRelationFailed') });
    }
  };

  const handleNavigate = (targetGraphId: string) => {
    onNavigateToGraph?.(targetGraphId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasRelations = relations && (
    relations.prerequisites.length > 0 ||
    relations.extensions.length > 0 ||
    relations.related.length > 0
  );

  return (
    <div className="related-graphs-panel space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          {t('graphMap.graph.relatedGraphs')}
        </h3>
        <button
          onClick={fetchRelations}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {!hasRelations ? (
        <EmptyState
          icon={<Network size={32} />}
          title={t('graphMap.empty.relatedGraphs')}
        />
      ) : (
        <div className="space-y-4">
          {relations?.prerequisites && relations.prerequisites.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <ArrowRight className="w-3 h-3 rotate-180" />
                <span>{t('graphMap.graph.prerequisite')} ({relations.prerequisites.length})</span>
              </div>
              <div className="space-y-2">
                {relations.prerequisites.map((relation) => (
                  <motion.div
                    key={relation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {relation.targetGraph?.title || t('graphMap.graph.unknownGraph')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('graphMap.graph.nodeCount', { count: relation.targetGraph?.nodeCount || 0 })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleNavigate(relation.targetGraphId)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 rounded"
                        title={t('graphMap.graph.openGraph')}
                        aria-label={t('graphMap.graph.openGraph')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRelation(relation.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title={t('graphMap.graph.removeRelation')}
                        aria-label={t('graphMap.graph.removeRelation')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {relations?.extensions && relations.extensions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <ArrowRight className="w-3 h-3" />
                <span>{t('graphMap.graph.extension')} ({relations.extensions.length})</span>
              </div>
              <div className="space-y-2">
                {relations.extensions.map((relation) => (
                  <motion.div
                    key={relation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {relation.targetGraph?.title || t('graphMap.graph.unknownGraph')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('graphMap.graph.nodeCount', { count: relation.targetGraph?.nodeCount || 0 })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleNavigate(relation.targetGraphId)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 rounded"
                        title={t('graphMap.graph.openGraph')}
                        aria-label={t('graphMap.graph.openGraph')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRelation(relation.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title={t('graphMap.graph.removeRelation')}
                        aria-label={t('graphMap.graph.removeRelation')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {relations?.related && relations.related.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <BookOpen className="w-3 h-3" />
                <span>{t('graphMap.graph.related')} ({relations.related.length})</span>
              </div>
              <div className="space-y-2">
                {relations.related.map((relation) => (
                  <motion.div
                    key={relation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {relation.targetGraph?.title || t('graphMap.graph.unknownGraph')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('graphMap.graph.nodeCount', { count: relation.targetGraph?.nodeCount || 0 })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleNavigate(relation.targetGraphId)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 rounded"
                        title={t('graphMap.graph.openGraph')}
                        aria-label={t('graphMap.graph.openGraph')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRelation(relation.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title={t('graphMap.graph.removeRelation')}
                        aria-label={t('graphMap.graph.removeRelation')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RelatedGraphsPanel;

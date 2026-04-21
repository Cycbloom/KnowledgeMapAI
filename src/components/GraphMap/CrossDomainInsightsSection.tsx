import React from 'react';
import { motion } from 'framer-motion';
import { Layers, ExternalLink, Globe, BookOpen } from 'lucide-react';
import type { CrossDomainAnalysisResult } from './types';
import type { CrossDomainInsight } from '@shared/types/graph';

interface CrossDomainInsightsSectionProps {
  result: CrossDomainAnalysisResult;
  onGraphClick?: (graphId: string) => void;
}

export const CrossDomainInsightsSection: React.FC<CrossDomainInsightsSectionProps> = ({
  result,
  onGraphClick,
}) => {
  const renderInsightCard = (insight: CrossDomainInsight, idx: number) => (
    <motion.div
      key={idx}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800"
    >
      <div className="flex items-center gap-2 mb-3">
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
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
            <BookOpen className="w-3 h-3" />
            交叉主题
          </div>
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

      {insight.related_graph_ids.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Globe className="w-3 h-3" />
            相关图谱
          </div>
          <div className="flex flex-wrap gap-2">
            {insight.related_graph_ids.slice(0, 5).map((graphId) => (
              <button
                key={graphId}
                onClick={() => onGraphClick?.(graphId)}
                disabled={!onGraphClick}
                className={`text-xs flex items-center gap-1 ${
                  onGraphClick
                    ? 'text-primary-600 dark:text-primary-400 hover:underline'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <ExternalLink className="w-3 h-3" />
                查看图谱
              </button>
            ))}
            {insight.related_graph_ids.length > 5 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                +{insight.related_graph_ids.length - 5} 更多
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {result.analysis_summary.total_domains}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">涉及领域</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {result.analysis_summary.cross_domain_clusters}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">交叉集群</div>
        </div>
      </div>

      {Object.keys(result.domain_distribution).length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">领域分布</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(result.domain_distribution).map(([domain, count]) => (
              <div
                key={domain}
                className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-600 rounded text-xs"
              >
                <span className="text-gray-700 dark:text-gray-300">{domain}</span>
                <span className="text-gray-400 dark:text-gray-500">({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.cross_domain_insights.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
          没有发现跨学科交叉点
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            发现 {result.cross_domain_insights.length} 个跨学科交叉点
          </div>
          {result.cross_domain_insights.map((insight, idx) => renderInsightCard(insight, idx))}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { KnowledgePoint } from '../../types';
import { request } from '../../services/api/client';

interface RelatedResourcesSectionProps {
  knowledgePointId: string;
  onKnowledgePointClick?: (id: string) => void;
}

export const RelatedResourcesSection: React.FC<RelatedResourcesSectionProps> = ({
  knowledgePointId,
  onKnowledgePointClick,
}) => {
  const [knowledgePoint, setKnowledgePoint] = useState<KnowledgePoint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKnowledgePoint = async () => {
      try {
        const response = await request(`/knowledge-points/${knowledgePointId}`);
        if (response.success) {
          setKnowledgePoint(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch knowledge point:', error);
      } finally {
        setLoading(false);
      }
    };

    if (knowledgePointId) {
      fetchKnowledgePoint();
    }
  }, [knowledgePointId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">关联资源</h3>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-20 rounded-lg" />
      </div>
    );
  }

  if (!knowledgePoint) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">关联资源</h3>
      
      <div
        className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
        onClick={() => onKnowledgePointClick?.(knowledgePointId)}
      >
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {knowledgePoint.title}
            </h4>
            {knowledgePoint.content && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {knowledgePoint.content}
              </p>
            )}
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

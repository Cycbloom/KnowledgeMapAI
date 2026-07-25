import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

interface BlindSpot {
  id: string;
  question: string;
  fsrs_stability: number;
  fsrs_retrievability: number;
  graph_id: string;
  knowledge_points?: {
    title: string;
  } | null;
}

interface BlindSpotListProps {
  data: BlindSpot[];
}

export const BlindSpotList: React.FC<BlindSpotListProps> = ({ data }) => {
  const { t } = useTranslation();
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 h-full">
        <div className="flex items-center mb-4 text-red-600">
          <AlertTriangle size={20} className="mr-2" />
          <h3 className="text-lg font-semibold">{t('study.blindSpot.title')}</h3>
        </div>
        <EmptyState
          variant="inline"
          title={t('study.blindSpot.empty.title')}
          description={t('study.blindSpot.empty.description')}
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 h-full">
      <div className="flex items-center mb-4 text-red-600">
        <AlertTriangle size={20} className="mr-2" />
        <h3 className="text-lg font-semibold">{t('study.blindSpot.title')}</h3>
      </div>
      <div className="space-y-3">
        {data.map((card) => (
          <div key={card.id} className="p-3 bg-red-50 rounded-md border border-red-100 flex justify-between items-center hover:bg-red-100 transition-colors">
            <div className="flex-1 min-w-0 mr-4">
              <div className="text-sm font-medium text-gray-900 truncate" title={card.question}>
                {card.question}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('study.blindSpot.nodeInfo', { node: card.knowledge_points?.title || 'Unknown', stability: card.fsrs_stability.toFixed(2) })}
              </div>
            </div>
            <Link
              to={`/study?graph_id=${card.graph_id}`}
              className="text-xs bg-white text-red-600 px-3 py-1 rounded border border-red-200 hover:bg-red-50 whitespace-nowrap"
            >
              {t('study.blindSpot.review')}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

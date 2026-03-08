import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

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
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 h-full">
      <div className="flex items-center mb-4 text-red-600">
        <AlertTriangle size={20} className="mr-2" />
        <h3 className="text-lg font-semibold">知识盲区 (Top 10)</h3>
      </div>
      <div className="space-y-3">
        {data.map((card) => (
          <div key={card.id} className="p-3 bg-red-50 rounded-md border border-red-100 flex justify-between items-center hover:bg-red-100 transition-colors">
            <div className="flex-1 min-w-0 mr-4">
              <div className="text-sm font-medium text-gray-900 truncate" title={card.question}>
                {card.question}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                所属节点: {card.knowledge_points?.title || 'Unknown'} | 稳定性: {card.fsrs_stability.toFixed(2)}
              </div>
            </div>
            <Link 
              to={`/study?graph_id=${card.graph_id}`}
              className="text-xs bg-white text-red-600 px-3 py-1 rounded border border-red-200 hover:bg-red-50 whitespace-nowrap"
            >
              去复习
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

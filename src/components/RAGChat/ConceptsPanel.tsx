import React from 'react';
import { Lightbulb, Plus, X } from 'lucide-react';
import { ExtractedConcept } from '../../types';

interface ConceptsPanelProps {
  concepts: ExtractedConcept[];
  isDark: boolean;
  onAddConcept: (concept: ExtractedConcept) => void;
  onAddAll?: () => void;
  onClose: () => void;
}

export const ConceptsPanel: React.FC<ConceptsPanelProps> = ({
  concepts,
  isDark,
  onAddConcept,
  onAddAll,
  onClose
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return isDark ? 'bg-red-900/30 text-red-300 border-red-800' : 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-800' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return isDark ? 'bg-green-900/30 text-green-300 border-green-800' : 'bg-green-100 text-green-700 border-green-200';
      default: return isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={`border-t p-4 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold flex items-center ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
          <Lightbulb size={16} className="mr-2 text-yellow-500" />
          提取的概念
        </h3>
        <button
          onClick={onClose}
          className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {concepts.map((concept, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${getPriorityColor(concept.priority)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-sm">{concept.title}</h4>
                <p className="text-xs mt-1 opacity-80">{concept.description}</p>
              </div>
              <button
                onClick={() => onAddConcept(concept)}
                className="ml-2 p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                title="添加到图谱"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {onAddAll && (
        <button
          onClick={onAddAll}
          className="w-full mt-3 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          全部添加到图谱
        </button>
      )}
    </div>
  );
};

export default ConceptsPanel;

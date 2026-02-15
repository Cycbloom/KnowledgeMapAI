import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface SuggestedTopic {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedDifficulty: number;
}

interface SuggestionsPanelProps {
  topics: SuggestedTopic[];
  isDark: boolean;
  onClose: () => void;
}

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  topics,
  isDark,
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
          <Sparkles size={16} className="mr-2 text-purple-500" />
          学习建议
        </h3>
        <button
          onClick={onClose}
          className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {topics.map((topic, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${getPriorityColor(topic.priority)}`}
          >
            <h4 className="font-medium text-sm">{topic.title}</h4>
            <p className="text-xs mt-1 opacity-80">{topic.description}</p>
            <div className="flex items-center mt-2 gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-slate-700' : 'bg-white/50'}`}>
                难度: {topic.estimatedDifficulty}/5
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestionsPanel;

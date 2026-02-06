import React, { useState } from 'react';
import { BranchSuggestion, Node } from '../../types';
import { Sparkles, TrendingUp, Clock } from 'lucide-react';

interface BranchPreviewProps {
  parentNode: Node;
  suggestions: BranchSuggestion[];
  onSelectBranch: (suggestion: BranchSuggestion) => void;
  onClose: () => void;
  isDark: boolean;
}

export const BranchPreview: React.FC<BranchPreviewProps> = ({
  parentNode,
  suggestions,
  onSelectBranch,
  onClose,
  isDark
}) => {
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return isDark ? 'bg-red-900/50 border-red-500' : 'bg-red-50 border-red-500';
      case 'medium': return isDark ? 'bg-yellow-900/50 border-yellow-500' : 'bg-yellow-50 border-yellow-500';
      case 'low': return isDark ? 'bg-blue-900/50 border-blue-500' : 'bg-blue-50 border-blue-500';
      default: return isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-400';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <TrendingUp size={14} className="text-red-500" />;
      case 'medium': return <Clock size={14} className="text-yellow-500" />;
      case 'low': return <Sparkles size={14} className="text-blue-500" />;
      default: return null;
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-500';
    if (difficulty <= 3) return 'text-yellow-500';
    if (difficulty <= 4) return 'text-orange-500';
    return 'text-red-500';
  };

  const calculatePosition = (index: number, total: number) => {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const radius = 120;
    return {
      x: parentNode.x_position + Math.cos(angle) * radius,
      y: parentNode.y_position + Math.sin(angle) * radius
    };
  };

  return (
    <>
      {suggestions.map((suggestion, index) => {
        const pos = calculatePosition(index, suggestions.length);
        const isHovered = hoveredBranch === suggestion.id;

        return (
          <g key={suggestion.id}>
            <line
              x1={parentNode.x_position}
              y1={parentNode.y_position}
              x2={pos.x}
              y2={pos.y}
              stroke={isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.4)'}
              strokeWidth={2}
              strokeDasharray="5,5"
              opacity={isHovered ? 0.8 : 0.4}
              style={{ transition: 'opacity 0.2s ease' }}
            />

            <foreignObject
              x={pos.x - 80}
              y={pos.y - 40}
              width={160}
              height={80}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredBranch(suggestion.id)}
              onMouseLeave={() => setHoveredBranch(null)}
              onClick={() => onSelectBranch(suggestion)}
            >
              <div
                className={`
                  w-full h-full rounded-lg border-2 p-3 transition-all duration-200
                  ${getPriorityColor(suggestion.priority)}
                  ${isHovered ? 'scale-105 shadow-lg' : 'scale-100 shadow-md'}
                `}
                style={{
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  {getPriorityIcon(suggestion.priority)}
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                    {suggestion.title}
                  </h3>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {suggestion.description}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 dark:text-gray-500">难度:</span>
                    <span className={`text-xs font-semibold ${getDifficultyColor(suggestion.estimatedDifficulty)}`}>
                      {'★'.repeat(suggestion.estimatedDifficulty)}
                    </span>
                  </div>

                  {suggestion.relatedTopics.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Sparkles size={10} className="text-purple-500" />
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        {suggestion.relatedTopics.length}
                      </span>
                    </div>
                  )}
                </div>

                {isHovered && suggestion.relatedTopics.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {suggestion.relatedTopics.map((topic, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}

      <foreignObject
        x={parentNode.x_position - 20}
        y={parentNode.y_position - 20}
        width={40}
        height={40}
        style={{ cursor: 'pointer' }}
        onClick={onClose}
      >
        <div className="w-full h-full flex items-center justify-center">
          <button
            className={`
              w-8 h-8 rounded-full flex items-center justify-center
              transition-all duration-200
              ${isDark 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' 
                : 'bg-white hover:bg-gray-100 text-gray-600'
              }
              shadow-lg border border-gray-300 dark:border-gray-600
            `}
            title="关闭分支预览"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </foreignObject>
    </>
  );
};
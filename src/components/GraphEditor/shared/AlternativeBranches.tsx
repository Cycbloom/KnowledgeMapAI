import React from 'react';
import { BranchSuggestion, Node, LayoutNode } from '../../../types';
import { Sparkles } from 'lucide-react';

interface AlternativeBranchesProps {
  parentNode: Node;
  branches: BranchSuggestion[];
  selectedBranchId?: string;
  isDark: boolean;
  onSelectBranch?: (suggestion: BranchSuggestion) => void;
  pathItem?: { nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string };
  onSwitchBranch?: (pathItem: { nodeId: string; branches: BranchSuggestion[]; selectedBranchId: string }, suggestion: BranchSuggestion) => void;
}

export const AlternativeBranches: React.FC<AlternativeBranchesProps> = ({
  parentNode,
  branches,
  selectedBranchId,
  isDark,
  onSelectBranch,
  pathItem,
  onSwitchBranch
}) => {
  const handleBranchClick = (branch: BranchSuggestion) => {
    if (onSwitchBranch && pathItem) {
      onSwitchBranch(pathItem, branch);
    } else if (onSelectBranch) {
      onSelectBranch(branch);
    }
  };

  const getPriorityColor = (priority: string, isSelected: boolean) => {
    if (isSelected) {
      switch (priority) {
        case 'high': return isDark ? 'bg-red-900/50 border-red-500' : 'bg-red-50 border-red-500';
        case 'medium': return isDark ? 'bg-yellow-900/50 border-yellow-500' : 'bg-yellow-50 border-yellow-500';
        case 'low': return isDark ? 'bg-primary-900/50 border-primary-500' : 'bg-primary-50 border-primary-500';
        default: return isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-400';
      }
    }
    switch (priority) {
      case 'high': return isDark ? 'bg-red-900/70 border-red-500' : 'bg-red-50/90 border-red-500';
      case 'medium': return isDark ? 'bg-yellow-900/70 border-yellow-500' : 'bg-yellow-50/90 border-yellow-500';
      case 'low': return isDark ? 'bg-primary-900/70 border-primary-500' : 'bg-primary-50/90 border-primary-500';
      default: return isDark ? 'bg-gray-800/70 border-gray-600' : 'bg-gray-100/90 border-gray-400';
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-500/70';
    if (difficulty <= 3) return 'text-yellow-500/70';
    if (difficulty <= 4) return 'text-orange-500/70';
    return 'text-red-500/70';
  };

  const nodeX: number = 'x' in parentNode ? (parentNode as LayoutNode).x : parentNode.x_position;
  const nodeY: number = 'y' in parentNode ? (parentNode as LayoutNode).y : parentNode.y_position;

  const calculatePosition = (index: number, total: number) => {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const radius = 120;
    return {
      x: nodeX + Math.cos(angle) * radius,
      y: nodeY + Math.sin(angle) * radius
    };
  };

  if (branches.length === 0) return null;

  return (
    <>
      {branches.map((branch, index) => {
        const pos = calculatePosition(index, branches.length);
        const isSelected = branch.id === selectedBranchId;

        return (
          <g key={branch.id}>
            <line
              x1={nodeX}
              y1={nodeY}
              x2={pos.x}
              y2={pos.y}
              stroke={isSelected 
                ? (isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.8)') 
                : (isDark ? 'rgba(156, 163, 175, 0.6)' : 'rgba(107, 114, 128, 0.6)')}
              strokeWidth={isSelected ? 2.5 : 2}
              strokeDasharray={isSelected ? '0' : '6,4'}
              opacity={isSelected ? 1 : 0.7}
            />

            {isSelected && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={8}
                fill={isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)'}
                stroke={isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.8)'}
                strokeWidth={2}
              />
            )}

            {!isSelected && (
              <rect
                x={pos.x - 6}
                y={pos.y - 6}
                width={12}
                height={12}
                fill={isDark ? 'rgba(156, 163, 175, 0.7)' : 'rgba(107, 114, 128, 0.7)'}
                stroke={isDark ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'}
                strokeWidth={2}
                rx={2}
              />
            )}

            <foreignObject
              x={pos.x - 60}
              y={pos.y - 30}
              width={120}
              height={60}
              style={{ cursor: (onSelectBranch || onSwitchBranch) ? 'pointer' : 'default' }}
              onClick={() => handleBranchClick(branch)}
            >
              <div
                className={`
                  w-full h-full rounded border-2 p-2 transition-all duration-200
                  ${getPriorityColor(branch.priority, isSelected)}
                  ${isSelected ? 'opacity-100 shadow-lg' : 'opacity-90'}
                `}
                style={{
                  backgroundColor: isDark 
                    ? (isSelected ? 'rgba(30, 41, 59, 0.95)' : 'rgba(30, 41, 59, 0.85)') 
                    : (isSelected ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.9)'),
                  backdropFilter: 'blur(4px)'
                }}
              >
                <div className="flex items-start gap-1.5 mb-1">
                  <h3 className={`text-xs font-bold line-clamp-1 ${isSelected 
                    ? 'text-gray-900 dark:text-gray-100' 
                    : 'text-gray-800 dark:text-gray-200'}`}>
                    {branch.title}
                  </h3>
                </div>

                <p className={`text-[10px] line-clamp-2 mb-1 ${isSelected 
                  ? 'text-gray-700 dark:text-gray-300' 
                  : 'text-gray-600 dark:text-gray-400'}`}>
                  {branch.description}
                </p>

                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <span className={`text-[10px] ${isSelected 
                      ? 'text-gray-600 dark:text-gray-400' 
                      : 'text-gray-700 dark:text-gray-500'}`}>难度:</span>
                    <span className={`text-[10px] font-semibold ${getDifficultyColor(branch.estimatedDifficulty)}`}>
                      {'★'.repeat(branch.estimatedDifficulty)}
                    </span>
                  </div>

                  {branch.relatedTopics.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Sparkles size={8} className={isSelected ? 'text-primary-500' : 'text-primary-500/80'} />
                      <span className={`text-[10px] ${isSelected 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : 'text-primary-700 dark:text-primary-500'}`}>
                        {branch.relatedTopics.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </>
  );
};

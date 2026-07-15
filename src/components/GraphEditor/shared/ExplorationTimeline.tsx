import React, { useState } from 'react';
import { ExplorationPathItem, BranchSuggestion } from '../../../types';
import { formatDate } from '../../../utils/formatters';
import { Clock, ArrowRight, ChevronRight, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';

interface ExplorationTimelineProps {
  explorationPath: ExplorationPathItem[];
  currentPathIndex: number;
  onGoToIndex: (index: number) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isDark: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sidebarMode?: 'none' | 'edit' | 'outline' | 'create' | 'detail';
  onSwitchBranch?: (pathItem: ExplorationPathItem, suggestion: BranchSuggestion) => void;
}

export const ExplorationTimeline: React.FC<ExplorationTimelineProps> = ({
  explorationPath,
  currentPathIndex,
  onGoToIndex,
  onGoBack,
  onGoForward,
  canGoBack,
  canGoForward,
  isDark,
  isCollapsed,
  onToggleCollapse,
  sidebarMode = 'none',
  onSwitchBranch
}) => {
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set());

  const toggleBranchExpansion = (index: number) => {
    setExpandedBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };
  const formatTime = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '未知时间';
    
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return formatDate(dateObj, 'short');
  };

  const getCurrentItem = () => {
    if (currentPathIndex >= 0 && currentPathIndex < explorationPath.length) {
      return explorationPath[currentPathIndex];
    }
    return null;
  };

  const currentItem = getCurrentItem();

  return (
    <div className={`
      absolute top-20 bottom-4 w-80 rounded-xl shadow-2xl border
      ${isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-gray-200'}
      backdrop-blur-md transition-all duration-300
      ${sidebarMode === 'none' ? 'right-4' : 'right-[324px]'}
      ${isCollapsed ? 'h-12 overflow-hidden' : 'h-[calc(100%-2rem)] overflow-y-auto'}
    `}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock size={16} />
            探索路径
          </h3>
          <button
            onClick={onToggleCollapse}
            className={`
              p-1 rounded-lg transition-all
              ${isDark ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
            `}
          >
            {isCollapsed ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {explorationPath.length} 个节点
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  className={`
                    p-1.5 rounded-lg transition-all flex items-center gap-1
                    ${canGoBack
                      ? isDark ? 'hover:bg-slate-700 text-primary-400' : 'hover:bg-gray-100 text-primary-600'
                      : 'opacity-30 cursor-not-allowed text-gray-400'
                    }
                  `}
                >
                  <ChevronRight size={14} className="rotate-180" />
                  <span className="text-xs">上一步</span>
                </button>
                <button
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  className={`
                    p-1.5 rounded-lg transition-all flex items-center gap-1
                    ${canGoForward
                      ? isDark ? 'hover:bg-slate-700 text-green-400' : 'hover:bg-gray-100 text-green-600'
                      : 'opacity-30 cursor-not-allowed text-gray-400'
                    }
                  `}
                >
                  <span className="text-xs">下一步</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {currentItem && (
              <div className={`
                mb-4 p-3 rounded-lg border-l-4
                ${isDark 
                  ? 'bg-slate-800/50 border-primary-500' 
                  : 'bg-primary-50 border-primary-500'
                }
              `}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {currentItem.nodeTitle}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(currentItem.timestamp)}
                  </span>
                </div>
                {currentItem.branchChoice && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    分支选择：{currentItem.branchChoice}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                历史记录
              </div>
              {explorationPath.map((item, index) => {
                const isExpanded = expandedBranches.has(index);
                const hasAlternatives = item.alternativeBranches && item.alternativeBranches.length > 0;
                
                return (
                  <div key={item.nodeId}>
                    <button
                      onClick={() => onGoToIndex(index)}
                      className={`
                        w-full text-left p-2.5 rounded-lg transition-all flex items-center gap-2
                        ${index === currentPathIndex
                          ? isDark 
                            ? 'bg-primary-900/30 border-primary-500 text-primary-400' 
                            : 'bg-primary-50 border-primary-500 text-primary-700'
                          : isDark
                            ? 'hover:bg-slate-800 border-transparent text-gray-300'
                            : 'hover:bg-gray-50 border-transparent text-gray-700'
                        }
                        border
                      `}
                    >
                      <div className="flex-shrink-0">
                        {index === currentPathIndex ? (
                          <div className="w-2 h-2 rounded-full bg-primary-500" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="text-sm font-medium truncate">
                          {item.nodeTitle}
                        </div>
                        {item.branchChoice && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            分支：{item.branchChoice}
                          </div>
                        )}
                      </div>
                      {hasAlternatives && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBranchExpansion(index);
                          }}
                          className={`flex-shrink-0 p-1 rounded transition-all ${
                            isDark ? 'hover:bg-slate-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                          }`}
                        >
                          <GitBranch size={14} className={isExpanded ? 'text-primary-500' : ''} />
                        </button>
                      )}
                      <ArrowRight size={14} className="flex-shrink-0 text-gray-400" />
                    </button>
                    
                    {isExpanded && hasAlternatives && (
                      <div className="ml-6 mt-1 space-y-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            备选分支：
                          </div>
                        </div>
                        {item.alternativeBranches?.map((branch, _branchIndex) => {
                          const isSelected = branch.id === item.branchSuggestionId;
                          return (
                            <button
                              key={branch.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isSelected && onSwitchBranch) {
                                  onSwitchBranch(item, branch);
                                }
                              }}
                              disabled={isSelected}
                              className={`
                                w-full text-left p-2 rounded transition-all text-xs
                                ${isSelected
                                  ? isDark
                                    ? 'bg-green-900/30 border-green-500 text-green-400'
                                    : 'bg-green-50 border-green-500 text-green-700'
                                  : isDark
                                    ? 'hover:bg-slate-800 border-transparent text-gray-400'
                                    : 'hover:bg-gray-100 border-transparent text-gray-600'
                                }
                                border
                                ${isSelected ? 'cursor-default' : 'cursor-pointer'}
                              `}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className="truncate flex-1">{branch.title}</span>
                                {isSelected && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500 text-white">
                                    已选择
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
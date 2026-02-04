import React, { useRef, useEffect } from 'react';
import { Node } from '../../types';
import { Check, Lock, ChevronDown } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface LearningPathMapProps {
  nodes: Node[];
  activeNodeId: string | null;
  onNodeClick: (id: string) => void;
  nodeStatus?: Record<string, { locked: boolean; mastered: boolean }>;
}

export const LearningPathMap: React.FC<LearningPathMapProps> = ({ nodes, activeNodeId, onNodeClick, nodeStatus }) => {
  const { isDark } = useTheme();
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeNodeId]);

  return (
    <div className={`h-full overflow-y-auto custom-scrollbar p-6 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="relative">
        {/* Vertical Line */}
        <div className={`absolute left-4 top-4 bottom-4 w-0.5 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}></div>

        <div className="space-y-8 relative">
          {nodes.map((node, index) => {
            const isActive = node.id === activeNodeId;
            const status = nodeStatus?.[node.id];
            const isCompleted = status?.mastered || false;
            const isLocked = status?.locked || false;

            return (
              <div 
                key={node.id} 
                ref={isActive ? activeRef : null}
                className={`relative pl-12 transition-all duration-300 group ${isActive ? 'scale-105 origin-left' : ''} ${isLocked ? 'opacity-70 grayscale' : ''}`}
              >
                {/* Connector Dot */}
                <div 
                  onClick={() => !isLocked && onNodeClick(node.id)}
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 transition-colors ${
                    isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-100 shadow-lg shadow-indigo-500/30 scale-110' 
                      : (isCompleted 
                          ? 'bg-green-500 border-green-100' 
                          : (isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'))
                  }`}
                >
                  {isCompleted ? (
                    <Check size={14} className="text-white" />
                  ) : isLocked ? (
                    <Lock size={12} className="text-gray-400" />
                  ) : (
                    <span className={`text-xs font-bold ${isActive ? 'text-white' : (isDark ? 'text-slate-400' : 'text-gray-500')}`}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Card */}
                <div 
                  onClick={() => !isLocked && onNodeClick(node.id)}
                  className={`p-4 rounded-xl border transition-all ${
                    isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isActive 
                      ? (isDark 
                          ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500 shadow-xl' 
                          : 'bg-white border-indigo-500 ring-1 ring-indigo-500 shadow-lg shadow-indigo-100')
                      : (isDark
                          ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                          : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md')
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className={`font-bold text-sm mb-1 line-clamp-2 ${
                      isActive 
                        ? (isDark ? 'text-indigo-400' : 'text-indigo-700')
                        : (isDark ? 'text-slate-200' : 'text-gray-800')
                    }`}>
                      {node.title}
                    </h3>
                  </div>
                  <p className={`text-xs line-clamp-2 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {node.content || '无描述'}
                  </p>
                  
                  {/* Level Tag */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      node.level === 'root' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      node.level === 'core' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      node.level === 'sub' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {node.level?.toUpperCase() || 'TOPIC'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

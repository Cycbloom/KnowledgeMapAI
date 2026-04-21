import React from 'react';
import { Network, Clock, GitBranch, Globe } from 'lucide-react';
import { GraphViewMode } from '../../../types';
import { useTheme } from "../../../hooks";

interface ViewModeSelectorProps {
  currentMode: GraphViewMode;
  onModeChange: (mode: GraphViewMode) => void;
}

const viewModes: Array<{ mode: GraphViewMode; label: string; icon: React.ComponentType<any>; description: string }> = [
  {
    mode: 'mindmap',
    label: '思维导图',
    icon: Network,
    description: '力导向图布局，适合探索知识关系'
  },
  {
    mode: 'timeline',
    label: '时间线',
    icon: Clock,
    description: '按时间顺序排列，展示知识演进'
  },
  {
    mode: 'tree',
    label: '树形视图',
    icon: GitBranch,
    description: '严格的树形结构，适合查看知识树'
  },
  {
    mode: 'planet',
    label: '知识星球',
    icon: Globe,
    description: '3D 星球视图，沉浸式探索知识宇宙'
  }
];

export const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  currentMode,
  onModeChange
}) => {
  const { isDark } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {viewModes.map(({ mode, label, icon: Icon, description }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentMode === mode
              ? isDark
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-primary-500 text-white shadow-md'
              : isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title={description}
        >
          <Icon size={16} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};




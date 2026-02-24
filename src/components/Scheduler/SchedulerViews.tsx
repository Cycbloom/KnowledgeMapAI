import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Calendar, Columns, List } from 'lucide-react';

interface SchedulerViewsProps {
  currentView: 'queue' | 'timeline' | 'kanban' | 'list';
  onViewChange: (view: string) => void;
}

const VIEW_CONFIG = {
  queue: {
    icon: LayoutGrid,
    label: '队列',
    description: '三层队列视图',
  },
  timeline: {
    icon: Calendar,
    label: '时间轴',
    description: '按时间排列',
  },
  kanban: {
    icon: Columns,
    label: '看板',
    description: '状态看板',
  },
  list: {
    icon: List,
    label: '列表',
    description: '详细列表',
  },
};

export const SchedulerViews: React.FC<SchedulerViewsProps> = ({
  currentView,
  onViewChange,
}) => {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50">
      {(Object.keys(VIEW_CONFIG) as Array<keyof typeof VIEW_CONFIG>).map((viewKey) => {
        const config = VIEW_CONFIG[viewKey];
        const IconComponent = config.icon;
        const isActive = currentView === viewKey;

        return (
          <motion.button
            key={viewKey}
            onClick={() => onViewChange(viewKey)}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-lg
              transition-all duration-300
              ${isActive 
                ? 'text-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isActive && (
              <motion.div
                layoutId="activeViewIndicator"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <IconComponent size={18} className="relative z-10" />
            <span className="relative z-10 text-sm font-medium">{config.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

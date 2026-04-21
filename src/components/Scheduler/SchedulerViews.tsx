import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LayoutGrid, Calendar, Columns, List } from 'lucide-react';

interface SchedulerViewsProps {
  currentView: 'queue' | 'timeline' | 'kanban' | 'list';
  onViewChange: (view: string) => void;
}

export const SchedulerViews: React.FC<SchedulerViewsProps> = ({
  currentView,
  onViewChange,
}) => {
  const { t } = useTranslation();
  
  const VIEW_CONFIG = {
    queue: {
      icon: LayoutGrid,
      label: t('scheduler.queue.queue'),
      description: t('scheduler.queue.queueDesc'),
    },
    timeline: {
      icon: Calendar,
      label: t('scheduler.queue.timeline'),
      description: t('scheduler.queue.timelineDesc'),
    },
    kanban: {
      icon: Columns,
      label: t('scheduler.queue.kanban'),
      description: t('scheduler.queue.kanbanDesc'),
    },
    list: {
      icon: List,
      label: t('scheduler.queue.list'),
      description: t('scheduler.queue.listDesc'),
    },
  };
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50">
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
                ? 'text-slate-800 dark:text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50'
              }
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isActive && (
              <motion.div
                layoutId="activeViewIndicator"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-500/20 dark:to-primary-500/20 border border-primary-300 dark:border-primary-500/30"
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

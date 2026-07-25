import React from 'react';
import { motion } from 'framer-motion';
import { TEMPLATE_CATEGORIES, getCategoryBgClass, getCategoryTextClass } from '../../services/api/taskTemplates';

interface TemplateCategoryProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
}

export const TemplateCategory: React.FC<TemplateCategoryProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          !selectedCategory
            ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 ring-1 ring-primary-300 dark:ring-primary-500/50'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
        }`}
      >
        全部
      </motion.button>
      
      {TEMPLATE_CATEGORIES.map(category => {
        const count = categoryCounts[category.value] || 0;
        const isSelected = selectedCategory === category.value;
        
        return (
          <motion.button
            key={category.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory(category.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              isSelected
                ? `${getCategoryBgClass(category.value)} ${getCategoryTextClass(category.value)} ring-1 ring-current`
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <span>{category.icon}</span>
            <span>{category.label}</span>
            {count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                isSelected
                  ? 'bg-white/30 dark:bg-black/20'
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}>
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

interface TemplateCategoryCardProps {
  category: string;
  label: string;
  icon: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

export const TemplateCategoryCard: React.FC<TemplateCategoryCardProps> = ({
  category,
  label,
  icon,
  count,
  isSelected,
  onClick,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all w-full ${
        isSelected
          ? `border-current ${getCategoryBgClass(category)} ${getCategoryTextClass(category)}`
          : 'border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {isSelected && (
          <span className="w-2 h-2 rounded-full bg-current" />
        )}
      </div>
      <h3 className={`font-medium mb-1 ${
        isSelected ? '' : 'text-slate-900 dark:text-white'
      }`}>
        {label}
      </h3>
      <p className={`text-sm ${
        isSelected ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
      }`}>
        {count} 个模板
      </p>
    </motion.button>
  );
};

interface TemplateCategoryGridProps {
  categories: Array<{
    value: string;
    label: string;
    icon: string;
    count: number;
  }>;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export const TemplateCategoryGrid: React.FC<TemplateCategoryGridProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      <motion.button
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectCategory(null)}
        className={`p-4 rounded-xl border text-left transition-all ${
          !selectedCategory
            ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
            : 'border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">📋</span>
          {!selectedCategory && (
            <span className="w-2 h-2 rounded-full bg-primary-500" />
          )}
        </div>
        <h3 className={`font-medium mb-1 ${
          !selectedCategory ? '' : 'text-slate-900 dark:text-white'
        }`}>
          全部
        </h3>
        <p className={`text-sm ${
          !selectedCategory ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
        }`}>
          {categories.reduce((sum, c) => sum + c.count, 0)} 个模板
        </p>
      </motion.button>
      
      {categories.map(category => (
        <TemplateCategoryCard
          key={category.value}
          category={category.value}
          label={category.label}
          icon={category.icon}
          count={category.count}
          isSelected={selectedCategory === category.value}
          onClick={() => onSelectCategory(category.value)}
        />
      ))}
    </div>
  );
};

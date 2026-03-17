import React, { memo } from 'react';
import { Template, TemplateCategory } from '../../types';
import { BookOpen, FileText, Briefcase, PieChart, Sparkles } from 'lucide-react';
import { useTheme, useIsMobile } from "../../hooks";

interface TemplateCardProps {
  template: Template;
  isSelected?: boolean;
  onClick: () => void;
}

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  learning: <BookOpen size={20} />,
  story: <FileText size={20} />,
  project: <Briefcase size={20} />,
  analysis: <PieChart size={20} />,
  custom: <Sparkles size={20} />,
};

const getCategoryColors = (isDark: boolean): Record<TemplateCategory, string> => {
  if (isDark) {
    return {
      learning: 'bg-blue-900/50 text-blue-400 border-blue-800',
      story: 'bg-purple-900/50 text-purple-400 border-purple-800',
      project: 'bg-green-900/50 text-green-400 border-green-800',
      analysis: 'bg-orange-900/50 text-orange-400 border-orange-800',
      custom: 'bg-pink-900/50 text-pink-400 border-pink-800',
    };
  }
  return {
    learning: 'bg-blue-50 text-blue-600 border-blue-200',
    story: 'bg-purple-50 text-purple-600 border-purple-200',
    project: 'bg-green-50 text-green-600 border-green-200',
    analysis: 'bg-orange-50 text-orange-600 border-orange-200',
    custom: 'bg-pink-50 text-pink-600 border-pink-200',
  };
};

const categoryLabels: Record<TemplateCategory, string> = {
  learning: '学习',
  story: '故事',
  project: '项目',
  analysis: '分析',
  custom: '自定义',
};

const TemplateCardComponent: React.FC<TemplateCardProps> = ({
  template,
  isSelected = false,
  onClick,
}) => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const categoryColors = getCategoryColors(isDark);

  return (
    <div
      onClick={onClick}
      className={`relative ${isMobile ? 'p-3' : 'p-5'} rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? isDark
            ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-500/20'
            : 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-500/20'
          : isDark
            ? 'border-slate-700 bg-slate-800 hover:border-slate-600 hover:shadow-md'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {template.is_system && (
        <div className={`absolute ${isMobile ? 'top-2 right-2' : 'top-3 right-3'}`}>
          <span className={`font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
            系统预设
          </span>
        </div>
      )}

      <div className={`flex items-start gap-2 md:gap-3 ${isMobile ? 'mb-2' : 'mb-3'}`}>
        <div className={`${isMobile ? 'p-2' : 'p-2.5'} rounded-xl ${categoryColors[template.category]}`}>
          {categoryIcons[template.category]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold truncate ${isMobile ? 'text-sm' : ''} ${isDark ? 'text-white' : 'text-gray-900'}`}>{template.name}</h3>
          <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{categoryLabels[template.category]}模板</span>
        </div>
      </div>

      <p className={`${isMobile ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'} ${isMobile ? '' : 'mb-3'} ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
        {template.description || '暂无描述'}
      </p>

      <div className={`flex items-center justify-between ${isMobile ? 'text-[10px]' : 'text-xs'} ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
        <span>{template.nodes?.length ?? 0} 个节点</span>
        {template.layout && (
          <span className={`px-2 py-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
            {template.layout.type}
          </span>
        )}
      </div>
    </div>
  );
};

export const TemplateCard = memo(TemplateCardComponent);

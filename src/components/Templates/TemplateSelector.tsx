import React, { useState, useMemo, useCallback } from 'react';
import { Template, TemplateCategory } from '../../types';
import { TemplateCard } from './TemplateCard';
import { TemplatePreview } from './TemplatePreview';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTemplates } from '../../hooks/queries';
import { useTheme, useIsMobile } from "../../hooks";

interface TemplateSelectorProps {
  onSelectTemplate: (template: Template | null) => void;
  onCancel: () => void;
}

const categoryLabels: Record<TemplateCategory, string> = {
  learning: '学习',
  story: '故事',
  project: '项目',
  analysis: '分析',
  custom: '自定义',
};

const CATEGORIES = ['all', 'learning', 'story', 'project', 'analysis', 'custom'] as const;

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelectTemplate,
  onCancel,
}) => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const { data: templates = [], isLoading } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return templates.filter((t: Template) => {
      const matchesSearch = t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query));
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  
  const displayedTemplates = useMemo(() => {
    return filteredTemplates.slice(
      currentPage * itemsPerPage,
      (currentPage + 1) * itemsPerPage
    );
  }, [filteredTemplates, currentPage, itemsPerPage]);

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
    }
  }, [selectedTemplate, onSelectTemplate]);

  const handleSkip = useCallback(() => {
    onSelectTemplate(null);
  }, [onSelectTemplate]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(0);
  }, []);

  const handleCategoryChange = useCallback((cat: TemplateCategory | 'all') => {
    setSelectedCategory(cat);
    setCurrentPage(0);
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(0, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(p => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full ${isMobile ? 'h-full rounded-none' : 'max-w-5xl rounded-2xl'} shadow-2xl ${isMobile ? 'max-h-full' : 'max-h-[90vh]'} flex flex-col ${
        isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'
      }`}>
        <div className={`p-4 md:p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className={`text-lg md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>选择模板</h2>
            <button
              onClick={onCancel}
              className={`p-2 rounded-full transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={isMobile ? 20 : 24} />
            </button>
          </div>

          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-4'}`}>
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={isMobile ? 16 : 18} />
              <input
                type="text"
                placeholder="搜索模板..."
                value={searchQuery}
                onChange={handleSearchChange}
                className={`w-full ${isMobile ? 'pl-9 pr-3 py-2 text-sm' : 'pl-10 pr-4 py-2.5'} rounded-xl border outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                    : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                }`}
              />
            </div>

            <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-1 -mx-1 px-1' : 'flex-wrap'}`}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    isMobile ? 'text-xs' : ''
                  } ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : isDark
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? '全部' : categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className={`flex-1 ${isMobile ? 'p-3' : 'p-6'} overflow-y-auto ${isDark ? 'bg-slate-800' : ''}`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>加载模板中...</p>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                <p className={`${isMobile ? 'text-base' : 'text-lg'} mb-2`}>未找到匹配的模板</p>
                <p className="text-sm">尝试更换搜索关键词或分类</p>
              </div>
            ) : (
              <>
                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-2 gap-4'} mb-4`}>
                  {displayedTemplates.map((template: Template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      onClick={() => handleSelectTemplate(template)}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 0}
                      className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                        isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <ChevronLeft size={isMobile ? 18 : 20} />
                    </button>
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages - 1}
                      className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                        isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <ChevronRight size={isMobile ? 18 : 20} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedTemplate && !isMobile && (
            <div className={`w-80 border-l p-6 overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
              <h3 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>模板预览</h3>
              <TemplatePreview template={selectedTemplate} />
            </div>
          )}
        </div>

        {selectedTemplate && isMobile && (
          <div className={`p-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>已选择: {selectedTemplate.name}</span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{selectedTemplate.nodes?.length ?? 0} 个节点</span>
            </div>
          </div>
        )}

        <div className={`p-4 md:p-6 border-t flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-center'} ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <button
            onClick={handleSkip}
            className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-medium transition-colors ${isMobile ? 'w-full text-center' : ''} ${
              isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            跳过，创建空白图谱
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTemplate}
            className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isMobile ? 'w-full shadow-lg shadow-blue-600/20' : 'shadow-lg shadow-blue-600/20'}`}
          >
            使用此模板
          </button>
        </div>
      </div>
    </div>
  );
};

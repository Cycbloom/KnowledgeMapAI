import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  RefreshCw,
  Network,
  BookOpen,
  Layers,
  ArrowRightLeft,
  Sparkles,
  Globe,
  MoreHorizontal,
  ChevronDown,
  Filter,
  Bot,
  Zap,
  Settings2,
} from 'lucide-react';
import type { GraphMapFilterMode, AnalysisMode } from '../../types';
import { useIsMobile } from '../../hooks';

interface GraphMapToolbarProps {
  onBack: () => void;
  onRefresh: () => void;
  onCreateRelation: () => void;
  onCreateGraph: () => void;
  onIntelligentAnalyze: () => void;
  onAgentAnalysis: () => void;
  onCustomAnalysis: () => void;
  onDomainGenerate: () => void;
  filterMode: GraphMapFilterMode;
  onFilterChange: (mode: GraphMapFilterMode) => void;
  graphCount: number;
  relationCount: number;
  isLoading?: boolean;
  fromGraphId?: string | null;
  fromGraphTitle?: string;
  onReturnToGraph?: () => void;
  analysisMode: AnalysisMode;
  onAnalysisModeChange: (mode: AnalysisMode) => void;
}

const filterOptions: Array<{ value: GraphMapFilterMode; label: string; icon: React.ReactNode }> = [
  { value: 'all', label: '全部', icon: <Layers className="w-4 h-4" /> },
  { value: 'prerequisite', label: '前置知识', icon: <Network className="w-4 h-4" /> },
  { value: 'extension', label: '扩展知识', icon: <BookOpen className="w-4 h-4" /> },
  { value: 'related', label: '相关知识', icon: <Network className="w-4 h-4" /> },
];

const analysisModeOptions: Array<{
  mode: AnalysisMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  hoverBgColor: string;
}> = [
  {
    mode: 'quick',
    label: '快速分析',
    description: 'AI发现潜在关系和跨学科关联',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
    hoverBgColor: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  {
    mode: 'deep',
    label: '深度分析',
    description: '渐进式获取信息，深度分析',
    icon: <Bot className="w-4 h-4" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
    hoverBgColor: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
  {
    mode: 'custom',
    label: '自定义分析',
    description: '自定义分析目标和参数',
    icon: <Settings2 className="w-4 h-4" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    hoverBgColor: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
  },
];

export const GraphMapToolbar: React.FC<GraphMapToolbarProps> = ({
  onBack,
  onRefresh,
  onCreateRelation,
  onCreateGraph,
  onIntelligentAnalyze,
  onAgentAnalysis,
  onCustomAnalysis,
  onDomainGenerate,
  filterMode,
  onFilterChange,
  graphCount,
  relationCount,
  isLoading = false,
  fromGraphId,
  fromGraphTitle,
  onReturnToGraph,
  analysisMode,
  onAnalysisModeChange,
}) => {
  const deviceInfo = useIsMobile();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAnalyzeMenu, setShowAnalyzeMenu] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const analyzeMenuRef = useRef<HTMLDivElement>(null);

  const isMobile = deviceInfo.isMobile;
  const isCompact = deviceInfo.screenWidth < 1280;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (analyzeMenuRef.current && !analyzeMenuRef.current.contains(event.target as Node)) {
        setShowAnalyzeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentFilter = filterOptions.find(f => f.value === filterMode);

  const renderFilterButtonGroup = () => {
    if (isMobile) {
      return (
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <Filter className="w-4 h-4" />
            <span className="max-w-[80px] truncate">{currentFilter?.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-50 min-w-[140px]">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    onFilterChange(option.value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                    filterMode === option.value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {currentFilter?.icon}
            <span>{currentFilter?.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-50 min-w-[140px]">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    onFilterChange(option.value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                    filterMode === option.value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
        {filterOptions.map(option => (
          <button
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterMode === option.value
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    );
  };

  const renderActionButtons = () => {
    if (isMobile) {
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateRelation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium"
          >
            <Network className="w-4 h-4" />
            <span>创建关系</span>
          </button>
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-50 min-w-[160px]">
                <button
                  onClick={() => { onRefresh(); setShowMoreMenu(false); }}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 first:rounded-t-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                <button
                  onClick={() => { onDomainGenerate(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                >
                  <Globe className="w-4 h-4" />
                  领域生成
                </button>
                <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-600">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">AI 分析</div>
                  {analysisModeOptions.map((option) => (
                    <button
                      key={option.mode}
                      onClick={() => {
                        onAnalysisModeChange(option.mode);
                        setShowMoreMenu(false);
                        if (option.mode === 'quick') {
                          onIntelligentAnalyze();
                        } else if (option.mode === 'deep') {
                          onAgentAnalysis();
                        } else if (option.mode === 'custom') {
                          onCustomAnalysis();
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-all duration-150 ${
                        analysisMode === option.mode
                          ? `${option.bgColor} ${option.color}`
                          : `text-gray-700 dark:text-gray-300 ${option.hoverBgColor}`
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md ${option.bgColor} flex items-center justify-center flex-shrink-0`}>
                        {option.icon}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium">{option.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { onCreateGraph(); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 last:rounded-b-lg"
                >
                  <Plus className="w-4 h-4" />
                  创建图谱
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isCompact) {
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onDomainGenerate}
            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
            title="领域图谱批量生成"
          >
            <Globe className="w-5 h-5" />
          </button>
          <div className="relative" ref={analyzeMenuRef}>
            <button
              onClick={() => setShowAnalyzeMenu(!showAnalyzeMenu)}
              className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200"
              title="AI 分析图谱地图"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            {showAnalyzeMenu && (
              <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 min-w-[240px] p-2">
                {analysisModeOptions.map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => {
                      onAnalysisModeChange(option.mode);
                      setShowAnalyzeMenu(false);
                      if (option.mode === 'quick') {
                        onIntelligentAnalyze();
                      } else if (option.mode === 'deep') {
                        onAgentAnalysis();
                      } else if (option.mode === 'custom') {
                        onCustomAnalysis();
                      }
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-150 ${
                      analysisMode === option.mode
                        ? `${option.bgColor} ring-1 ring-gray-200 dark:ring-gray-600`
                        : option.hoverBgColor
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${option.bgColor} flex items-center justify-center flex-shrink-0 ${option.color}`}>
                      {option.icon}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${analysisMode === option.mode ? option.color : 'text-gray-900 dark:text-white'}`}>
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onCreateGraph}
            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
            title="创建新图谱"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={onCreateRelation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium"
          >
            <Network className="w-4 h-4" />
            <span>创建关系</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={onDomainGenerate}
          className="flex items-center gap-2 px-3 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          title="领域图谱批量生成"
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm font-medium">领域生成</span>
        </button>

        <div className="relative" ref={analyzeMenuRef}>
          <button
            onClick={() => setShowAnalyzeMenu(!showAnalyzeMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200"
            title="AI 分析图谱地图"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI 分析</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAnalyzeMenu ? 'rotate-180' : ''}`} />
          </button>
          {showAnalyzeMenu && (
            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 min-w-[260px] p-2">
              {analysisModeOptions.map((option) => (
                <button
                  key={option.mode}
                  onClick={() => {
                    onAnalysisModeChange(option.mode);
                    setShowAnalyzeMenu(false);
                    if (option.mode === 'quick') {
                      onIntelligentAnalyze();
                    } else if (option.mode === 'deep') {
                      onAgentAnalysis();
                    } else if (option.mode === 'custom') {
                      onCustomAnalysis();
                    }
                  }}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-150 ${
                    analysisMode === option.mode
                      ? `${option.bgColor} ring-1 ring-gray-200 dark:ring-gray-600`
                      : option.hoverBgColor
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${option.bgColor} flex items-center justify-center flex-shrink-0 ${option.color}`}>
                    {option.icon}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${analysisMode === option.mode ? option.color : 'text-gray-900 dark:text-white'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onCreateGraph}
          className="flex items-center gap-2 px-3 py-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
          title="创建新图谱"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">创建图谱</span>
        </button>

        <button
          onClick={onCreateRelation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Network className="w-4 h-4" />
          <span className="text-sm font-medium">创建关系</span>
        </button>
      </div>
    );
  };

  return (
    <div className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-2 sm:px-4 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
          title="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2 min-w-0">
          <Network className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            图谱地图
          </h1>
        </div>

        {!isMobile && (
          <>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

            <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:flex items-center whitespace-nowrap">
              <span>{graphCount} 个图谱</span>
              <span className="mx-2">·</span>
              <span>{relationCount} 个关系</span>
            </div>

            {fromGraphId && onReturnToGraph && (
              <>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden lg:block" />
                <button
                  onClick={onReturnToGraph}
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium max-w-[150px]"
                  title={`返回 ${fromGraphTitle || '来源图谱'}`}
                >
                  <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{fromGraphTitle || '返回来源图谱'}</span>
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {renderFilterButtonGroup()}
        {renderActionButtons()}
      </div>
    </div>
  );
};

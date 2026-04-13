import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  BookOpen,
  Briefcase,
  GraduationCap,
  Layers,
  X,
  PenTool,
  FileText,
  PieChart,
  Network,
  GitBranch,
  CircleDot,
  LayoutGrid,
  Save,
  Eye,
} from 'lucide-react';
import { api } from '../../services/api';
import type { GeneratedTemplate } from '../../services/api/autoGraph';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler, useIsMobile, useTheme } from '../../hooks';
import type { TemplateCategory, LayoutSuggestion, TemplateDifficulty } from '../../types';

interface TemplateGeneratorProps {
  graphId?: string;
  onTemplateApplied?: (nodes: unknown[], edges: unknown[]) => void;
  onClose?: () => void;
}

const layoutIcons: Record<LayoutSuggestion, React.ElementType> = {
  radial: CircleDot,
  tree: GitBranch,
  network: Network,
  hierarchical: LayoutGrid,
};

const difficultyColors: Record<TemplateDifficulty, string> = {
  easy: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  hard: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

const getLevelColor = (level?: string) => {
  switch (level) {
    case 'root':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
    case 'core':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300';
    case 'sub':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300';
    case 'normal':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
    case 'leaf':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
  }
};

const TemplateSchemeCard: React.FC<{
  template: GeneratedTemplate;
  isSelected: boolean;
  isMobile: boolean;
  isDark: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onClick: () => void;
  onPreview: () => void;
}> = ({ template, isSelected, isMobile, isDark, t, onClick, onPreview }) => {
  const LayoutIcon = layoutIcons[template.layoutSuggestion];

  return (
    <div
      onClick={onClick}
      className={`p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? isDark
            ? 'border-blue-500 bg-blue-900/20'
            : 'border-blue-500 bg-blue-50'
          : isDark
            ? 'border-slate-700 bg-slate-800 hover:border-slate-600'
            : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4
            className={`font-semibold truncate ${isMobile ? 'text-sm' : ''} ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {template.name}
          </h4>
          <p
            className={`${isMobile ? 'text-xs' : 'text-sm'} ${
              isDark ? 'text-slate-400' : 'text-gray-500'
            } line-clamp-2 mt-1`}
          >
            {template.description}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className={`p-1.5 rounded-lg ${
            isDark
              ? 'hover:bg-slate-700 text-slate-400'
              : 'hover:bg-gray-100 text-gray-500'
          }`}
          title={t("templates.generator.previewStructure")}
        >
          <Eye size={isMobile ? 14 : 16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] md:text-xs ${
            difficultyColors[template.difficulty || 'medium']
          }`}
        >
          {t(`templates.difficulty.${template.difficulty || 'medium'}`)}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] md:text-xs ${
            isDark
              ? 'bg-slate-700 text-slate-300'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          <LayoutIcon size={12} />
          {t(`templates.layout.${template.layoutSuggestion || 'radial'}`)}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] md:text-xs ${
            isDark
              ? 'bg-slate-700 text-slate-300'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {template.nodes.length} {t("templates.nodeCountLabel", { count: template.nodes.length }).split(' ')[1]}
        </span>
      </div>

      <p
        className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${
          isDark ? 'text-slate-500' : 'text-gray-400'
        } line-clamp-1`}
      >
        {template.reasoning}
      </p>

      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check size={16} className="text-blue-500" />
        </div>
      )}
    </div>
  );
};

const TemplatePreviewModal: React.FC<{
  template: GeneratedTemplate;
  isMobile: boolean;
  isDark: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onClose: () => void;
}> = ({ template, isMobile, isDark, t, onClose }) => {
  const nodeMap = useMemo(() => {
    const map = new Map<string, GeneratedTemplate['nodes'][number]>();
    template.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [template.nodes]);

  const rootNodes = useMemo(() => {
    return template.nodes.filter((n) => !n.parentId);
  }, [template.nodes]);

  const renderNode = (node: GeneratedTemplate['nodes'][number], depth: number) => {
    const children = template.nodes.filter((n) => n.parentId === node.id);
    const indent = depth * (isMobile ? 12 : 16);

    return (
      <div key={node.id} className="mt-1">
        <div
          className={`p-2 rounded-lg border ${getLevelColor(node.level)}`}
          style={{ marginLeft: `${indent}px` }}
        >
          <div className="font-medium text-sm truncate">{node.title}</div>
          {node.suggestedContent && (
            <p className="text-xs opacity-70 mt-0.5 line-clamp-1">
              {node.suggestedContent}
            </p>
          )}
        </div>
        {children.length > 0 && (
          <div className="mt-1">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`w-full ${
          isMobile ? 'h-full rounded-none' : 'max-w-2xl max-h-[80vh]'
        } rounded-2xl shadow-2xl flex flex-col ${
          isDark ? 'bg-slate-800' : 'bg-white'
        }`}
      >
        <div
          className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <h3
              className={`font-bold ${isMobile ? 'text-base' : 'text-lg'} ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {template.name}
            </h3>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${
                isDark
                  ? 'hover:bg-slate-700 text-slate-400'
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X size={isMobile ? 18 : 20} />
            </button>
          </div>
          <p
            className={`mt-1 ${isMobile ? 'text-xs' : 'text-sm'} ${
              isDark ? 'text-slate-400' : 'text-gray-500'
            }`}
          >
            {template.description}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <h4
              className={`font-medium mb-2 ${isMobile ? 'text-sm' : ''} ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {t("templates.generator.nodeStructure")}
            </h4>
            <div className="space-y-1">
              {rootNodes.map((node) => renderNode(node, 0))}
            </div>
          </div>

          {template.edges.length > 0 && (
            <div>
              <h4
                className={`font-medium mb-2 ${isMobile ? 'text-sm' : ''} ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {t("templates.generator.relations")} ({template.edges.length})
              </h4>
              <div className="space-y-1">
                {template.edges.slice(0, 10).map((edge, index) => {
                  const sourceNode = nodeMap.get(edge.source);
                  const targetNode = nodeMap.get(edge.target);
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        isDark ? 'bg-slate-700' : 'bg-gray-50'
                      }`}
                    >
                      <span
                        className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                          isDark ? 'text-slate-300' : 'text-gray-700'
                        }`}
                      >
                        {sourceNode?.title || edge.source}
                      </span>
                      <span
                        className={`text-xs ${
                          isDark ? 'text-slate-500' : 'text-gray-400'
                        }`}
                      >
                        →
                      </span>
                      <span
                        className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                          isDark ? 'text-slate-300' : 'text-gray-700'
                        }`}
                      >
                        {targetNode?.title || edge.target}
                      </span>
                      {edge.relationship_type && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isDark
                              ? 'bg-slate-600 text-slate-300'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {edge.relationship_type}
                        </span>
                      )}
                    </div>
                  );
                })}
                {template.edges.length > 10 && (
                  <p
                    className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}
                  >
                    {t("templates.generator.moreRelations", { count: template.edges.length - 10 })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TemplateGenerator: React.FC<TemplateGeneratorProps> = ({
  graphId,
  onTemplateApplied,
  onClose,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const { isDark } = useTheme();
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [style, setStyle] = useState<
    'academic' | 'practical' | 'beginner' | 'custom'
  >('academic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<GeneratedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<GeneratedTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<GeneratedTemplate | null>(null);
  const [step, setStep] = useState<'input' | 'templates' | 'style'>('input');

  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const categoryOptions: Array<{
    value: TemplateCategory;
    label: string;
    icon: React.ElementType;
    description: string;
  }> = [
    {
      value: 'learning',
      label: t('templates.category.learning'),
      icon: BookOpen,
      description: t('templates.generator.templateCategory'),
    },
    {
      value: 'story',
      label: t('templates.category.story'),
      icon: FileText,
      description: t('templates.generator.templateCategory'),
    },
    {
      value: 'project',
      label: t('templates.category.project'),
      icon: Briefcase,
      description: t('templates.generator.templateCategory'),
    },
    {
      value: 'analysis',
      label: t('templates.category.analysis'),
      icon: PieChart,
      description: t('templates.generator.templateCategory'),
    },
    {
      value: 'custom',
      label: t('templates.category.custom'),
      icon: Sparkles,
      description: t('templates.generator.templateCategory'),
    },
  ];

  const styleOptions = [
    {
      value: 'academic',
      label: t('templates.style.academic'),
      icon: GraduationCap,
      details: t('templates.style.academicDetails'),
    },
    {
      value: 'practical',
      label: t('templates.style.practical'),
      icon: Briefcase,
      details: t('templates.style.practicalDetails'),
    },
    {
      value: 'beginner',
      label: t('templates.style.beginner'),
      icon: BookOpen,
      details: t('templates.style.beginnerDetails'),
    },
    {
      value: 'custom',
      label: t('templates.style.custom'),
      icon: PenTool,
      details: t('templates.style.customDetails'),
    },
  ];

  const handleGenerateTemplates = useCallback(async () => {
    if (!topic.trim()) {
      addMessage({ type: 'warning', content: t("templates.message.enterTopic") });
      return;
    }

    setIsGenerating(true);
    setTemplates([]);
    setSelectedTemplate(null);

    try {
      const result = await api.autoGraph.generateTemplates({
        topic,
        context: context.trim() || undefined,
        category,
        graph_id: graphId,
      });

      if (result.templates && result.templates.length > 0) {
        setTemplates(result.templates);
        setStep('templates');
        addMessage({
          type: 'success',
          content: t("templates.generator.templateGenerated", { count: result.templates.length }),
        });
      } else {
        addMessage({ type: 'warning', content: t("templates.generator.generateFailed") });
      }
    } catch (error) {
      handleError(error, {
        context: 'GenerateTemplates',
        fallbackMessage: t("templates.generator.generateFailed"),
      });
    } finally {
      setIsGenerating(false);
    }
  }, [topic, context, category, graphId, addMessage, handleError, t]);

  const handleSelectTemplate = useCallback((template: GeneratedTemplate) => {
    setSelectedTemplate(template);
    setStep('style');
  }, []);

  const handleApplyTemplate = useCallback(async () => {
    if (!selectedTemplate || !graphId) {
      addMessage({ type: 'warning', content: t("templates.message.selectTemplate") });
      return;
    }

    if (style === 'custom' && !customPrompt.trim()) {
      addMessage({ type: 'warning', content: t("templates.message.enterCustomRules") });
      return;
    }

    setIsApplying(true);

    try {
      const result = await api.autoGraph.applyTemplate({
        template: selectedTemplate,
        topic,
        style,
        customPrompt: style === 'custom' ? customPrompt : undefined,
        graph_id: graphId,
      });

      addMessage({ type: 'success', content: t("templates.generator.applySuccess") });
      onTemplateApplied?.(result.nodes, result.edges);
      onClose?.();
    } catch (error) {
      handleError(error, {
        context: 'ApplyTemplate',
        fallbackMessage: t("templates.message.applyFailed"),
      });
    } finally {
      setIsApplying(false);
    }
  }, [
    selectedTemplate,
    graphId,
    style,
    customPrompt,
    topic,
    addMessage,
    handleError,
    onTemplateApplied,
    onClose,
    t,
  ]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);

    try {
      await api.templates.create({
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        category,
        nodes: selectedTemplate.nodes,
        edges: selectedTemplate.edges,
        layout_suggestion: selectedTemplate.layoutSuggestion,
        difficulty: selectedTemplate.difficulty,
        estimated_nodes: selectedTemplate.estimatedNodes,
        tags: selectedTemplate.tags,
      });

      addMessage({ type: 'success', content: t("templates.message.saveToLibrarySuccess") });
    } catch (error) {
      handleError(error, {
        context: 'SaveTemplate',
        fallbackMessage: t("templates.message.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedTemplate, category, addMessage, handleError, t]);

  const handleBack = useCallback(() => {
    if (step === 'style') {
      setStep('templates');
      setSelectedTemplate(null);
    } else if (step === 'templates') {
      setStep('input');
      setTemplates([]);
    }
  }, [step]);

  return (
    <div
      className={`template-generator bg-white dark:bg-slate-800 ${
        isMobile ? 'rounded-none' : 'rounded-xl'
      } shadow-lg ${isMobile ? 'p-4' : 'p-6'} w-full ${
        isMobile ? 'h-full' : 'max-w-2xl max-h-[90vh]'
      } overflow-y-auto`}
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div
            className={`${
              isMobile ? 'p-1.5' : 'p-2'
            } bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg`}
          >
            <Layers
              className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`}
            />
          </div>
          <div>
            <h2
              className={`${
                isMobile ? 'text-lg' : 'text-xl'
              } font-bold text-gray-900 dark:text-white`}
            >
              {t("templates.generator.title")}
            </h2>
            <p
              className={`${
                isMobile ? 'text-xs' : 'text-sm'
              } text-gray-500 dark:text-gray-400`}
            >
              {t("templates.generator.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step !== 'input' && (
            <button
              onClick={handleBack}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg ${
                isDark ? 'text-slate-400' : 'text-gray-500'
              }`}
            >
              <ChevronDown
                size={isMobile ? 18 : 20}
                className="rotate-90"
              />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg ${
                isDark ? 'text-slate-400' : 'text-gray-500'
              }`}
            >
              <X size={isMobile ? 18 : 20} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 md:space-y-4"
            >
              <div>
                <label
                  className={`block ${
                    isMobile ? 'text-xs' : 'text-sm'
                  } font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}
                >
                  {t("templates.generator.topic")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("templates.generator.topicPlaceholder")}
                  className={`w-full ${
                    isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-3'
                  } border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white`}
                  disabled={isGenerating}
                />
              </div>

              <div>
                <label
                  className={`block ${
                    isMobile ? 'text-xs' : 'text-sm'
                  } font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}
                >
                  {t("templates.generator.templateCategory")}
                </label>
                <div
                  className={`grid ${
                    isMobile ? 'grid-cols-3 gap-1.5' : 'grid-cols-5 gap-2'
                  }`}
                >
                  {categoryOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setCategory(option.value)}
                        disabled={isGenerating}
                        className={`${
                          isMobile ? 'p-2' : 'p-2'
                        } rounded-lg border-2 transition-all text-center ${
                          category === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon
                          className={`${
                            isMobile ? 'w-4 h-4' : 'w-5 h-5'
                          } mx-auto ${
                            category === option.value
                              ? 'text-blue-500'
                              : 'text-gray-400'
                          }`}
                        />
                        <span
                          className={`${
                            isMobile ? 'text-[10px]' : 'text-xs'
                          } font-medium mt-1 block ${
                            category === option.value
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex items-center gap-2 ${
                  isMobile ? 'text-xs' : 'text-sm'
                } text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200`}
              >
                {showAdvanced ? (
                  <ChevronUp size={isMobile ? 14 : 16} />
                ) : (
                  <ChevronDown size={isMobile ? 14 : 16} />
                )}
                {t("templates.generator.backgroundInfo")}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder={t("templates.generator.backgroundPlaceholder")}
                      className={`w-full ${
                        isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
                      } border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white ${
                        isMobile ? 'min-h-[60px]' : 'min-h-[80px]'
                      } resize-y`}
                      disabled={isGenerating}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={handleGenerateTemplates}
                disabled={isGenerating || !topic.trim()}
                className={`w-full ${
                  isMobile ? 'py-2.5 px-3 text-sm' : 'py-3 px-4'
                } bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {isGenerating ? (
                  <>
                    <Loader2
                      className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`}
                    />
                    {t("templates.generator.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                    {t("templates.generator.generate")}
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3 md:space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3
                  className={`${
                    isMobile ? 'text-base' : 'text-lg'
                  } font-semibold text-gray-900 dark:text-white`}
                >
                  {t("templates.generator.selectScheme")}
                </h3>
                <span
                  className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                    isDark ? 'text-slate-400' : 'text-gray-500'
                  }`}
                >
                  {t("templates.generator.schemeCount", { count: templates.length })}
                </span>
              </div>

              <div className="space-y-3">
                {templates.map((template) => (
                  <TemplateSchemeCard
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplate?.id === template.id}
                    isMobile={isMobile}
                    isDark={isDark}
                    t={t}
                    onClick={() => handleSelectTemplate(template)}
                    onPreview={() => setPreviewTemplate(template)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === 'style' && selectedTemplate && (
            <motion.div
              key="style"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3 md:space-y-4"
            >
              <div
                className={`p-3 rounded-lg ${
                  isDark ? 'bg-slate-700' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`${
                        isMobile ? 'text-xs' : 'text-sm'
                      } ${isDark ? 'text-slate-400' : 'text-gray-500'}`}
                    >
                      {t("templates.selected")}
                    </span>
                    <span
                      className={`font-medium ${
                        isDark ? 'text-white' : 'text-gray-900'
                      } ${isMobile ? 'text-sm' : ''}`}
                    >
                      {selectedTemplate.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setPreviewTemplate(selectedTemplate)}
                    className={`flex items-center gap-1 ${
                      isMobile ? 'text-xs' : 'text-sm'
                    } text-blue-500 hover:text-blue-600`}
                  >
                    <Eye size={isMobile ? 12 : 14} />
                    {t("templates.generator.previewStructure")}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className={`block ${
                    isMobile ? 'text-xs' : 'text-sm'
                  } font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}
                >
                  {t("templates.generator.generationStyle")}
                </label>
                <div
                  className={`grid ${
                    isMobile ? 'grid-cols-2 gap-1.5' : 'grid-cols-4 gap-2'
                  }`}
                >
                  {styleOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() =>
                          setStyle(
                            option.value as
                              | 'academic'
                              | 'practical'
                              | 'beginner'
                              | 'custom'
                          )
                        }
                        disabled={isApplying}
                        className={`${
                          isMobile ? 'p-2' : 'p-2'
                        } rounded-lg border-2 transition-all text-left ${
                          style === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1 ${
                            isMobile ? 'mb-0.5' : 'mb-0.5'
                          }`}
                        >
                          <Icon
                            className={`${
                              isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'
                            } ${
                              style === option.value
                                ? 'text-blue-500'
                                : 'text-gray-400'
                            }`}
                          />
                          <span
                            className={`${
                              isMobile ? 'text-[10px]' : 'text-xs'
                            } font-medium ${
                              style === option.value
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {option.label}
                          </span>
                        </div>
                        <p
                          className={`${
                            isMobile ? 'text-[9px]' : 'text-[10px]'
                          } text-gray-500 dark:text-gray-400 line-clamp-1`}
                        >
                          {option.details}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {style === 'custom' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`${
                          isMobile ? 'mb-1.5 mt-2' : 'mb-2 mt-3'
                        }`}
                      >
                        <label
                          className={`block ${
                            isMobile ? 'text-xs' : 'text-sm'
                          } font-medium text-gray-700 dark:text-gray-300`}
                        >
                          {t("templates.style.customRules")}
                        </label>
                      </div>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder={t("templates.style.customRulesPlaceholder")}
                        className={`w-full ${
                          isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
                        } border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white ${
                          isMobile ? 'min-h-[60px]' : 'min-h-[80px]'
                        } resize-y`}
                        disabled={isApplying}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleApplyTemplate}
                  disabled={isApplying || (style === 'custom' && !customPrompt.trim())}
                  className={`w-full ${
                    isMobile ? 'py-2 px-3 text-sm' : 'py-2.5 px-4'
                  } bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {isApplying ? (
                    <>
                      <Loader2
                        className={`${
                          isMobile ? 'w-3 h-3' : 'w-4 h-4'
                        } animate-spin`}
                      />
                      {t("templates.generator.applying")}
                    </>
                  ) : (
                    <>
                      <Check className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                      {t("templates.button.apply")}
                    </>
                  )}
                </button>

                <button
                  onClick={handleSaveToLibrary}
                  disabled={isSaving}
                  className={`w-full ${
                    isMobile ? 'py-2 px-3 text-sm' : 'py-2 px-4'
                  } border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {isSaving ? (
                    <>
                      <Loader2
                        className={`${
                          isMobile ? 'w-3 h-3' : 'w-4 h-4'
                        } animate-spin`}
                      />
                      {t("templates.generator.saving")}
                    </>
                  ) : (
                    <>
                      <Save className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                      {t("templates.button.saveToLibrary")}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {previewTemplate && (
          <TemplatePreviewModal
            template={previewTemplate}
            isMobile={isMobile}
            isDark={isDark}
            t={t}
            onClose={() => setPreviewTemplate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TemplateGenerator;

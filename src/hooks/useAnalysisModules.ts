import { useState, useCallback } from 'react';
import { api } from '../services/api';
import type {
  AnalysisModuleId,
  AnalysisModuleState,
  AnalysisPromptScenarioId,
  RelationAnalysisResult,
  CrossDomainAnalysisResult,
  LearningPathAnalysisResult,
  KnowledgeGapAnalysisResult,
} from '../components/GraphMap/types';
import { DEFAULT_MODULES, MODULE_TO_SCENARIO } from '../components/GraphMap/types';
import { getScenarioById } from '../components/PromptConfig';

interface UseAnalysisModulesReturn {
  modules: AnalysisModuleState[];
  isAnyLoading: boolean;
  toggleModule: (moduleId: AnalysisModuleId) => void;
  selectAll: () => void;
  deselectAll: () => void;
  executeModules: (selectedIds: AnalysisModuleId[], options?: { graph_ids?: string[] }) => Promise<void>;
  resetModules: () => void;
  getModuleResult: <T>(moduleId: AnalysisModuleId) => T | null;
  getPromptContent: (moduleId: AnalysisModuleId) => string;
  savePrompt: (moduleId: AnalysisModuleId, content: string, scope?: 'user' | 'graph') => Promise<void>;
  resetPrompt: (moduleId: AnalysisModuleId) => Promise<void>;
  loadPromptTemplates: () => Promise<void>;
}

export function useAnalysisModules(): UseAnalysisModulesReturn {
  const [modules, setModules] = useState<AnalysisModuleState[]>(DEFAULT_MODULES);
  const [promptTemplates, setPromptTemplates] = useState<Record<string, string>>({});

  const isAnyLoading = modules.some((m) => m.status === 'loading');

  const toggleModule = useCallback((moduleId: AnalysisModuleId) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, selected: !m.selected } : m))
    );
  }, []);

  const selectAll = useCallback(() => {
    setModules((prev) => prev.map((m) => ({ ...m, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setModules((prev) => prev.map((m) => ({ ...m, selected: false })));
  }, []);

  const resetModules = useCallback(() => {
    setModules(DEFAULT_MODULES);
  }, []);

  const getModuleResult = useCallback(<T,>(moduleId: AnalysisModuleId): T | null => {
    const module = modules.find((m) => m.id === moduleId);
    return module?.result as T | null;
  }, [modules]);

  const loadPromptTemplates = useCallback(async () => {
    try {
      const result = await api.prompts.list() as { user?: Array<{ code: string; template_content: string; id: string }>; [key: string]: unknown };
      const templates: Record<string, string> = {};
      const analysisScenarios: AnalysisPromptScenarioId[] = ['relation_discovery', 'cross_domain_insights', 'learning_path_suggestions', 'knowledge_gaps'];
      for (const scenarioId of analysisScenarios) {
        const userTemplate = result.user?.find((t: { code: string }) => t.code === scenarioId);
        if (userTemplate) {
          templates[scenarioId] = userTemplate.template_content;
        } else {
          const scenario = getScenarioById(scenarioId);
          if (scenario) {
            templates[scenarioId] = scenario.defaultTemplate;
          }
        }
      }
      setPromptTemplates(templates);
    } catch (error) {
      console.error('Failed to load prompt templates:', error);
    }
  }, []);

  const getPromptContent = useCallback((moduleId: AnalysisModuleId): string => {
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    return promptTemplates[scenarioId] || '';
  }, [promptTemplates]);

  const savePrompt = useCallback(async (
    moduleId: AnalysisModuleId,
    content: string,
    scope: 'user' | 'graph' = 'user'
  ): Promise<void> => {
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    try {
      await api.prompts.save({
        code: scenarioId,
        scope,
        template_content: content,
      });
      setPromptTemplates(prev => ({
        ...prev,
        [scenarioId]: content,
      }));
    } catch (error) {
      console.error('Failed to save prompt:', error);
      throw error;
    }
  }, []);

  const resetPrompt = useCallback(async (moduleId: AnalysisModuleId): Promise<void> => {
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    try {
      const result = await api.prompts.list() as { user?: Array<{ code: string; id: string }>; [key: string]: unknown };
      const template = result.user?.find((t: { code: string }) => t.code === scenarioId);
      if (template) {
        await api.prompts.reset(template.id);
      }
      const scenario = getScenarioById(scenarioId);
      setPromptTemplates(prev => ({
        ...prev,
        [scenarioId]: scenario?.defaultTemplate || '',
      }));
    } catch (error) {
      console.error('Failed to reset prompt:', error);
      throw error;
    }
  }, []);

  const executeModule = async (
    moduleId: AnalysisModuleId,
    options?: { graph_ids?: string[] }
  ): Promise<{ id: AnalysisModuleId; result: unknown; error?: string }> => {
    try {
      let result: unknown;

      switch (moduleId) {
        case 'relations': {
          const response = await api.graphs.discoverRelations({
            graph_ids: options?.graph_ids,
          });
          result = {
            discovered_relations: response.discovered_relations,
            analysis_summary: response.analysis_summary,
          } as RelationAnalysisResult;
          break;
        }
        case 'crossDomain': {
          const response = await api.graphs.getCrossDomainInsights({
            graph_ids: options?.graph_ids,
          });
          result = {
            cross_domain_insights: response.cross_domain_insights,
            domain_distribution: response.domain_distribution,
            analysis_summary: response.analysis_summary,
          } as CrossDomainAnalysisResult;
          break;
        }
        case 'learningPaths': {
          const response = await api.graphs.getLearningPathSuggestions({
            graph_ids: options?.graph_ids,
          });
          result = {
            learning_path_suggestions: response.learning_path_suggestions,
            analysis_summary: response.analysis_summary,
          } as LearningPathAnalysisResult;
          break;
        }
        case 'knowledgeGaps': {
          const response = await api.graphs.getKnowledgeGaps({
            graph_ids: options?.graph_ids,
          });
          result = {
            knowledge_gaps: response.knowledge_gaps,
            analysis_summary: response.analysis_summary,
          } as KnowledgeGapAnalysisResult;
          break;
        }
        default:
          throw new Error(`Unknown module: ${moduleId}`);
      }

      return { id: moduleId, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { id: moduleId, result: null, error: errorMessage };
    }
  };

  const executeModules = useCallback(
    async (selectedIds: AnalysisModuleId[], options?: { graph_ids?: string[] }) => {
      selectedIds.forEach((id) => {
        setModules((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: 'loading' as const, error: undefined } : m
          )
        );
      });

      const promises = selectedIds.map((id) => executeModule(id, options));

      const results = await Promise.allSettled(promises);

      results.forEach((settledResult) => {
        if (settledResult.status === 'fulfilled') {
          const { id, result, error } = settledResult.value;
          setModules((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    status: error ? ('error' as const) : ('completed' as const),
                    result,
                    error,
                  }
                : m
            )
          );
        } else {
          const moduleId = selectedIds[results.indexOf(settledResult)];
          setModules((prev) =>
            prev.map((m) =>
              m.id === moduleId
                ? {
                    ...m,
                    status: 'error' as const,
                    error: settledResult.reason?.message || 'Execution failed',
                  }
                : m
            )
          );
        }
      });
    },
    []
  );

  return {
    modules,
    isAnyLoading,
    toggleModule,
    selectAll,
    deselectAll,
    executeModules,
    resetModules,
    getModuleResult,
    getPromptContent,
    savePrompt,
    resetPrompt,
    loadPromptTemplates,
  };
}

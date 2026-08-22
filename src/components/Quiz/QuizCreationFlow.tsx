import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  PenLine,
  BrainCircuit,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { useTheme } from "../../hooks";
import {
  useCreateQuizSetMutation,
  useGenerateQuizMutation,
  useQuizGenerationProgress,
  useAddCardsToQuizSetMutation,
  useAIStatus,
  useStudyCards,
  useGraphData,
  useGraphs,
} from '../../hooks/queries';
import { message } from "../../utils/messageHelper";
import { KnowledgePointSelector } from './KnowledgePointSelector';
import { QuizReuseAdjust } from './QuizReuseAdjust';
import { QuizMatrixTypeConfig } from './QuizMatrixTypeConfig';
import type { QuizSetConfig } from '@shared/types/quiz';
import type { StudyCard } from '@shared/types/common';
import {
  allocateQuotas,
  computeReuseCap,
  pickCardsByMatrix,
  type QuizAllocInput,
} from '../../utils/quizAllocation';

interface QuizCreationFlowProps {
  graphId?: string;
  onComplete: (quizSetId: string) => void;
  onCancel: () => void;
}

const STEPS = ['scope', 'generate'] as const;
type Step = (typeof STEPS)[number];
const STEP_INDEX: Record<Step, number> = { scope: 0, generate: 1 };

const LEVEL_ORDER: Record<string, number> = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };

const defaultConfig: QuizSetConfig = {
  cardTypes: ['qa', 'choice', 'true_false'],
  difficulty: 'medium',
  knowledgePointIds: [],
  cardsPerType: {
    qa: 5,
    choice: 5,
    true_false: 5,
    multi_choice: 3,
    fill_in_the_blank: 5,
    essay: 2,
    cloze: 5,
    select_from_options: 3,
    matching: 3,
    ordering: 3,
  },
};

interface QuizFlowDraft {
  step: Step;
  title: string;
  description: string;
  selectedGraphId: string | null;
  selectedKnowledgePoints: string[];
  reuseRatio: number;
  config: QuizSetConfig;
  pickedCardIds: string[];
  titleEditedManually: boolean;
  descriptionEditedManually: boolean;
}

export const QuizCreationFlow: React.FC<QuizCreationFlowProps> = ({
  graphId: initialGraphId,
  onComplete,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const makeInitialDraft = useCallback(
    (): QuizFlowDraft => ({
      step: STEPS[0],
      title: '',
      description: '',
      selectedGraphId: initialGraphId || null,
      selectedKnowledgePoints: [],
      reuseRatio: 40,
      config: defaultConfig,
      pickedCardIds: [],
      titleEditedManually: false,
      descriptionEditedManually: false,
    }),
    [initialGraphId],
  );

  const [draft, setDraft] = useState<QuizFlowDraft>(() => makeInitialDraft());

  const {
    step,
    title,
    description,
    selectedGraphId,
    selectedKnowledgePoints,
    reuseRatio,
    config,
    pickedCardIds,
    titleEditedManually,
    descriptionEditedManually,
  } = draft;

  const setPartial = useCallback(
    (patch: Partial<QuizFlowDraft>) => setDraft((prev) => ({ ...prev, ...patch })),
    [setDraft],
  );

  const [taskId, setTaskId] = useState<string | null>(null);
  const [createdQuizSetId, setCreatedQuizSetId] = useState<string | null>(null);
  const [reshuffleKey, setReshuffleKey] = useState(0);

  const createMutation = useCreateQuizSetMutation();
  const generateMutation = useGenerateQuizMutation();
  const addCardsMutation = useAddCardsToQuizSetMutation();
  const { data: aiStatus } = useAIStatus(true);
  const { data: graphsList } = useGraphs();

  const { data: graphData } = useGraphData(selectedGraphId || '');
  const { data: cards, isLoading: cardsLoading } = useStudyCards(
    { knowledge_point_ids: selectedKnowledgePoints },
    selectedKnowledgePoints.length > 0,
  ) as { data?: StudyCard[]; isLoading: boolean };

  const { data: progress } = useQuizGenerationProgress(taskId, !!taskId);
  const isGenerating = !!taskId && progress?.status !== 'completed' && progress?.status !== 'failed';

  // 选中知识点 → 分配输入（含等级）
  const kps = useMemo<QuizAllocInput[]>(() => {
    const nodes = graphData?.nodes || [];
    const map = new Map<string, QuizAllocInput>();
    nodes.forEach((node: { knowledge_point_id: string; title?: string; level?: string }) => {
      map.set(node.knowledge_point_id, {
        id: node.knowledge_point_id,
        title: node.title || node.knowledge_point_id,
        level: node.level || 'leaf',
      });
    });
    const result = selectedKnowledgePoints
      .map((id) => map.get(id))
      .filter((kp): kp is QuizAllocInput => Boolean(kp));
    result.sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9));
    return result;
  }, [graphData, selectedKnowledgePoints]);

  // 选中知识点的标题列表（按等级/选中顺序），供模板生成使用
  const kpTitles = useMemo(() => kps.map((kp) => kp.title), [kps]);
  const graphTitle = useMemo(() => {
    if (!selectedGraphId) return '';
    const found = (graphsList as Array<{ id: string; title?: string }> | undefined)?.find(
      (g) => g.id === selectedGraphId,
    );
    return found?.title ?? '';
  }, [graphsList, selectedGraphId]);

  // 根据选中知识点 + 图谱名自动生成测验标题和描述（模板匹配，无需AI调用）
  const autoGenTitleDesc = useCallback(
    (titles: string[], gTitle: string): { title: string; description: string } => {
      const validTitles = titles.filter((t) => t && t.trim().length > 0);
      const count = validTitles.length;
      const prefix = gTitle ? `${gTitle} · ` : '';

      if (count === 0) {
        return { title: '', description: '' };
      }

      let outTitle: string;
      if (count === 1) {
        outTitle = `${prefix}《${validTitles[0]}》专项测验`;
      } else if (count <= 3) {
        const joined = validTitles.slice(0, 3).join('、');
        outTitle = `${prefix}${joined} 综合测验`;
      } else {
        const firstTwo = validTitles.slice(0, 2).join('、');
        outTitle = `${prefix}${firstTwo}等${count}个知识点测验`;
      }

      const topicList = validTitles.slice(0, 5).join('、');
      const more = count > 5 ? ` 等${count}个知识点` : '';
      const desc = `本测验覆盖${topicList}${more}，通过多种题型检验对知识的理解、应用与迁移能力，帮助快速定位薄弱点并巩固掌握。`;

      return { title: outTitle, description: desc };
    },
    [],
  );

  // 选中知识点变化 → 若用户未手动编辑过对应字段，则自动刷新标题/描述
  useEffect(() => {
    const generated = autoGenTitleDesc(kpTitles, graphTitle);
    setDraft((prev) => {
      const next: Partial<QuizFlowDraft> = {};
      if (!prev.titleEditedManually) {
        next.title = generated.title;
      }
      if (!prev.descriptionEditedManually) {
        next.description = generated.description;
      }
      if (Object.keys(next).length === 0) return prev;
      return { ...prev, ...next };
    });
  }, [kpTitles, graphTitle, autoGenTitleDesc]);

  // 已有题目按知识点分组
  const existingByKp = useMemo(() => {
    const map: Record<string, StudyCard[]> = {};
    for (const card of cards ?? []) {
      const list = map[card.knowledge_point_id];
      if (list) {
        list.push(card);
      } else {
        map[card.knowledge_point_id] = [card];
      }
    }
    return map;
  }, [cards]);

  const existingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [id, list] of Object.entries(existingByKp)) {
      counts[id] = list.length;
    }
    return counts;
  }, [existingByKp]);

  // 题目总数 = 题型×难度数量矩阵的合计（用户在第2步矩阵中直接设置数量）
  const matrixTotal = useMemo(() => {
    const cm = config.countMatrix;
    let sum = 0;
    if (cm) {
      for (const diffMap of Object.values(cm)) {
        for (const v of Object.values(diffMap ?? {})) sum += v ?? 0;
      }
    }
    if (sum > 0) return sum;
    // 矩阵尚未同步时的兜底：按已选题型 × cardsPerType 求和，再兜底 15
    return (
      (config.cardTypes ?? []).reduce((s, tp) => s + (config.cardsPerType?.[tp] ?? 0), 0) || 15
    );
  }, [config.countMatrix, config.cardTypes, config.cardsPerType]);

  // 配额：矩阵总数按知识点平均分配（策略/等级权重不再需要单独设置）
  const quotas = useMemo(
    () => allocateQuotas(kps, matrixTotal, 'average', {}),
    [kps, matrixTotal],
  );

  const quotaByKp = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kp of kps) map[kp.id] = quotas[kp.id] ?? 0;
    return map;
  }, [kps, quotas]);

  const reuseCapByKp = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kp of kps) {
      map[kp.id] = computeReuseCap(quotas[kp.id] ?? 0, existingCounts[kp.id] ?? 0, reuseRatio);
    }
    return map;
  }, [kps, quotas, existingCounts, reuseRatio]);

  const pickedSet = useMemo(() => new Set(pickedCardIds), [pickedCardIds]);

  // 实际复用数（依据用户勾选的 pickedCardIds）
  const reuseCountByKp = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kp of kps) {
      const list = existingByKp[kp.id] || [];
      map[kp.id] = list.filter((c) => pickedSet.has(c.id)).length;
    }
    return map;
  }, [kps, existingByKp, pickedCardIds, pickedSet]);

  // 每个知识点缺口（需生成）
  const gapByKp = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kp of kps) {
      map[kp.id] = Math.max(0, (quotas[kp.id] ?? 0) - (reuseCountByKp[kp.id] ?? 0));
    }
    return map;
  }, [kps, quotas, reuseCountByKp]);

  const totalReuse = Object.values(reuseCountByKp).reduce((s, v) => s + v, 0);
  const totalGap = Object.values(gapByKp).reduce((s, v) => s + v, 0);
  const totalQuota = Object.values(quotas).reduce((s, v) => s + v, 0);
  const requiresAI = totalGap > 0;

  const gapKpIds = useMemo(() => kps.filter((kp) => (gapByKp[kp.id] ?? 0) > 0).map((kp) => kp.id), [kps, gapByKp]);
  const perNodeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const kp of kps) {
      const g = gapByKp[kp.id] ?? 0;
      if (g > 0) map[kp.id] = g;
    }
    return map;
  }, [kps, gapByKp]);

  // 系统自动挑选：分配/复用上限/矩阵配置/已有题目变化时，按矩阵+随机自动挑选（对用户透明）
  const autoPickKey = useMemo(() => {
    const kpKey = [...selectedKnowledgePoints].sort().join('|');
    const cardsSig = (cards ?? []).map((c) => c.id).sort().join('|');
    const matrixSig = `${config.cardTypes.join(',')}|${config.difficulty}|${matrixTotal}|${reuseRatio}`;
    return `${kpKey}|${matrixSig}|${reshuffleKey}|${cardsSig}`;
  }, [selectedKnowledgePoints, matrixTotal, reuseRatio, config.cardTypes, config.difficulty, reshuffleKey, cards]);

  useEffect(() => {
    if (!cards) return;
    const picked: string[] = [];
    for (const kp of kps) {
      const cap = reuseCapByKp[kp.id] ?? 0;
      if (cap <= 0) continue;
      const chosen = pickCardsByMatrix(existingByKp[kp.id] || [], cap, {
        cardTypes: config.cardTypes,
        difficulty: config.difficulty,
      });
      picked.push(...chosen.map((c) => c.id));
    }
    setPartial({ pickedCardIds: picked });
    // 仅依赖 autoPickKey：分配或题目集合变化时重新挑选；用户手动微调不会触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPickKey]);

  const canContinue = useMemo(() => {
    switch (STEP_INDEX[step]) {
      case 0:
        return title.trim().length >= 2 && selectedKnowledgePoints.length > 0;
      case 1:
        return true;
      default:
        return false;
    }
  }, [step, title, selectedKnowledgePoints]);

  const canCreate = useMemo(() => {
    if (title.trim().length < 2) return false;
    if (kps.length === 0) return false;
    if (totalReuse === 0 && totalGap === 0) return false;
    if (requiresAI) {
      if (!aiStatus?.enabled) return false;
      if (config.cardTypes.length === 0) return false;
    }
    return true;
  }, [title, kps, totalReuse, totalGap, requiresAI, aiStatus, config.cardTypes]);

  const goStep = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    setPartial({ step: STEPS[clamped] });
  };

  const handleConfigChange = (partialConfig: Partial<QuizSetConfig>) => {
    setPartial({ config: { ...config, ...partialConfig } });
  };

  const resetFlow = useCallback(() => {
    setTaskId(null);
    setCreatedQuizSetId(null);
    setReshuffleKey(0);
  }, []);

  useEffect(() => {
    if (progress?.status === 'completed' && createdQuizSetId) {
      message.success(t('quiz.generation.completed'));
      setDraft(makeInitialDraft());
      resetFlow();
      onComplete(createdQuizSetId);
    } else if (progress?.status === 'failed') {
      message.error(progress.error || t('quiz.generation.failed'));
      setTaskId(null);
    }
  }, [progress, createdQuizSetId, onComplete, resetFlow, t, setDraft]);

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      const fullConfig: QuizSetConfig = {
        ...config,
        knowledgePointIds: selectedKnowledgePoints,
      };

      const quizSet = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        graph_id: selectedGraphId || undefined,
        config: fullConfig,
      });
      setCreatedQuizSetId(quizSet.id);

      if (pickedCardIds.length > 0) {
        await addCardsMutation.mutateAsync({
          quizSetId: quizSet.id,
          cardIds: pickedCardIds,
        });
      }

      if (totalGap > 0) {
        const result = await generateMutation.mutateAsync({
          quiz_set_id: quizSet.id,
          node_ids: gapKpIds,
          config: {
            ...fullConfig,
            knowledgePointIds: gapKpIds,
            perNodeCounts,
          },
        });
        setTaskId(result.task_id);
        message.info(t('quiz.generation.started'));
      } else {
        message.success(t('quiz.reuse.createdWithReuse', { count: totalReuse }));
        setDraft(makeInitialDraft());
        resetFlow();
        onComplete(quizSet.id);
      }
    } catch (error: unknown) {
      console.error('Failed to create quiz:', error);
      const errorMessage = error instanceof Error ? error.message : t('quiz.generation.createFailed');
      message.error(errorMessage);
    }
  };

  const progressPercent = useMemo(() => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  }, [progress]);

  const stepMeta: Array<{ key: Step; title: string }> = [
    { key: 'scope', title: t('quiz.flow.stepScope', { defaultValue: '范围与信息' }) },
    { key: 'generate', title: t('quiz.flow.stepGenerate') },
  ];

  const currentStepIndex = STEP_INDEX[step] ?? 0;
  const currentStepTitle = stepMeta[currentStepIndex]?.title ?? '';

  const renderStepContent = () => {
    switch (STEP_INDEX[step]) {
      case 0:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左栏：基本信息（自动生成 + 可编辑） */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-slate-800/40 border border-slate-700' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-primary-900/40 text-primary-400' : 'bg-primary-100 text-primary-600'}`}>
                  <PenLine size={16} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    {t('quiz.flow.stepBasic', { defaultValue: '基本信息' })}
                  </h4>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('quiz.flow.autoGenHint', { defaultValue: '根据右侧所选知识点自动生成，可手动微调' })}
                  </p>
                </div>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    const generated = autoGenTitleDesc(kpTitles, graphTitle);
                    setPartial({
                      title: generated.title,
                      description: generated.description,
                      titleEditedManually: false,
                      descriptionEditedManually: false,
                    });
                  }}
                  disabled={kpTitles.length === 0}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    kpTitles.length > 0
                      ? isDark
                        ? 'bg-primary-900/40 text-primary-300 hover:bg-primary-900/60'
                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      : isDark
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={12} />
                  {t('quiz.flow.regenerate', { defaultValue: '重新生成' })}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t('quiz.generation.quizTitle')} <span aria-hidden="true" className="text-red-500">*</span>
                    </label>
                    {!titleEditedManually && title && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-50 text-primary-600'}`}>
                        {t('quiz.flow.autoBadge', { defaultValue: 'AI·自动生成' })}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setPartial({ title: e.target.value, titleEditedManually: true })}
                      placeholder={t('quiz.generation.titlePlaceholder')}
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm transition-colors ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-primary-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500'
                      }`}
                    />
                    <PenLine size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t('quiz.generation.descriptionOptional')}
                    </label>
                    {!descriptionEditedManually && description && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-50 text-primary-600'}`}>
                        {t('quiz.flow.autoBadge', { defaultValue: 'AI·自动生成' })}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setPartial({ description: e.target.value, descriptionEditedManually: true })}
                    placeholder={t('quiz.generation.descriptionPlaceholder')}
                    rows={7}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm resize-none transition-colors leading-relaxed ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-primary-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500'
                    }`}
                  />
                </div>

                {/* 已选知识点概览 */}
                <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-900/60 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {t('quiz.flow.selectedKpPreview', { defaultValue: '已选知识点预览' })}
                    </span>
                    <span className={`text-xs font-bold ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>
                      {selectedKnowledgePoints.length > 0
                        ? t('quiz.knowledgePointSelector.selectedCount', { count: selectedKnowledgePoints.length })
                        : t('quiz.flow.noKpSelected', { defaultValue: '未选择' })}
                    </span>
                  </div>
                  {kpTitles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {kpTitles.slice(0, 8).map((t2) => (
                        <span
                          key={t2}
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] truncate max-w-[200px] ${
                            isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-gray-700 border border-gray-200'
                          }`}
                          title={t2}
                        >
                          {t2}
                        </span>
                      ))}
                      {kpTitles.length > 8 && (
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                          +{kpTitles.length - 8}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                      {t('quiz.flow.selectKpOnRight', { defaultValue: '请先在右侧选择至少一个知识点' })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 右栏：知识点选择 */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-slate-800/40 border border-slate-700' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-violet-900/40 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
                  <Layers size={16} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                    {t('quiz.flow.stepKnowledge', { defaultValue: '选择知识点' })}
                  </h4>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('quiz.flow.kpHint', { defaultValue: '先选择图谱，再勾选要覆盖的知识点' })}
                  </p>
                </div>
              </div>
              <KnowledgePointSelector
                graphId={selectedGraphId || undefined}
                selectedIds={selectedKnowledgePoints}
                onChange={(ids) => setPartial({ selectedKnowledgePoints: ids })}
                onGraphChange={(gid) => setPartial({ selectedGraphId: gid, selectedKnowledgePoints: [] })}
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}>
              <QuizMatrixTypeConfig config={config} onChange={handleConfigChange} />
            </div>

            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}>
              <QuizReuseAdjust
                kps={kps}
                existingCounts={existingCounts}
                quotaByKp={quotaByKp}
                reuseCapByKp={reuseCapByKp}
                reuseCountByKp={reuseCountByKp}
                reuseRatio={reuseRatio}
                onReuseRatioChange={(r) => setPartial({ reuseRatio: r })}
                onReshuffle={() => setReshuffleKey((k) => k + 1)}
                disabled={isGenerating}
              />
            </div>

            {requiresAI && aiStatus && !aiStatus.enabled && (
              <div className={`flex items-center gap-3 p-4 rounded-xl ${
                isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'
              }`}>
                <AlertCircle size={20} />
                <div>
                  <p className="font-medium">{t('quiz.generation.aiNotConfigured')}</p>
                  <p className="text-sm opacity-80">{t('quiz.generation.configureAiHint')}</p>
                </div>
              </div>
            )}

            <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Check size={16} className={isDark ? 'text-green-400' : 'text-green-600'} />
                <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  {t('quiz.flow.confirmSummary')}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700'
                }`}>
                  {t('quiz.generation.summaryReuse', { count: totalReuse })}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-600'
                }`}>
                  {t('quiz.generation.summaryGenerate', { count: totalGap })}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-700'
                }`}>
                  {t('quiz.flow.totalCount', { count: totalQuota })}
                </span>
              </div>
              <p className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                {t('quiz.flow.generateCompositionHint')}
              </p>
            </div>

            {isGenerating && progress && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-primary-900/30' : 'bg-primary-50'}`} role="status" aria-live="polite">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin text-primary-600" />
                    <span className={`font-medium ${isDark ? 'text-primary-300' : 'text-primary-700'}`}>
                      {t('quiz.generation.generating')}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>
                    {progressPercent}%
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-primary-100'}`}>
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                {progress.current && (
                  <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {t('quiz.generation.processing', { current: progress.current })}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden animate-in fade-in zoom-in duration-200 ${
      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
    }`}>
      {/* 头部：返回 + 步骤指示 */}
      <div className={`px-6 py-4 border-b flex items-center gap-4 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'
          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ArrowLeft size={16} />
          {t('quiz.flow.backToList')}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {stepMeta.map((meta, idx) => {
            const isActive = idx === currentStepIndex;
            const isDone = idx < currentStepIndex;
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => isDone && goStep(idx)}
                disabled={!isDone}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                  isActive
                    ? isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-600'
                    : isDone
                      ? isDark ? 'text-green-400 hover:bg-slate-800' : 'text-green-600 hover:bg-gray-100'
                      : isDark ? 'text-slate-600' : 'text-gray-300'
                }`}
              >
                {isDone && <Check size={12} />}
                {idx + 1}. {meta.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* 步骤标题 */}
      <div className={`px-6 pt-5 flex items-center gap-3 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        <div className={`p-2 rounded-xl ${isDark ? 'bg-primary-900/50 text-primary-400' : 'bg-primary-100 text-primary-600'}`}>
          <BrainCircuit size={22} />
        </div>
        <div>
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {currentStepTitle}
          </h3>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {t('quiz.flow.stepOf', { current: currentStepIndex + 1, total: STEPS.length })}
          </p>
        </div>
      </div>

      {/* 步骤内容 */}
      <div className={`p-6 overflow-y-auto ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`} aria-busy={isGenerating}>
        {renderStepContent()}
      </div>

      {/* 底部导航 */}
      <div className={`px-6 py-4 border-t flex justify-between items-center ${isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-white'}`}>
        <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          {cardsLoading ? t('quiz.reuse.loading') : t('quiz.flow.footerCounts', { reuse: totalReuse, gap: totalGap })}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0 || isGenerating}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'
            } ${currentStepIndex === 0 || isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ArrowLeft size={16} />
            {t('quiz.flow.prev')}
          </button>

          {currentStepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => goStep(currentStepIndex + 1)}
              disabled={!canContinue || isGenerating}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold transition-all ${
                canContinue && !isGenerating
                  ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white shadow-lg shadow-primary-200 dark:shadow-none'
                  : isDark ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {t('quiz.flow.next')}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || isGenerating}
              className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold transition-all ${
                canCreate && !isGenerating
                  ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white shadow-lg shadow-primary-200 dark:shadow-none'
                  : isDark ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  {t('quiz.generation.generatingButton')}
                </>
              ) : (
                <>
                  <Sparkles size={18} aria-hidden="true" />
                  {t('quiz.flow.createQuiz')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

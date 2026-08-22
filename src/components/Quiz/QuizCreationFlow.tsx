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
  Puzzle,
  RotateCw,
  ListChecks,
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

const STEPS = ['scope', 'compose', 'generate'] as const;
type Step = (typeof STEPS)[number];
const STEP_INDEX: Record<Step, number> = { scope: 0, compose: 1, generate: 2 };

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
      case 2:
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

  const stepMeta: Array<{ key: Step; icon: typeof BrainCircuit; title: string }> = [
    {
      key: 'scope',
      icon: ListChecks,
      title: t('quiz.flow.stepScope', { defaultValue: '范围与信息' }),
    },
    {
      key: 'compose',
      icon: Puzzle,
      title: t('quiz.flow.stepCompose', { defaultValue: '题型与难度构成' }),
    },
    {
      key: 'generate',
      icon: BrainCircuit,
      title: t('quiz.flow.stepGenerate'),
    },
  ];

  const currentStepIndex = STEP_INDEX[step] ?? 0;

  // 步骤指示器
  const renderStepper = () => (
    <div className="flex items-center">
      {stepMeta.map((meta, idx) => {
        const isActive = idx === currentStepIndex;
        const isDone = idx < currentStepIndex;
        const isLast = idx === stepMeta.length - 1;
        return (
          <React.Fragment key={meta.key}>
            <button
              type="button"
              onClick={() => isDone && goStep(idx)}
              disabled={!isDone}
              aria-current={isActive ? 'step' : undefined}
              className={`flex items-center gap-2 group ${isActive ? '' : isDone ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-primary-600 to-violet-600 text-white shadow-lg shadow-primary-500/30'
                    : isDone
                      ? 'bg-green-500 text-white'
                      : isDark
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? <Check size={15} aria-hidden="true" /> : idx + 1}
              </span>
              <span
                className={`hidden sm:block text-xs font-bold transition-colors ${
                  isActive
                    ? isDark ? 'text-primary-300' : 'text-primary-600'
                    : isDone
                      ? isDark ? 'text-green-400' : 'text-green-600'
                      : isDark ? 'text-slate-500' : 'text-gray-400'
                }`}
              >
                {meta.title}
              </span>
            </button>
            {!isLast && (
              <span
                className={`mx-2 sm:mx-3 h-0.5 w-6 sm:w-14 rounded-full transition-colors ${
                  isDone ? 'bg-green-400' : isDark ? 'bg-slate-700' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStepContent = () => {
    switch (STEP_INDEX[step]) {
      case 0:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 h-full">
            {/* 左栏：基本信息（自动生成 + 可编辑） */}
            <div className={`p-5 sm:p-6 rounded-2xl border transition-colors flex flex-col min-h-0 overflow-y-auto ${
              isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25">
                  <PenLine size={18} aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h4 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                    {t('quiz.flow.stepBasic', { defaultValue: '基本信息' })}
                  </h4>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('quiz.flow.autoGenHint', { defaultValue: '根据右侧所选知识点自动生成，可手动微调' })}
                  </p>
                </div>
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
                  title={t('quiz.flow.regenerate', { defaultValue: '重新生成' })}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    kpTitles.length > 0
                      ? isDark
                        ? 'bg-primary-900/40 text-primary-300 hover:bg-primary-900/60'
                        : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                      : isDark
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <RotateCw size={13} aria-hidden="true" />
                  {t('quiz.flow.regenerate', { defaultValue: '重新生成' })}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t('quiz.generation.quizTitle')} <span aria-hidden="true" className="text-red-500">*</span>
                    </label>
                    {!titleEditedManually && title ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <Sparkles size={11} aria-hidden="true" />
                        {t('quiz.flow.autoBadge', { defaultValue: 'AI 自动生成' })}
                      </span>
                    ) : (
                      titleEditedManually && title && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {t('quiz.flow.manualEdit', { defaultValue: '手动编辑' })}
                        </span>
                      )
                    )}
                  </div>
                  <div className="relative group">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setPartial({ title: e.target.value, titleEditedManually: true })}
                      placeholder={t('quiz.generation.titlePlaceholder')}
                      className={`w-full px-4 py-3 pr-10 rounded-xl border text-sm transition-all ${
                        isDark
                          ? 'bg-slate-800/70 border-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                      }`}
                    />
                    <PenLine size={16} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} aria-hidden="true" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {t('quiz.generation.descriptionOptional')}
                    </label>
                    {!descriptionEditedManually && description ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <Sparkles size={11} aria-hidden="true" />
                        {t('quiz.flow.autoBadge', { defaultValue: 'AI 自动生成' })}
                      </span>
                    ) : (
                      descriptionEditedManually && description && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {t('quiz.flow.manualEdit', { defaultValue: '手动编辑' })}
                        </span>
                      )
                    )}
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setPartial({ description: e.target.value, descriptionEditedManually: true })}
                    placeholder={t('quiz.generation.descriptionPlaceholder')}
                    rows={6}
                    className={`w-full px-4 py-3 rounded-xl border text-sm resize-none transition-all leading-relaxed ${
                      isDark
                        ? 'bg-slate-800/70 border-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                    }`}
                  />
                </div>

                {/* 已选知识点概览 */}
                <div className={`p-3.5 rounded-xl ${isDark ? 'bg-slate-900/60 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {t('quiz.flow.selectedKpPreview', { defaultValue: '已选知识点预览' })}
                    </span>
                    <span className={`text-xs font-bold ${
                      selectedKnowledgePoints.length > 0 ? (isDark ? 'text-primary-400' : 'text-primary-600') : (isDark ? 'text-slate-500' : 'text-gray-400')
                    }`}>
                      {selectedKnowledgePoints.length > 0
                        ? t('quiz.knowledgePointSelector.selectedCount', { count: selectedKnowledgePoints.length })
                        : t('quiz.flow.noKpSelected', { defaultValue: '未选择' })}
                    </span>
                  </div>
                  {kpTitles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {kpTitles.slice(0, 8).map((kpTitle) => (
                        <span
                          key={kpTitle}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] truncate max-w-[190px] ${
                            isDark
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-white text-gray-700 border border-gray-200'
                          }`}
                          title={kpTitle}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-primary-400' : 'bg-primary-500'}`} aria-hidden="true" />
                          {kpTitle}
                        </span>
                      ))}
                      {kpTitles.length > 8 && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
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
            <div className={`p-5 sm:p-6 rounded-2xl border transition-colors flex flex-col min-h-0 overflow-hidden ${
              isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25">
                  <Layers size={18} aria-hidden="true" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                    {t('quiz.flow.stepKnowledge', { defaultValue: '选择知识点' })}
                  </h4>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('quiz.flow.kpHint', { defaultValue: '先选择图谱，再勾选要覆盖的知识点' })}
                  </p>
                </div>
              </div>
              <KnowledgePointSelector
                graphId={selectedGraphId || undefined}
                selectedIds={selectedKnowledgePoints}
                onChange={(ids) => setPartial({ selectedKnowledgePoints: ids })}
                onGraphChange={(gid) => setPartial({ selectedGraphId: gid, selectedKnowledgePoints: [] })}
                fillHeight
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="h-full">
            <QuizMatrixTypeConfig
              config={config}
              onChange={handleConfigChange}
              splitLayout
            />
          </div>
        );
      case 2:
        return (
          <div className="h-full flex flex-col gap-5">
            {/* 上区：左右双栏（左=复用控制与统计，右=知识点分配明细预览） */}
            <div className="flex-1 min-h-0">
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
                splitLayout
              />
            </div>

            {/* 下区：AI 提示 + 确认摘要 + 生成进度（固定高度，不参与滚动） */}
            <div className="shrink-0 space-y-4">
              {requiresAI && aiStatus && !aiStatus.enabled && (
                <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
                  isDark ? 'bg-amber-900/30 border-amber-800/40 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <AlertCircle size={20} aria-hidden="true" />
                  <div>
                    <p className="font-medium">{t('quiz.generation.aiNotConfigured')}</p>
                    <p className="text-sm opacity-80">{t('quiz.generation.configureAiHint')}</p>
                  </div>
                </div>
              )}

              <div className={`p-5 sm:p-6 rounded-2xl border ${
                isDark ? 'border-slate-700 bg-gradient-to-br from-slate-800/60 to-slate-900/40' : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                    <Check size={16} aria-hidden="true" />
                  </div>
                  <span className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                    {t('quiz.flow.confirmSummary')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-xl ${
                    isDark ? 'bg-green-900/30' : 'bg-green-50'
                  }`}>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-green-300' : 'text-green-600'}`}>{totalReuse}</span>
                    <span className={`text-[11px] font-medium ${isDark ? 'text-green-400/80' : 'text-green-700/80'}`}>
                      {t('quiz.flow.reuseLabel', { defaultValue: '复用' })}
                    </span>
                  </div>
                  <div className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-xl ${
                    isDark ? 'bg-primary-900/40' : 'bg-primary-50'
                  }`}>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-primary-300' : 'text-primary-600'}`}>{totalGap}</span>
                    <span className={`text-[11px] font-medium ${isDark ? 'text-primary-400/80' : 'text-primary-700/80'}`}>
                      {t('quiz.flow.generateLabel', { defaultValue: '新生成' })}
                    </span>
                  </div>
                  <div className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-xl ${
                    isDark ? 'bg-slate-700/60' : 'bg-gray-200/70'
                  }`}>
                    <span className={`text-2xl font-extrabold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>{totalQuota}</span>
                    <span className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>
                      {t('quiz.flow.totalLabel', { defaultValue: '总计' })}
                    </span>
                  </div>
                </div>
                <p className={`mt-3 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t('quiz.flow.summaryComposition', { defaultValue: '新题按矩阵生成，涉及知识点缺口自动折算；不足部分优先复用已有题目。' })}
                </p>
              </div>

              {isGenerating && progress && (
                <div className={`p-5 rounded-2xl border ${
                  isDark ? 'bg-primary-900/30 border-primary-800/40' : 'bg-primary-50 border-primary-100'
                }`} role="status" aria-live="polite">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin text-primary-600" aria-hidden="true" />
                      <span className={`font-semibold ${isDark ? 'text-primary-300' : 'text-primary-700'}`}>
                        {t('quiz.generation.generating')}
                      </span>
                    </div>
                    <span className={`text-sm font-extrabold ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>
                      {progressPercent}%
                    </span>
                  </div>
                  <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-primary-100'}`}>
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('quiz.generation.progressLabel')}
                    />
                  </div>
                  {progress.current && (
                    <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      {t('quiz.generation.processing', { current: progress.current })}
                    </p>
                  )}
                  <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t('quiz.generation.completedProgress', { completed: progress.completed, total: progress.total })}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`h-full flex flex-col rounded-2xl border overflow-hidden shadow-xl shadow-slate-900/5 animate-in fade-in zoom-in duration-200 ${
      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
    }`}>
      {/* 顶部工具栏：返回 + 连接式步骤指示器 */}
      <div className={`px-5 sm:px-6 py-3.5 border-b flex items-center gap-3 ${isDark ? 'border-slate-800' : 'border-gray-100'}`}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-800'
          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('quiz.flow.backToList')}
        </button>
        <div className="flex-1" />
        {renderStepper()}
      </div>

      {/* 步骤内容（整页零滚动，各栏内部按需滚动） */}
      <div className={`flex-1 min-h-0 p-5 sm:p-6 overflow-hidden flex flex-col ${
        isDark
          ? 'bg-slate-900'
          : 'bg-gradient-to-b from-gray-50/80 to-gray-50'
      }`} aria-busy={isGenerating}>
        {!canContinue && currentStepIndex === 0 && (
          <div className={`mb-5 shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs ${
            isDark ? 'bg-slate-800 text-slate-400' : 'bg-white text-gray-500 border border-gray-200'
          }`}>
            <Sparkles size={14} className={isDark ? 'text-primary-400' : 'text-primary-500'} aria-hidden="true" />
            {t('quiz.flow.fillTitle', { defaultValue: '请填写标题并选择至少一个知识点开始' })}
          </div>
        )}
        <div className="flex-1 min-h-0">
          {renderStepContent()}
        </div>
      </div>

      {/* 底部导航 */}
      <div className={`px-5 sm:px-6 py-4 border-t flex justify-between items-center gap-3 ${
        isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-white'
      }`}>
        <div className={`text-xs hidden sm:block ${
          cardsLoading ? (isDark ? 'text-slate-500' : 'text-gray-400') : (isDark ? 'text-slate-500' : 'text-gray-500')
        }`}>
          {cardsLoading ? t('quiz.reuse.loading') : t('quiz.flow.footerCounts', { reuse: totalReuse, gap: totalGap })}
        </div>
        <div className="flex flex-1 sm:flex-none sm:justify-end items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => goStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0 || isGenerating}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'
            } ${currentStepIndex === 0 || isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t('quiz.flow.prev')}
          </button>

          {currentStepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => goStep(currentStepIndex + 1)}
              disabled={!canContinue || isGenerating}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold transition-all ${
                canContinue && !isGenerating
                  ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white shadow-lg shadow-primary-500/25 hover:scale-[1.02] active:scale-[0.98]'
                  : isDark ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {t('quiz.flow.next')}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || isGenerating}
              className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold transition-all ${
                canCreate && !isGenerating
                  ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white shadow-lg shadow-primary-500/25 hover:scale-[1.02] active:scale-[0.98]'
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
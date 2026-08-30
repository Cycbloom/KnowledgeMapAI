import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  BrainCircuit,
  Settings,
  AlertCircle,
  Cloud,
  CloudUpload,
  Eye,
  Copy,
  Check,
  GraduationCap,
  BookOpen,
  Mountain,
  Layers,
  CircleDot,
  GitBranch,
  GitMerge,
  Network,
  Plus,
  Minus,
  Wand2,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isCapacitorMobile } from '../../config/mobileApiConfig';
import { mobileAIService } from '../../services/ai';
import { ModalShell } from '../common';

export type GenerateCardsDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type GenerateCardsCoverage =
  | 'current_only'
  | 'with_children'
  | 'with_siblings'
  | 'graph';

export interface GenerateCardsFullConfig {
  count: number;
  types: string[];
  cardsPerType: Partial<Record<string, number>>;
  countPerDifficulty: Partial<Record<'easy' | 'medium' | 'hard', number>>;
  /** 题型×难度二维矩阵（权威配置）：后端每个非零格子=一次独立 AI 调用 */
  countMatrix: Record<string, { easy: number; medium: number; hard: number }>;
  difficulty: GenerateCardsDifficulty;
  coverage: GenerateCardsCoverage;
  customPrompt: string;
}

interface GenerateProgress {
  current: number;
  total: number;
  isGenerating: boolean;
}

interface GraphEdge {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
}

interface GraphNode {
  id: string;
  title: string;
}

interface GenerateCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: GenerateCardsFullConfig & { targetNodeIds: string[] }) => Promise<void>;
  selectedNodes: GraphNode[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  nodeTitle?: string;
  graphId?: string;
  generateProgress?: GenerateProgress | null;
}

const DEFAULT_CARDS_PER_TYPE: Record<string, number> = {
  qa: 4,
  choice: 4,
  true_false: 2,
  multi_choice: 2,
  fill_in_the_blank: 2,
  essay: 1,
  cloze: 3,
  select_from_options: 3,
  matching: 3,
  ordering: 3,
};

const DIFFS_MATRIX: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

const clipInt = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

export const GenerateCardsModal: React.FC<GenerateCardsModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  selectedNodes,
  graphNodes,
  graphEdges,
  nodeTitle,
  graphId,
  generateProgress,
}) => {
  void graphId;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const findParentId = (nodeId: string, edges: GraphEdge[]): string | null => {
    const found = edges.find((e) => e.target_knowledge_point_id === nodeId);
    return found ? found.source_knowledge_point_id : null;
  };

  const getDirectChildrenCount = (nodeId: string, edges: GraphEdge[]): number => {
    return edges.filter((e) => e.source_knowledge_point_id === nodeId).length;
  };

  const getSiblingCount = (nodeId: string, edges: GraphEdge[]): number => {
    const parentId = findParentId(nodeId, edges);
    if (parentId === null) return 0;
    const siblings = edges.filter(
      (e) => e.source_knowledge_point_id === parentId && e.target_knowledge_point_id !== nodeId,
    );
    return siblings.length;
  };

  const [types, setTypes] = useState<string[]>([
    'qa',
    'choice',
    'true_false',
    'multi_choice',
    'fill_in_the_blank',
  ]);

  const [cardsPerType, setCardsPerType] = useState<Partial<Record<string, number>>>(
    { ...DEFAULT_CARDS_PER_TYPE },
  );
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<GenerateCardsDifficulty>('mixed');
  // 当 difficulty === mixed 时启用：easy/medium/hard 的数量（按题目类型展开）
  const [countPerDifficulty, setCountPerDifficulty] = useState<
    Partial<Record<'easy' | 'medium' | 'hard', number>>
  >({ easy: 2, medium: 4, hard: 3 });
  const [coverage, setCoverage] = useState<GenerateCardsCoverage>('current_only');
  const [customPrompt, setCustomPrompt] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileAIConfigured, setIsMobileAIConfigured] = useState(true);

  // 滑杆拖拽起点快照：每次 pointerdown 记录当时的 total + matrix，
  // 防止拖拽过程中 React state 异步导致 base 来回跳、比例缩放错乱。
  type DragAnchor = {
    total: number;
    mode: GenerateCardsDifficulty;
    cells: Array<{ type: string; diff?: 'easy' | 'medium' | 'hard'; value: number }>;
  };
  const dragAnchorRef = useRef<DragAnchor | null>(null);

  const typeSet = useMemo(() => new Set(types), [types]);

  useEffect(() => {
    const mobile = isCapacitorMobile();
    setIsMobile(mobile);
    if (mobile) {
      setIsMobileAIConfigured(mobileAIService.isConfigured());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCustomPrompt('');
      setCopiedPrompt(false);
    }
  }, [isOpen]);

  /**
   * 按当前「模式」计算每种题型在每种难度下的数量矩阵（用于渲染矩阵 & 合计）
   *  - easy/medium/hard 单一难度：矩阵只有一列（所有数量放该难度列），数量来自 cardsPerType
   *  - mixed：矩阵三列均分 cardsPerType；如用户已在 countPerDifficulty 里填值则以 countPerDifficulty 为权重分布
   */
  type Matrix = Record<string, Record<'easy' | 'medium' | 'hard', number>>;

  const matrix = useMemo<Matrix>(() => {
    const baseTotalForType = (tp: string): number =>
      cardsPerType[tp] ?? DEFAULT_CARDS_PER_TYPE[tp] ?? 0;

    const result: Matrix = {} as Matrix;
    for (const tp of types) {
      result[tp] = { easy: 0, medium: 0, hard: 0 };
      const total = baseTotalForType(tp);
      if (difficulty === 'easy') {
        result[tp].easy = total;
        continue;
      }
      if (difficulty === 'medium') {
        result[tp].medium = total;
        continue;
      }
      if (difficulty === 'hard') {
        result[tp].hard = total;
        continue;
      }
      // mixed：按 countPerDifficulty 权重分配
      const weights: Array<['easy' | 'medium' | 'hard', number]> = [
        ['easy', countPerDifficulty.easy ?? 0],
        ['medium', countPerDifficulty.medium ?? 0],
        ['hard', countPerDifficulty.hard ?? 0],
      ];
      const weightSum = weights.reduce((s, [, w]) => s + w, 0);
      let remaining = total;
      if (weightSum <= 0) {
        // 无权重 -> 均分
        for (let i = 0; i < weights.length; i++) {
          const [diff] = weights[i];
          const c =
            i === weights.length - 1
              ? remaining
              : Math.max(0, Math.round(total / weights.length));
          result[tp][diff] = c;
          remaining -= c;
        }
      } else {
        for (let i = 0; i < weights.length; i++) {
          const [diff, w] = weights[i];
          const c =
            i === weights.length - 1
              ? remaining
              : Math.max(0, Math.round((w / weightSum) * total));
          result[tp][diff] = c;
          remaining -= c;
        }
      }
    }
    return result;
  }, [types, cardsPerType, difficulty, countPerDifficulty]);

  // 各汇总：type 合计、difficulty 合计、grand 合计
  const rowTotals = useMemo(() => {
    const r: Record<string, number> = {};
    for (const tp of types) {
      r[tp] = (matrix[tp]?.easy ?? 0) + (matrix[tp]?.medium ?? 0) + (matrix[tp]?.hard ?? 0);
    }
    return r;
  }, [types, matrix]);

  const colTotals = useMemo(() => {
    const r = { easy: 0, medium: 0, hard: 0 };
    for (const tp of types) {
      r.easy += matrix[tp]?.easy ?? 0;
      r.medium += matrix[tp]?.medium ?? 0;
      r.hard += matrix[tp]?.hard ?? 0;
    }
    return r;
  }, [types, matrix]);

  const grandTotal = colTotals.easy + colTotals.medium + colTotals.hard;

  const multiSelectedHeaderLabel = useMemo(() => {
    const nCount = selectedNodes.length;
    if (nCount <= 1) return '';
    const total = grandTotal || count;
    if (total <= 0) return t('study.generateCards.multiSelectedHeaderEmpty', { count: nCount });
    return t('study.generateCards.multiSelectedHeader', {
      count: nCount,
      total,
      product: nCount * total,
    });
  }, [selectedNodes.length, grandTotal, count, t]);

  // 总题数 <-> cardsPerType / matrix 双向同步：slider 调时按比例重分配，
  // 误差用「最大余数法（Hamilton）」分摊，避免所有增量堆到最后一行/最后一列。
  // 若拖拽中，优先使用 pointerdown 时记录的 anchor（固定快照）作为缩放基准，
  // 避免 React state 异步未 commit 导致 base/ratio 抖动。
  const syncTotalToPerType = (nextTotal: number): void => {
    const anchor = dragAnchorRef.current;
    let useAnchor = false;
    if (anchor && anchor.total > 0 && anchor.mode === difficulty) {
      // anchor 的 types 要与当前一致（拖拽中不会突然变 types）
      const anchorTypes = anchor.cells.map((c) => c.type);
      useAnchor =
        anchorTypes.length === types.length &&
        anchorTypes.every((t) => types.includes(t));
    }

    const baseTotal = useAnchor ? (anchor as DragAnchor).total : Math.max(1, grandTotal || 1);
    const ratio = nextTotal / baseTotal;

    if (difficulty === 'mixed') {
      // -------- mixed：按矩阵所有单元格比例缩放 --------
      type Cell = { type: string; diff: 'easy' | 'medium' | 'hard'; floor: number; frac: number };
      const cells: Cell[] = [];
      let sumFloor = 0;
      if (useAnchor && anchor) {
        for (const c of anchor.cells) {
          if (!c.diff) continue;
          const raw = (c.value || 0) * ratio;
          const floor = Math.floor(raw);
          cells.push({ type: c.type, diff: c.diff, floor, frac: raw - floor });
          sumFloor += floor;
        }
      } else {
        for (const tp of types) {
          (['easy', 'medium', 'hard'] as const).forEach((diff) => {
            const raw = (matrix[tp]?.[diff] ?? 0) * ratio;
            const floor = Math.floor(raw);
            cells.push({ type: tp, diff, floor, frac: raw - floor });
            sumFloor += floor;
          });
        }
      }
      // 按 frac 降序排列，把剩余题目逐个分配给「小数部分最大」的单元格
      let remainder = nextTotal - sumFloor;
      cells.sort((a, b) => b.frac - a.frac);
      let idx = 0;
      while (remainder > 0 && idx < cells.length) {
        cells[idx].floor += 1;
        remainder -= 1;
        idx += 1;
      }
      // 写回矩阵、行和、列和
      const nextMatrix: Matrix = {} as Matrix;
      for (const tp of types) nextMatrix[tp] = { easy: 0, medium: 0, hard: 0 };
      for (const c of cells) {
        nextMatrix[c.type][c.diff] = c.floor;
      }
      const nextCardsPerType: Partial<Record<string, number>> = {};
      const nextColTotals: Partial<Record<'easy' | 'medium' | 'hard', number>> = { easy: 0, medium: 0, hard: 0 };
      for (const tp of types) {
        nextCardsPerType[tp] = nextMatrix[tp].easy + nextMatrix[tp].medium + nextMatrix[tp].hard;
      }
      for (const c of cells) {
        nextColTotals[c.diff] = (nextColTotals[c.diff] ?? 0) + c.floor;
      }
      setCardsPerType((prev) => ({ ...prev, ...nextCardsPerType }));
      setCountPerDifficulty(nextColTotals);
    } else {
      // -------- 单一难度：按 cardsPerType 行合计比例缩放 --------
      type Row = { type: string; floor: number; frac: number };
      const rows: Row[] = [];
      let sumFloor = 0;
      if (useAnchor && anchor) {
        for (const c of anchor.cells) {
          const raw = (c.value || 0) * ratio;
          const floor = Math.floor(raw);
          rows.push({ type: c.type, floor, frac: raw - floor });
          sumFloor += floor;
        }
      } else {
        for (const tp of types) {
          const base = (rowTotals[tp] ?? cardsPerType[tp] ?? DEFAULT_CARDS_PER_TYPE[tp] ?? 0);
          const raw = base * ratio;
          const floor = Math.floor(raw);
          rows.push({ type: tp, floor, frac: raw - floor });
          sumFloor += floor;
        }
      }
      let remainder = nextTotal - sumFloor;
      rows.sort((a, b) => b.frac - a.frac);
      let idx = 0;
      while (remainder > 0 && idx < rows.length) {
        rows[idx].floor += 1;
        remainder -= 1;
        idx += 1;
      }
      const nextCardsPerType: Partial<Record<string, number>> = {};
      for (const r of rows) nextCardsPerType[r.type] = r.floor;
      setCardsPerType((prev) => ({ ...prev, ...nextCardsPerType }));
    }
    setCount(nextTotal);
  };

  // 捕获/释放拖拽基准快照
  const captureSliderAnchor = (): void => {
    if (difficulty === 'mixed') {
      const cells: DragAnchor['cells'] = [];
      for (const tp of types) {
        cells.push({ type: tp, diff: 'easy', value: matrix[tp]?.easy ?? 0 });
        cells.push({ type: tp, diff: 'medium', value: matrix[tp]?.medium ?? 0 });
        cells.push({ type: tp, diff: 'hard', value: matrix[tp]?.hard ?? 0 });
      }
      dragAnchorRef.current = { total: grandTotal || count, mode: difficulty, cells };
    } else {
      const cells: DragAnchor['cells'] = types.map((tp) => ({
        type: tp,
        value: rowTotals[tp] ?? cardsPerType[tp] ?? DEFAULT_CARDS_PER_TYPE[tp] ?? 0,
      }));
      dragAnchorRef.current = { total: grandTotal || count, mode: difficulty, cells };
    }
  };
  const releaseSliderAnchor = (): void => {
    dragAnchorRef.current = null;
  };

  // 更新矩阵单元格（type × difficulty）：只调整该 type 在该 diff 列的数量，其他列保持。
  const updateCell = (typeId: string, diff: 'easy' | 'medium' | 'hard', nextValue: number): void => {
    // 单一难度模式下，调整此单元格 = 直接调整 cardsPerType
    if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
      setCardsPerType((prev) => ({ ...prev, [typeId]: clipInt(nextValue, 0, 30) }));
      return;
    }
    // mixed 模式：重新根据当前矩阵计算 cardsPerType（即行和），
    // 同时把「修改难度列的相对占比」同步到 countPerDifficulty，
    // 这样后续切换类型或调整总数时权重保持一致。
    const nextMatrix: Matrix = JSON.parse(JSON.stringify(matrix));
    nextMatrix[typeId][diff] = clipInt(nextValue, 0, 30);
    // 行和 -> cardsPerType[typeId]
    const rowSum = nextMatrix[typeId].easy + nextMatrix[typeId].medium + nextMatrix[typeId].hard;
    setCardsPerType((prev) => ({ ...prev, [typeId]: rowSum }));

    // 列和(对所有 type 相加) -> 作为新的 countPerDifficulty 权重
    const colSum = { easy: 0, medium: 0, hard: 0 };
    for (const tp of Object.keys(nextMatrix)) {
      colSum.easy += nextMatrix[tp].easy;
      colSum.medium += nextMatrix[tp].medium;
      colSum.hard += nextMatrix[tp].hard;
    }
    setCountPerDifficulty(colSum);
  };

  const targetNodeIds = useMemo((): string[] => {
    return selectedNodes.map((n) => n.id);
  }, [selectedNodes]);

  const cardTypes: Array<{ id: string; label: string; descKey: string }> = [
    { id: 'qa', label: t('learning.generateCards.typeQA'), descKey: 'learning.generateCards.typeDescQA' },
    { id: 'choice', label: t('learning.generateCards.typeChoice'), descKey: 'learning.generateCards.typeDescChoice' },
    { id: 'true_false', label: t('learning.generateCards.typeTrueFalse'), descKey: 'learning.generateCards.typeDescTrueFalse' },
    { id: 'multi_choice', label: t('learning.generateCards.typeMultiChoice'), descKey: 'learning.generateCards.typeDescMultiChoice' },
    { id: 'fill_in_the_blank', label: t('learning.generateCards.typeFillBlank'), descKey: 'learning.generateCards.typeDescFillBlank' },
    { id: 'essay', label: t('learning.generateCards.typeEssay'), descKey: 'learning.generateCards.typeDescEssay' },
    { id: 'cloze', label: t('learning.generateCards.typeCloze'), descKey: 'learning.generateCards.typeDescCloze' },
    { id: 'select_from_options', label: t('learning.generateCards.typeSelectFromOptions'), descKey: 'learning.generateCards.typeDescSelectFromOptions' },
    { id: 'matching', label: t('learning.generateCards.typeMatching'), descKey: 'learning.generateCards.typeDescMatching' },
    { id: 'ordering', label: t('learning.generateCards.typeOrdering'), descKey: 'learning.generateCards.typeDescOrdering' },
  ];

  const difficultyOptions: Array<{
    id: GenerateCardsDifficulty;
    label: string;
    desc: string;
    icon: React.ReactNode;
    activeRing: string;
    activeBg: string;
    text: string;
  }> = [
    {
      id: 'easy',
      label: t('learning.generateCards.difficultyEasy'),
      desc: t('learning.generateCards.difficultyEasyDesc'),
      icon: <GraduationCap size={16} />,
      activeRing: 'ring-green-500 border-green-500',
      activeBg: 'bg-green-50 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
    },
    {
      id: 'medium',
      label: t('learning.generateCards.difficultyMedium'),
      desc: t('learning.generateCards.difficultyMediumDesc'),
      icon: <BookOpen size={16} />,
      activeRing: 'ring-orange-500 border-orange-500',
      activeBg: 'bg-orange-50 dark:bg-orange-900/30',
      text: 'text-orange-600 dark:text-orange-400',
    },
    {
      id: 'hard',
      label: t('learning.generateCards.difficultyHard'),
      desc: t('learning.generateCards.difficultyHardDesc'),
      icon: <Mountain size={16} />,
      activeRing: 'ring-red-500 border-red-500',
      activeBg: 'bg-red-50 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
    },
    {
      id: 'mixed',
      label: t('learning.generateCards.difficultyMixed'),
      desc: t('learning.generateCards.difficultyMixedDesc'),
      icon: <Layers size={16} />,
      activeRing: 'ring-primary-500 border-primary-500',
      activeBg: 'bg-primary-50 dark:bg-primary-900/30',
      text: 'text-primary-600 dark:text-primary-400',
    },
  ];

  const coverageCounts = useMemo(() => {
    const childrenCounts: number[] = [];
    const siblingCounts: number[] = [];
    const combinedCounts: number[] = [];
    selectedNodes.forEach((n) => {
      const cc = getDirectChildrenCount(n.id, graphEdges);
      const sc = getSiblingCount(n.id, graphEdges);
      childrenCounts.push(cc);
      siblingCounts.push(sc);
      combinedCounts.push(cc + sc);
    });
    return { childrenCounts, siblingCounts, combinedCounts };
  }, [selectedNodes, graphEdges]);

  const formatCoverageCount = (
    counts: number[],
    kind: 'children' | 'sibling' | 'combined',
  ): string | undefined => {
    if (counts.length === 0) return undefined;
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (min === max) {
      const n = min;
      if (kind === 'children') return t('study.generateCoverage.childrenCount', { count: n });
      if (kind === 'sibling') return t('study.generateCoverage.siblingCount', { count: n });
      return t('study.generateCoverage.combinedCount', { count: n });
    }
    return t('study.generateCoverage.contextRange', { min, max });
  };

  const coverageOptions: Array<{
    id: GenerateCardsCoverage;
    label: string;
    desc: string;
    countBadge: string | undefined;
    rawCount: number | undefined;
    disabled: boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: 'current_only',
      label: t('learning.generateCards.coverageCurrentOnly'),
      desc: t('learning.generateCards.coverageCurrentOnlyDesc'),
      countBadge:
        selectedNodes.length === 1
          ? t('learning.generateCards.coverageNodeCount', { count: 1 })
          : selectedNodes.length > 1
            ? t('learning.generateCards.coverageNodeCount', { count: selectedNodes.length })
            : undefined,
      rawCount: selectedNodes.length > 0 ? selectedNodes.length : undefined,
      disabled: selectedNodes.length === 0,
      icon: <CircleDot size={16} />,
    },
    {
      id: 'with_children',
      label: t('learning.generateCards.coverageWithChildren'),
      desc: t('learning.generateCards.coverageWithChildrenDesc'),
      countBadge: formatCoverageCount(coverageCounts.childrenCounts, 'children'),
      rawCount:
        coverageCounts.childrenCounts.length > 0 ? Math.max(...coverageCounts.childrenCounts) : 0,
      disabled: selectedNodes.length === 0,
      icon: <GitBranch size={16} />,
    },
    {
      id: 'with_siblings',
      label: t('learning.generateCards.coverageWithSiblings'),
      desc: t('learning.generateCards.coverageWithSiblingsDesc'),
      countBadge: formatCoverageCount(coverageCounts.siblingCounts, 'sibling'),
      rawCount:
        coverageCounts.siblingCounts.length > 0 ? Math.max(...coverageCounts.siblingCounts) : 0,
      disabled: selectedNodes.length === 0,
      icon: <GitMerge size={16} />,
    },
    {
      id: 'graph',
      label: t('learning.generateCards.coverageGraph'),
      desc: t('learning.generateCards.coverageGraphDesc'),
      countBadge:
        graphNodes.length > 0
          ? t('study.generateCoverage.contextCount', { count: graphNodes.length })
          : undefined,
      rawCount: graphNodes.length > 0 ? graphNodes.length : undefined,
      disabled: graphNodes.length === 0 || selectedNodes.length === 0,
      icon: <Network size={16} />,
    },
  ];

  // 生成参数概览（结构化，总是显示；是实际会注入到 AI 上下文中的参数）
  const paramSummary = useMemo((): string => {
    const questionTypesList = cardTypes
      .filter((c) => typeSet.has(c.id))
      .map((c) => c.label)
      .join('、');
    const matrixPreview = types
      .map((tp) => {
        const tpLabel = cardTypes.find((c) => c.id === tp)?.label ?? tp;
        if (difficulty === 'mixed') {
          return `${tpLabel}(简×${matrix[tp]?.easy ?? 0}/中×${matrix[tp]?.medium ?? 0}/难×${
            matrix[tp]?.hard ?? 0
          })`;
        }
        return `${tpLabel}×${rowTotals[tp] ?? 0}`;
      })
      .join('、');

    const coverageLabel =
      coverageOptions.find((o) => o.id === coverage)?.label ?? coverage;
    const difficultyLabel =
      difficultyOptions.find((o) => o.id === difficulty)?.label ?? difficulty;

    const displayTitle =
      selectedNodes.length === 1
        ? nodeTitle ?? selectedNodes[0]?.title ?? ''
        : multiSelectedHeaderLabel;

    return [
      `- ${t('learning.generateCards.promptPreviewTopic')}：${displayTitle || '-'}`,
      `- ${t('learning.generateCards.promptPreviewTotalCount')}：${grandTotal || count}`,
      `- ${t('learning.generateCards.promptPreviewTypes')}：${questionTypesList || t('learning.generateCards.fallbackAllTypes')}`,
      `- ${t('learning.generateCards.promptPreviewMatrix')}：${matrixPreview || '-'}`,
      `- ${t('learning.generateCards.promptPreviewDifficulty')}：${difficultyLabel}  [简 ${colTotals.easy} / 中 ${colTotals.medium} / 难 ${colTotals.hard}]`,
      `- ${t('learning.generateCards.promptPreviewCoverage')}：${coverageLabel}（${t('learning.generateCards.promptPreviewNodeCount', { count: targetNodeIds.length })}）`,
    ].join('\n');
  }, [
    selectedNodes,
    nodeTitle,
    grandTotal,
    count,
    cardTypes,
    typeSet,
    types,
    matrix,
    rowTotals,
    colTotals,
    difficulty,
    coverage,
    coverageOptions,
    difficultyOptions,
    targetNodeIds.length,
    t,
  ]);

  // 自定义提示词渲染结果（仅当用户填写时才有值）
  const customPromptRendered = useMemo((): string | null => {
    const trimmed = customPrompt.trim();
    if (!trimmed) return null;
    const questionTypesList = cardTypes
      .filter((c) => typeSet.has(c.id))
      .map((c) => c.label)
      .join('、');
    const matrixPreview = types
      .map((tp) => {
        const tpLabel = cardTypes.find((c) => c.id === tp)?.label ?? tp;
        if (difficulty === 'mixed') {
          return `${tpLabel}(简×${matrix[tp]?.easy ?? 0}/中×${matrix[tp]?.medium ?? 0}/难×${
            matrix[tp]?.hard ?? 0
          })`;
        }
        return `${tpLabel}×${rowTotals[tp] ?? 0}`;
      })
      .join('、');

    const coverageLabel =
      coverageOptions.find((o) => o.id === coverage)?.label ?? coverage;
    const difficultyLabel =
      difficultyOptions.find((o) => o.id === difficulty)?.label ?? difficulty;

    const promptTopic =
      selectedNodes.length === 1
        ? nodeTitle ?? selectedNodes[0]?.title ?? ''
        : multiSelectedHeaderLabel;

    return trimmed
      .replaceAll('{{topic}}', promptTopic)
      .replaceAll('{{count}}', String(grandTotal || count))
      .replaceAll('{{types}}', questionTypesList || t('learning.generateCards.fallbackAllTypes'))
      .replaceAll('{{matrix}}', matrixPreview || '-')
      .replaceAll('{{cardsPerType}}', matrixPreview || '-')
      .replaceAll('{{difficulty}}', difficultyLabel)
      .replaceAll('{{coverage}}', coverageLabel)
      .replaceAll('{{targetNodeCount}}', String(targetNodeIds.length))
      .replaceAll('{{nodeCount}}', String(targetNodeIds.length))
      .replaceAll('{{content}}', `「${t('learning.generateCards.promptContentHint')}」`);
  }, [
    customPrompt,
    selectedNodes,
    nodeTitle,
    grandTotal,
    count,
    cardTypes,
    typeSet,
    types,
    matrix,
    rowTotals,
    difficulty,
    coverage,
    coverageOptions,
    difficultyOptions,
    targetNodeIds.length,
    t,
  ]);

  // 给"复制预览"按钮复制的文本：参数 + (自定义渲染 or 默认模板声明)
  const promptCopyPayload = useMemo((): string => {
    if (customPromptRendered) {
      return [
        `# ${t('learning.generateCards.promptSummaryTitle')}`,
        paramSummary,
        '',
        `# ${t('learning.generateCards.promptCustomTitle')}`,
        customPromptRendered,
      ].join('\n');
    }
    return [
      `# ${t('learning.generateCards.promptSummaryTitle')}`,
      paramSummary,
      '',
      `# ${t('learning.generateCards.promptUsingDefaultTitle')}`,
      t('learning.generateCards.promptUsingDefaultHint'),
    ].join('\n');
  }, [paramSummary, customPromptRendered, t]);

  const handleToggleType = (typeId: string): void => {
    setTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId],
    );
    setCardsPerType((prev) => {
      if (prev[typeId]) return prev;
      return { ...prev, [typeId]: DEFAULT_CARDS_PER_TYPE[typeId] ?? 3 };
    });
  };

  // 预设：一键把 matrix 填成常见配比
  const applyPreset = (
    preset: 'balanced' | 'memory' | 'exam',
  ): void => {
    const typesArr = ['choice', 'true_false', 'qa', 'multi_choice', 'fill_in_the_blank', 'essay'];
    const presets: Record<typeof preset, Record<string, number>> = {
      balanced: { choice: 5, true_false: 3, qa: 3, multi_choice: 2, fill_in_the_blank: 2, essay: 1 },
      memory: { true_false: 4, fill_in_the_blank: 4, choice: 3, qa: 2, multi_choice: 2, essay: 1 },
      exam: { choice: 6, multi_choice: 4, essay: 3, true_false: 3, qa: 2, fill_in_the_blank: 2 },
    };
    const nextCardsPerType: Partial<Record<string, number>> = { ...cardsPerType };
    const selectedTypes = types.length > 0 ? types : typesArr;
    for (const tp of selectedTypes) {
      nextCardsPerType[tp] = presets[preset][tp] ?? 2;
    }
    setCardsPerType(nextCardsPerType);

    if (preset === 'balanced') {
      setDifficulty('mixed');
      setCountPerDifficulty({ easy: 3, medium: 8, hard: 3 });
    } else if (preset === 'memory') {
      setDifficulty('easy');
    } else if (preset === 'exam') {
      setDifficulty('medium');
    }
  };

  const handleGoToSettings = (): void => {
    onClose();
    navigate('/settings#prompts');
  };

  const handleCopyPrompt = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(promptCopyPayload);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 1500);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (types.length === 0) return;
    if (grandTotal <= 0) return;
    if (isMobile && !isMobileAIConfigured) return;
    if (targetNodeIds.length === 0 && !isMobile) return;

    setIsLoading(true);
    try {
      // 深拷贝矩阵，只保留选中题型、剔除全零行，避免引用泄漏
      const countMatrix: Record<string, { easy: number; medium: number; hard: number }> = {};
      for (const tp of types) {
        const cell = matrix[tp];
        if (!cell) continue;
        const easy = cell.easy ?? 0;
        const medium = cell.medium ?? 0;
        const hard = cell.hard ?? 0;
        if (easy > 0 || medium > 0 || hard > 0) {
          countMatrix[tp] = { easy, medium, hard };
        }
      }

      await onGenerate({
        count: grandTotal,
        types,
        cardsPerType,
        countPerDifficulty: { ...countPerDifficulty },
        countMatrix,
        difficulty,
        coverage,
        customPrompt: customPrompt.trim() || '',
        targetNodeIds,
      });
      if (!isMobile) {
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isGenerating = isLoading || (generateProgress?.isGenerating ?? false);
  const progressPercent = generateProgress
    ? Math.round((generateProgress.current / generateProgress.total) * 100)
    : 0;

  if (!isOpen) return null;

  const colTotalsWeight =
    (countPerDifficulty.easy ?? 0) + (countPerDifficulty.medium ?? 0) + (countPerDifficulty.hard ?? 0);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titleId="generate-cards-modal-title"
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800 max-h-[88vh] flex flex-col"
      overlayClassName="z-modal-overlay p-3 sm:p-6 backdrop-blur-sm"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 min-w-0">
            <BrainCircuit size={22} className="shrink-0" />
            <div className="min-w-0">
              <h3 id="generate-cards-modal-title" className="text-lg font-bold truncate">
                {t('learning.generateCards.title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {selectedNodes.length === 1 ? (
                  t('learning.generateCards.configuring', {
                    title: nodeTitle ?? selectedNodes[0]?.title ?? '',
                  })
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span>{multiSelectedHeaderLabel}</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 text-[10px] font-bold tabular-nums">
                      {selectedNodes.length}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleGoToSettings}
              aria-label={t('learning.generateCards.promptConfigTooltip')}
              title={t('learning.generateCards.promptConfigTooltip')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
            <button
              onClick={onClose}
              aria-label={t('common.aria.close')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* 左右布局：左=题型×难度矩阵；右=覆盖范围+提示词预览+高级配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 flex-1 min-h-0 overflow-hidden">
        <section className="lg:col-span-3 p-5 overflow-y-auto border-r-0 lg:border-r border-slate-100 dark:border-slate-800 space-y-5 min-h-0">
          {/* 顶部：题型多选 + 预设 + 总题数滑杆 + 全局难度 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                <span className="w-1.5 h-4 bg-primary-500 rounded-full" />
                {t('learning.generateCards.typeSelect')}
                <span className="ml-auto text-xs font-normal text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Wand2 size={12} />
                  {t('learning.generateCards.presetLabel')}：
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset('balanced')}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 hover:bg-primary-100 font-bold"
                >
                  {t('learning.generateCards.presetBalanced')}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('memory')}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100 font-bold"
                >
                  {t('learning.generateCards.presetMemory')}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('exam')}
                  className="px-2 py-0.5 text-[11px] rounded-md bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-100 font-bold"
                >
                  {t('learning.generateCards.presetExam')}
                </button>
              </label>
              <div className="flex flex-wrap gap-2">
                {cardTypes.map((ct) => {
                  const selected = typeSet.has(ct.id);
                  return (
                    <button
                      type="button"
                      key={ct.id}
                      onClick={() => handleToggleType(ct.id)}
                      className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-colors ${
                        selected
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-400'
                          : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                      title={t(ct.descKey as never)}
                    >
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 总题数（grand total，与矩阵合计双向同步） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-primary-500 rounded-full" />
                  {t('learning.generateCards.countLabel')}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => syncTotalToPerType(clipInt((grandTotal || count) - 1, 1, 60))}
                    disabled={grandTotal <= 1}
                    className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40 inline-flex items-center justify-center"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[64px] text-center px-3 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full text-sm font-bold">
                    {grandTotal || count}
                  </span>
                  <button
                    type="button"
                    onClick={() => syncTotalToPerType(clipInt((grandTotal || count) + 1, 1, 60))}
                    disabled={grandTotal >= 60}
                    className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40 inline-flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={clipInt(grandTotal || count, 1, 60)}
                onPointerDown={captureSliderAnchor}
                onPointerUp={releaseSliderAnchor}
                onPointerCancel={releaseSliderAnchor}
                onTouchStart={captureSliderAnchor}
                onTouchEnd={releaseSliderAnchor}
                onTouchCancel={releaseSliderAnchor}
                onMouseUp={releaseSliderAnchor}
                onBlur={releaseSliderAnchor}
                onChange={(e) => syncTotalToPerType(clipInt(parseInt(e.target.value, 10), 1, 60))}
                aria-label={t('learning.generateCards.countLabel')}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600 touch-none"
              />
              <div className="relative w-full h-4 mt-1 font-medium">
                {/* 1-15-30-60 非等距刻度，按 1..60 的真实百分比摆放 */}
                {([1, 15, 30, 60] as const).map((v) => {
                  const pct = ((v - 1) / (60 - 1)) * 100;
                  return (
                    <span
                      key={v}
                      className="absolute top-0 text-[10px] text-slate-400"
                      style={{
                        left: `${pct}%`,
                        transform:
                          v === 1
                            ? 'translateX(0)'
                            : v === 60
                              ? 'translateX(-100%)'
                              : 'translateX(-50%)',
                      }}
                    >
                      {v}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 全局难度 */}
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                <span className="w-1.5 h-4 bg-primary-500 rounded-full" />
                {t('learning.generateCards.difficultySelect')}
                <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 inline-flex items-center gap-1 font-normal">
                  <ArrowRightLeft size={12} />
                  {t('learning.generateCards.difficultyHint')}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {difficultyOptions.map((option) => {
                  const isSelected = difficulty === option.id;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setDifficulty(option.id)}
                      className={`text-left rounded-xl border-2 p-2.5 transition-all ${
                        isSelected
                          ? `${option.activeRing} ${option.activeBg} ring-1`
                          : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={isSelected ? option.text : 'text-slate-400 dark:text-slate-500'}>
                          {option.icon}
                        </span>
                        <span className={`text-sm font-bold ${isSelected ? option.text : 'text-slate-700 dark:text-slate-300'}`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {option.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 题型 × 难度 矩阵 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-primary-500 rounded-full" />
                {t('learning.generateCards.matrixTitle')}
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t('learning.generateCards.matrixHint')}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold w-32">
                        {t('learning.generateCards.matrixHeaderType')}
                      </th>
                      {difficulty === 'mixed'
                        ? DIFFS_MATRIX.map((d) => (
                            <th key={d} className="px-2 py-2 font-bold text-center">
                              <span className={`inline-flex items-center gap-1 ${
                                d === 'easy' ? 'text-green-600 dark:text-green-400'
                                  : d === 'medium' ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-red-600 dark:text-red-400'
                              }`}>
                                {d === 'easy' ? <GraduationCap size={12} /> : d === 'medium' ? <BookOpen size={12} /> : <Mountain size={12} />}
                                {d === 'easy'
                                  ? t('learning.generateCards.difficultyEasyShort')
                                  : d === 'medium'
                                    ? t('learning.generateCards.difficultyMediumShort')
                                    : t('learning.generateCards.difficultyHardShort')}
                              </span>
                              <div className="text-[10px] font-normal mt-0.5 text-slate-400 dark:text-slate-500">
                                {t('learning.generateCards.matrixWeight', {
                                  value: countPerDifficulty[d] ?? 0,
                                  total: colTotalsWeight || 1,
                                })}
                              </div>
                            </th>
                          ))
                        : (
                          <th className="px-2 py-2 font-bold text-center">
                            <span className={`inline-flex items-center gap-1 ${
                              difficulty === 'easy' ? 'text-green-600 dark:text-green-400'
                                : difficulty === 'medium' ? 'text-orange-600 dark:text-orange-400'
                                  : difficulty === 'hard' ? 'text-red-600 dark:text-red-400'
                                    : 'text-primary-600 dark:text-primary-400'
                            }`}>
                              {difficultyOptions.find((o) => o.id === difficulty)?.icon}
                              {t('learning.generateCards.matrixSingleDifficultyCol', {
                                difficulty: difficultyOptions.find((o) => o.id === difficulty)?.label ?? difficulty,
                              })}
                            </span>
                          </th>
                        )}
                      <th className="px-3 py-2 font-bold text-right w-24">
                        {t('learning.generateCards.matrixRowTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.length === 0 ? (
                      <tr>
                        <td colSpan={difficulty === 'mixed' ? 5 : 3} className="px-3 py-8 text-center text-slate-400">
                          {t('learning.generateCards.noTypeSelected')}
                        </td>
                      </tr>
                    ) : (
                      types.map((tp) => {
                        const ct = cardTypes.find((c) => c.id === tp);
                        const rowTotal = rowTotals[tp] ?? 0;
                        const cells =
                          difficulty === 'mixed'
                            ? DIFFS_MATRIX.map((d) => ({
                                key: d,
                                value: matrix[tp]?.[d] ?? 0,
                              }))
                            : [{ key: difficulty, value: rowTotal }];
                        return (
                          <tr
                            key={tp}
                            className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                              {ct?.label ?? tp}
                              <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                                {t((ct?.descKey ?? '') as never)}
                              </div>
                            </td>
                            {cells.map((c) => (
                              <td key={c.key} className="px-2 py-2 text-center">
                                <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1">
                                  <button
                                    type="button"
                                    onClick={() => updateCell(tp, c.key as 'easy' | 'medium' | 'hard', c.value - 1)}
                                    disabled={c.value <= 0}
                                    className="w-6 h-6 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-40 inline-flex items-center justify-center"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-6 text-center font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                                    {c.value}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateCell(tp, c.key as 'easy' | 'medium' | 'hard', c.value + 1)}
                                    disabled={c.value >= 20}
                                    className="w-6 h-6 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-900 disabled:opacity-40 inline-flex items-center justify-center"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 text-[11px] font-bold tabular-nums">
                                {rowTotal}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 font-bold">
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {t('learning.generateCards.matrixColTotal')}
                      </td>
                      {difficulty === 'mixed' ? (
                        DIFFS_MATRIX.map((d) => (
                          <td key={d} className="px-2 py-2 text-center tabular-nums">
                            <span className={`${
                              d === 'easy' ? 'text-green-600 dark:text-green-400'
                                : d === 'medium' ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}>
                              {colTotals[d]}
                            </span>
                          </td>
                        ))
                      ) : (
                        <td className="px-2 py-2 text-center tabular-nums text-primary-600 dark:text-primary-400">
                          {grandTotal}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gradient-to-r from-primary-500 to-violet-500 text-white text-[11px] font-bold">
                          {t('learning.generateCards.grandTotal', { count: grandTotal })}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* 右栏：覆盖范围 + 提示词预览 + 自定义 prompt */}
        <aside className="lg:col-span-2 p-5 overflow-y-auto space-y-5 bg-slate-50/70 dark:bg-slate-900/60 min-h-0">
          {/* 覆盖范围 */}
          {graphNodes.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-primary-500 rounded-full" />
                {t('learning.generateCards.coverageSelect')}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {coverageOptions.map((option) => {
                  const isSelected = coverage === option.id;
                  const disabled = option.disabled;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      disabled={disabled}
                      onClick={() => setCoverage(option.id)}
                      className={`text-left rounded-xl border-2 p-2.5 transition-all ${
                        disabled
                          ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 opacity-50 cursor-not-allowed'
                          : isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400 ring-1 ring-primary-500'
                            : 'border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800 bg-white dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={
                          isSelected
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }>
                          {option.icon}
                        </span>
                        <span className={`text-sm font-bold ${
                          isSelected
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {option.label}
                        </span>
                        {option.countBadge ? (
                          <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {option.countBadge}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {option.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* 生成参数 + 提示词预览：分两块展示，空状态不塞占位文字进正文 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Eye size={14} className="text-slate-400" />
                {t('learning.generateCards.promptPreviewLabel')}
              </label>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {copiedPrompt ? (
                  <>
                    <Check size={12} />
                    {t('learning.generateCards.promptCopied')}
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    {t('learning.generateCards.promptCopy')}
                  </>
                )}
              </button>
            </div>

            {/* 1. 生成参数（结构化） */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/60 flex items-center gap-1.5">
                <Settings size={12} />
                {t('learning.generateCards.promptSummaryTitle')}
              </div>
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed p-3 font-mono text-slate-600 dark:text-slate-300">
                {paramSummary}
              </pre>
            </div>

            {/* 2. 自定义提示词预览 / 默认模板说明 */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className={`px-3 py-1.5 text-[11px] font-bold border-b border-slate-200/70 dark:border-slate-700/60 flex items-center gap-1.5 ${
                customPromptRendered
                  ? 'text-primary-700 dark:text-primary-300 bg-primary-50/60 dark:bg-primary-900/20'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {customPromptRendered ? (
                  <><Sparkles size={12} />{t('learning.generateCards.promptCustomTitle')}</>
                ) : (
                  <><FileText size={12} />{t('learning.generateCards.promptUsingDefaultTitle')}</>
                )}
              </div>
              {customPromptRendered ? (
                <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed p-3 max-h-56 overflow-y-auto font-mono text-slate-700 dark:text-slate-200">
                  {customPromptRendered}
                </pre>
              ) : (
                <div className="p-3 space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                    <Layers size={11} />
                    {'System → User → Graph'}
                    <span className="mx-1 text-slate-400/80">·</span>
                    {'Graph > User > System'}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('learning.generateCards.promptUsingDefaultHint')}
                  </p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              {t('learning.generateCards.promptPreviewHint')}
            </p>
          </div>

          {/* 自定义 prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('learning.generateCards.customPromptLabel')}
                {customPrompt.trim() ? (
                  <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold align-middle">
                    {t('learning.generateCards.advancedCustomPromptEnabled')}
                  </span>
                ) : null}
              </label>
              <button
                type="button"
                onClick={handleGoToSettings}
                className="text-[11px] text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1"
              >
                <Settings size={12} />
                {t('learning.generateCards.promptGoToConfig')}
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t('learning.generateCards.customPromptPlaceholder')}
              disabled={isGenerating}
              rows={5}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:border-primary-500 outline-none resize-y"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
              {t('learning.generateCards.customPromptHint')}
            </p>
          </div>

          {/* 提示 */}
          {isMobile && !isMobileAIConfigured ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-3.5 rounded-xl border border-red-100 dark:border-red-900/30 text-xs text-red-700 dark:text-red-400 flex gap-3">
              <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full h-fit mt-0.5 shrink-0">
                <AlertCircle size={12} className="text-red-600 dark:text-red-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1">{t('learning.generateCards.configureApiKey')}</p>
                <p className="leading-relaxed opacity-80">
                  {t('learning.generateCards.mobileAIRequired')}
                </p>
              </div>
            </div>
          ) : (
            <div
              className={`p-3.5 rounded-xl border text-xs flex gap-3 ${
                isMobile
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}
            >
              <div
                className={`p-1 rounded-full h-fit mt-0.5 shrink-0 ${
                  isMobile
                    ? 'bg-primary-100 dark:bg-primary-800'
                    : 'bg-amber-100 dark:bg-amber-800'
                }`}
              >
                {isMobile ? (
                  <CloudUpload size={12} className="text-primary-600 dark:text-primary-300" />
                ) : (
                  <Cloud size={12} className="text-amber-600 dark:text-amber-300" />
                )}
              </div>
              <p className="leading-relaxed">
                {isMobile
                  ? t('learning.generateCards.localGenerate')
                  : t('learning.generateCards.backgroundProcess')}
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* 底部操作栏 */}
      <div
        className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-5 py-3.5 flex justify-end gap-3 items-center flex-shrink-0"
        aria-busy={isGenerating}
      >
        {isMobile && isGenerating && generateProgress ? (
          <div role="status" className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {t('learning.generateCards.generating')}
              </span>
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400 shrink-0 ml-2">
                {t('learning.generateCards.progress', {
                  current: generateProgress.current,
                  total: generateProgress.total,
                })}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-500 to-violet-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 text-center">
              {t('learning.generateCards.keepForeground')}
            </p>
          </div>
        ) : (
          <>
            <div className="mr-auto flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
              <span>{t('learning.generateCards.summaryTypes', { n: types.length })}</span>
              <span>·</span>
              <span>
                {t('learning.generateCards.summaryMatrix', {
                  easy: colTotals.easy,
                  medium: colTotals.medium,
                  hard: colTotals.hard,
                })}
              </span>
              <span>·</span>
              <span>{t('learning.generateCards.summaryNodes', { n: targetNodeIds.length })}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-colors"
            >
              {t('learning.generateCards.cancel')}
            </button>
            {isMobile && !isMobileAIConfigured ? (
              <button
                type="button"
                onClick={handleGoToSettings}
                className="px-6 py-2 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
              >
                <Settings size={16} />
                {t('learning.generateCards.goToSettings')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={
                  isLoading ||
                  types.length === 0 ||
                  grandTotal <= 0 ||
                  (targetNodeIds.length === 0 && !isMobile)
                }
                className="px-6 py-2 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles size={16} aria-hidden="true" />
                )}
                {t('learning.generateCards.startGenerate')}
              </button>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
};

export default GenerateCardsModal;

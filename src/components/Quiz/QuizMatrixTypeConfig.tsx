import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  BookOpen,
  Mountain,
  Layers,
  Wand2,
  Plus,
  Minus,
  ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';
import type { QuizSetConfig, CardType, CardDifficulty } from '@shared/types/quiz';
import { useTheme } from '../../hooks';

interface QuizMatrixTypeConfigProps {
  config: QuizSetConfig;
  onChange: (config: Partial<QuizSetConfig>) => void;
  /** 双栏布局模式：左=配置项，右=矩阵表格（用于创建流程整页双栏） */
  splitLayout?: boolean;
}

type MatrixDifficulty = 'easy' | 'medium' | 'hard';
type Mode = 'easy' | 'medium' | 'hard' | 'mixed';

const DEFAULT_CARDS_PER_TYPE: Record<CardType, number> = {
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

const DIFFS: MatrixDifficulty[] = ['easy', 'medium', 'hard'];

const clipInt = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

type Matrix = Record<CardType, Record<MatrixDifficulty, number>>;

/**
 * 测验创建用的题型×难度矩阵配置（拉取学习中心「题目生成」能力）。
 * 输出写入 QuizSetConfig：cardTypes / difficulty / cardsPerType / countMatrix。
 */
export const QuizMatrixTypeConfig: React.FC<QuizMatrixTypeConfigProps> = ({
  config,
  onChange,
  splitLayout = false,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const [types, setTypes] = useState<CardType[]>(() =>
    config.cardTypes?.length
      ? [...config.cardTypes]
      : (['qa', 'choice', 'true_false'] as CardType[]),
  );
  const [cardsPerType, setCardsPerType] = useState<Partial<Record<CardType, number>>>(() => ({
    ...DEFAULT_CARDS_PER_TYPE,
    ...(config.cardsPerType || {}),
  }));
  const [count, setCount] = useState<number>(() => {
    const initial = (config.cardTypes || []).reduce(
      (sum, type) => sum + (config.cardsPerType?.[type] || 0),
      0,
    );
    return initial > 0 ? initial : 15;
  });
  const [difficulty, setDifficulty] = useState<Mode>(config.difficulty || 'mixed');
  const [countPerDifficulty, setCountPerDifficulty] = useState<
    Partial<Record<MatrixDifficulty, number>>
  >({ easy: 2, medium: 4, hard: 3 });

  type DragAnchor = {
    total: number;
    mode: Mode;
    cells: Array<{ type: string; diff?: MatrixDifficulty; value: number }>;
  };
  const dragAnchorRef = useRef<DragAnchor | null>(null);

  const typeSet = useMemo(() => new Set(types), [types]);

  const matrix = useMemo<Matrix>(() => {
    const baseTotalForType = (tp: CardType): number =>
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
      const weights: Array<[MatrixDifficulty, number]> = [
        ['easy', countPerDifficulty.easy ?? 0],
        ['medium', countPerDifficulty.medium ?? 0],
        ['hard', countPerDifficulty.hard ?? 0],
      ];
      const weightSum = weights.reduce((s, [, w]) => s + w, 0);
      let remaining = total;
      if (weightSum <= 0) {
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

  const syncTotalToPerType = (nextTotal: number): void => {
    const anchor = dragAnchorRef.current;
    let useAnchor = false;
    if (anchor && anchor.total > 0 && anchor.mode === difficulty) {
      const anchorTypes = anchor.cells.map((c) => c.type);
      useAnchor =
        anchorTypes.length === types.length &&
        anchorTypes.every((tp) => types.includes(tp as CardType));
    }

    const baseTotal = useAnchor ? (anchor as DragAnchor).total : Math.max(1, grandTotal || 1);
    const ratio = nextTotal / baseTotal;

    if (difficulty === 'mixed') {
      type Cell = { type: string; diff: MatrixDifficulty; floor: number; frac: number };
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
          DIFFS.forEach((diff) => {
            const raw = (matrix[tp]?.[diff] ?? 0) * ratio;
            const floor = Math.floor(raw);
            cells.push({ type: tp, diff, floor, frac: raw - floor });
            sumFloor += floor;
          });
        }
      }
      let remainder = nextTotal - sumFloor;
      cells.sort((a, b) => b.frac - a.frac);
      let idx = 0;
      while (remainder > 0 && idx < cells.length) {
        cells[idx].floor += 1;
        remainder -= 1;
        idx += 1;
      }
      const nextMatrix: Matrix = {} as Matrix;
      for (const tp of types) nextMatrix[tp] = { easy: 0, medium: 0, hard: 0 };
      for (const c of cells) {
        nextMatrix[c.type as CardType][c.diff] = c.floor;
      }
      const nextCardsPerType: Partial<Record<CardType, number>> = {};
      const nextColTotals: Partial<Record<MatrixDifficulty, number>> = { easy: 0, medium: 0, hard: 0 };
      for (const tp of types) {
        nextCardsPerType[tp] = nextMatrix[tp].easy + nextMatrix[tp].medium + nextMatrix[tp].hard;
      }
      for (const c of cells) {
        nextColTotals[c.diff] = (nextColTotals[c.diff] ?? 0) + c.floor;
      }
      setCardsPerType((prev) => ({ ...prev, ...nextCardsPerType }));
      setCountPerDifficulty(nextColTotals);
    } else {
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
      const nextCardsPerType: Partial<Record<CardType, number>> = {};
      for (const r of rows) nextCardsPerType[r.type as CardType] = r.floor;
      setCardsPerType((prev) => ({ ...prev, ...nextCardsPerType }));
    }
    setCount(nextTotal);
  };

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

  const updateCell = (typeId: CardType, diff: MatrixDifficulty, nextValue: number): void => {
    if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
      setCardsPerType((prev) => ({ ...prev, [typeId]: clipInt(nextValue, 0, 30) }));
      return;
    }
    const nextMatrix: Matrix = JSON.parse(JSON.stringify(matrix));
    nextMatrix[typeId][diff] = clipInt(nextValue, 0, 30);
    const rowSum = nextMatrix[typeId].easy + nextMatrix[typeId].medium + nextMatrix[typeId].hard;
    setCardsPerType((prev) => ({ ...prev, [typeId]: rowSum }));

    const colSum = { easy: 0, medium: 0, hard: 0 };
    for (const tp of Object.keys(nextMatrix) as CardType[]) {
      colSum.easy += nextMatrix[tp].easy;
      colSum.medium += nextMatrix[tp].medium;
      colSum.hard += nextMatrix[tp].hard;
    }
    setCountPerDifficulty(colSum);
  };

  const handleToggleType = (typeId: CardType): void => {
    setTypes((prev) =>
      prev.includes(typeId) ? prev.filter((tp) => tp !== typeId) : [...prev, typeId],
    );
    setCardsPerType((prev) => {
      if (prev[typeId]) return prev;
      return { ...prev, [typeId]: DEFAULT_CARDS_PER_TYPE[typeId] ?? 3 };
    });
  };

  const applyPreset = (preset: 'balanced' | 'memory' | 'exam'): void => {
    const typesArr = ['choice', 'true_false', 'qa', 'multi_choice', 'fill_in_the_blank', 'essay'];
    const presets: Record<typeof preset, Partial<Record<CardType, number>>> = {
      balanced: { choice: 5, true_false: 3, qa: 3, multi_choice: 2, fill_in_the_blank: 2, essay: 1 },
      memory: { true_false: 4, fill_in_the_blank: 4, choice: 3, qa: 2, multi_choice: 2, essay: 1 },
      exam: { choice: 6, multi_choice: 4, essay: 3, true_false: 3, qa: 2, fill_in_the_blank: 2 },
    };
    const nextCardsPerType: Partial<Record<CardType, number>> = { ...cardsPerType };
    const selectedTypes = types.length > 0 ? types : (typesArr as CardType[]);
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

  const countMatrix = useMemo<
    Partial<Record<CardType, Partial<Record<CardDifficulty, number>>>>
  >(() => {
    const cm: Partial<Record<CardType, Partial<Record<CardDifficulty, number>>>> = {};
    for (const tp of types) {
      const cell = matrix[tp];
      if (!cell) continue;
      const entry: Partial<Record<CardDifficulty, number>> = {};
      let has = false;
      DIFFS.forEach((d) => {
        const v = cell[d] ?? 0;
        if (v > 0) {
          entry[d] = v;
          has = true;
        }
      });
      if (has) cm[tp] = entry;
    }
    return cm;
  }, [types, matrix]);

  useEffect(() => {
    onChange({
      cardTypes: types,
      difficulty,
      cardsPerType: cardsPerType as Record<CardType, number>,
      countMatrix,
    });
    // onChange 引用来自父组件 setFormData，稳定；仅依赖内部状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, cardsPerType, difficulty, countMatrix]);

  const cardTypes: Array<{ id: CardType; label: string; descKey: string }> = [
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

  const difficultyOptions: Array<{ id: Mode; label: string; desc: string; icon: React.ReactNode; activeRing: string; activeBg: string; text: string }> = [
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

  const colTotalsWeight =
    (countPerDifficulty.easy ?? 0) + (countPerDifficulty.medium ?? 0) + (countPerDifficulty.hard ?? 0);

  const cardCls = isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-gray-200';

  const configPart = (
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
            {([1, 15, 30, 60] as const).map((v) => {
              const pct = ((v - 1) / (60 - 1)) * 100;
              return (
                <span
                  key={v}
                  className="absolute top-0 text-[10px] text-slate-400"
                  style={{
                    left: `${pct}%`,
                    transform: v === 1 ? 'translateX(0)' : v === 60 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {v}
                </span>
              );
            })}
          </div>
        </div>

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
  );

  const matrixPart = (
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

        {types.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <AlertCircle size={16} />
            <span>{t('study.quizTypeConfig.selectAtLeastOne')}</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2 font-bold w-32">
                    {t('learning.generateCards.matrixHeaderType')}
                  </th>
                  {difficulty === 'mixed'
                    ? DIFFS.map((d) => (
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
                        ? DIFFS.map((d) => ({ key: d, value: matrix[tp]?.[d] ?? 0 }))
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
                                onClick={() => updateCell(tp, c.key as MatrixDifficulty, c.value - 1)}
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
                                onClick={() => updateCell(tp, c.key as MatrixDifficulty, c.value + 1)}
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
                    DIFFS.map((d) => (
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
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gradient-to-r from-primary-500 to-violet-500 text-white text-[11px] font-bold whitespace-nowrap">
                      {t('learning.generateCards.grandTotal', { count: grandTotal })}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );

  if (splitLayout) {
    return (
      <fieldset className="h-full">
        <legend className="sr-only">{t('study.quizTypeConfig.typeLegend')}</legend>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 h-full">
          <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col min-h-0 overflow-y-auto transition-colors ${cardCls}`}>
            {configPart}
          </div>
          <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col min-h-0 overflow-y-auto transition-colors ${cardCls}`}>
            {matrixPart}
          </div>
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">{t('study.quizTypeConfig.typeLegend')}</legend>
      {configPart}
      {matrixPart}
    </fieldset>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, FileStack, Database, Percent } from 'lucide-react';
import { useTheme } from "../../hooks";
import type { QuizAllocInput } from '../../utils/quizAllocation';

interface QuizReuseAdjustProps {
  kps: QuizAllocInput[];
  existingCounts: Record<string, number>;
  quotaByKp: Record<string, number>;
  reuseCapByKp: Record<string, number>;
  reuseCountByKp: Record<string, number>;
  reuseRatio: number;
  onReuseRatioChange: (r: number) => void;
  onReshuffle: () => void;
  disabled?: boolean;
  /** 双栏布局模式：左=控制/统计，右=知识点明细（用于创建流程整页双栏） */
  splitLayout?: boolean;
}

export const QuizReuseAdjust: React.FC<QuizReuseAdjustProps> = ({
  kps,
  existingCounts,
  quotaByKp,
  reuseCapByKp,
  reuseCountByKp,
  reuseRatio,
  onReuseRatioChange,
  onReshuffle,
  disabled,
  splitLayout = false,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const levelLabel = (level: string): string =>
    t(`quiz.knowledgePointSelector.levelLabels.${level}`, { defaultValue: level });

  const totalExisting = kps.reduce((s, kp) => s + (existingCounts[kp.id] ?? 0), 0);
  const totalReuse = kps.reduce((s, kp) => s + (reuseCountByKp[kp.id] ?? 0), 0);
  const totalGap = kps.reduce(
    (s, kp) => s + Math.max(0, (quotaByKp[kp.id] ?? 0) - (reuseCountByKp[kp.id] ?? 0)),
    0,
  );

  const leftPart = (
    <>
      <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className={`p-2 rounded-lg ${isDark ? 'bg-primary-900/40 text-primary-400' : 'bg-primary-100 text-primary-600'}`}>
          <Database size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            {t('quiz.reuseAdjust.autoPickTitle', { defaultValue: '系统自动挑选复用题目' })}
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {t('quiz.reuseAdjust.autoPickDesc', { defaultValue: '系统按题型×难度矩阵从已有题目中随机挑选，无需手动选择；配额不足部分将交给 AI 新生成' })}
          </p>
        </div>
        <button
          type="button"
          onClick={onReshuffle}
          disabled={disabled || kps.length === 0}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
            disabled || kps.length === 0
              ? isDark ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isDark ? 'bg-primary-900/40 text-primary-300 hover:bg-primary-900/60' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
          }`}
        >
          <RefreshCw size={14} />
          {t('quiz.reuseAdjust.reshuffle', { defaultValue: '重新随机' })}
        </button>
      </div>

      {/* 复用比例 */}
      <div className={`rounded-xl border px-4 py-3 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between mb-1">
          <label className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            <Percent size={16} className={isDark ? 'text-primary-400' : 'text-primary-600'} />
            {t('quiz.alloc.reuseRatioLabel')}
          </label>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-600'
          }`}>
            {reuseRatio}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={reuseRatio}
          onChange={(e) => onReuseRatioChange(Number(e.target.value))}
          disabled={disabled || kps.length === 0}
          aria-label={t('quiz.alloc.reuseRatioLabel')}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-50"
        />
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          {t('quiz.alloc.reuseRatioDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
          <div className={`text-2xl font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{totalExisting}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {t('quiz.reuseAdjust.statExisting', { defaultValue: '已有题目' })}
          </div>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-green-900/20 border border-green-800/40' : 'bg-green-50 border border-green-200'}`}>
          <div className={`text-2xl font-bold tabular-nums ${isDark ? 'text-green-400' : 'text-green-700'}`}>{totalReuse}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-green-400/70' : 'text-green-600'}`}>
            {t('quiz.reuseAdjust.statReuse', { defaultValue: '系统复用' })}
          </div>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-primary-900/20 border border-primary-800/40' : 'bg-primary-50 border border-primary-200'}`}>
          <div className={`text-2xl font-bold tabular-nums ${isDark ? 'text-primary-300' : 'text-primary-700'}`}>{totalGap}</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-primary-300/70' : 'text-primary-600'}`}>
            {t('quiz.reuseAdjust.statGenerate', { defaultValue: '需新生成' })}
          </div>
        </div>
      </div>
    </>
  );

  const detailPart = (
    <>
      {kps.length === 0 ? (
        <div className={`text-center py-8 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-gray-200 bg-gray-50'}`}>
          <FileStack size={32} className={`mx-auto mb-2 opacity-50 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {t('quiz.reuseAdjust.noKnowledgePoints')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {kps.map((kp) => {
            const existing = existingCounts[kp.id] ?? 0;
            const quota = quotaByKp[kp.id] ?? 0;
            const cap = reuseCapByKp[kp.id] ?? 0;
            const reuseCount = reuseCountByKp[kp.id] ?? 0;
            const gap = Math.max(0, quota - reuseCount);
            return (
              <div key={kp.id} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-gray-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                      {kp.title}
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {levelLabel(kp.level)}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('quiz.reuseAdjust.kpSummary', {
                      defaultValue: '已有 {{existing}} 道 · 系统复用 {{reuse}} / {{cap}} 道 · 需生成 {{gap}} 道',
                      existing,
                      reuse: reuseCount,
                      cap,
                      gap,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'}`}>
                    {t('quiz.reuseAdjust.existing', { count: existing })}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700'}`}>
                    {t('quiz.reuseAdjust.reused', { count: reuseCount })}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-600'}`}>
                    {t('quiz.reuseAdjust.toGenerate', { count: gap })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (splitLayout) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 h-full">
        <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col min-h-0 overflow-y-auto space-y-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-gray-200'}`}>
          {leftPart}
        </div>
        <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col min-h-0 overflow-y-auto ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <FileStack size={16} aria-hidden="true" />
            </div>
            <h4 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
              {t('quiz.reuseAdjust.detailTitle', { defaultValue: '知识点分配明细' })}
            </h4>
          </div>
          {detailPart}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leftPart}
      {detailPart}
    </div>
  );
};

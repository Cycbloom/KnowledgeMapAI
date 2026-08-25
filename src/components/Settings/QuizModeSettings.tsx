import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Layers, Shuffle, RotateCcw } from "lucide-react";
import { useQuizSettingsStore } from "../../store/useQuizSettingsStore";
import { useShallow } from "zustand/react/shallow";

/**
 * 答题与测验设置分段（总设置页）。
 *
 * 与学习中心答题模式侧栏的 QuizSettingsPanel 共享同一持久化 store
 * （useQuizSettingsStore），二者改动的值实时同步：
 * - 选项随机排列
 * - 错题自动重练
 * - 答题模式每题限时（关闭/10s/30s/60s）
 * - 测验模式进入时随机整卷
 */

interface SwitchRowProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  icon: React.ReactNode;
}

const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  hint,
  checked,
  onChange,
  icon,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-0.5 text-slate-400 dark:text-slate-500 flex-shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {label}
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {hint}
          </p>
        </div>
      </div>
      <div
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={0}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
          checked ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
        }`}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
};

export const QuizModeSettings = React.memo(function QuizModeSettings() {
  const { t } = useTranslation();
  const {
    optionShuffle,
    wrongRequeue,
    timerSeconds,
    examShuffleQuestions,
    setOptionShuffle,
    setWrongRequeue,
    setTimerSeconds,
    setExamShuffleQuestions,
  } = useQuizSettingsStore(
    useShallow((s) => ({
      optionShuffle: s.optionShuffle,
      wrongRequeue: s.wrongRequeue,
      timerSeconds: s.timerSeconds,
      examShuffleQuestions: s.examShuffleQuestions,
      setOptionShuffle: s.setOptionShuffle,
      setWrongRequeue: s.setWrongRequeue,
      setTimerSeconds: s.setTimerSeconds,
      setExamShuffleQuestions: s.setExamShuffleQuestions,
    })),
  );

  const timerOptions = [
    { value: 0, label: t("study.settings.timerOff") },
    { value: 10, label: t("study.settings.timer10") },
    { value: 30, label: t("study.settings.timer30") },
    { value: 60, label: t("study.settings.timer60") },
  ] as const;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t("settings.sections.quizMode")}
        </h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t("study.settings.quizModeHint")}
      </p>

      <div className="space-y-3">
        <SwitchRow
          label={t("study.settings.optionShuffle")}
          hint={t("study.settings.optionShuffleHint")}
          checked={optionShuffle}
          onChange={setOptionShuffle}
          icon={<Shuffle size={16} />}
        />
        <SwitchRow
          label={t("study.settings.wrongRequeue")}
          hint={t("study.settings.wrongRequeueHint")}
          checked={wrongRequeue}
          onChange={setWrongRequeue}
          icon={<RotateCcw size={16} />}
        />
        <SwitchRow
          label={t("study.settings.examShuffleQuestions")}
          hint={t("study.settings.examShuffleQuestionsHint")}
          checked={examShuffleQuestions}
          onChange={setExamShuffleQuestions}
          icon={<Layers size={16} />}
        />

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("study.settings.timerSeconds")}
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 mb-3">
            {t("study.settings.timerHint")}
          </p>
          <div
            role="radiogroup"
            aria-label={t("study.settings.timerSeconds")}
            className="grid grid-cols-4 gap-2"
          >
            {timerOptions.map((opt) => {
              const isSelected = timerSeconds === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  onClick={() => setTimerSeconds(opt.value)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
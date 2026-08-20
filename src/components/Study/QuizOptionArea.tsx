import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { StudyCard } from "@shared/types";
import { Check, X, BookOpen } from "lucide-react";
import { normalizeBooleanAnswer } from "../../utils/textUtils";
import { useQuizSettingsStore } from "../../store/useQuizSettingsStore";
import { resolveSecondaryTextStyle } from "../../utils/quizTypography";

/**
 * QuizOptionArea 组件 Props
 * 负责 6 种题型的选项渲染与提交按钮
 */
interface QuizOptionAreaProps {
  /** 当前学习卡片 */
  currentCard: StudyCard;
  /** 当前题型选项数组 */
  currentOptions: string[];
  /** 是否 QA 题型 */
  isQA: boolean;
  /** 是否单选题型 */
  isChoice: boolean;
  /** 是否多选题型 */
  isMultiChoice: boolean;
  /** 是否判断题型 */
  isTrueFalse: boolean;
  /** 是否填空题型 */
  isFillBlank: boolean;
  /** 是否简答题型 */
  isEssay: boolean;
  /** 多选已选集合 */
  selectedSet: Set<string>;
  /** 多选正确答案集合 */
  correctSet: Set<string>;
  /** 是否显示答案 */
  showAnswer: boolean;
  /** 单选/判断题选中项 */
  selectedOption: string | null;
  /** 单选/判断题点击回调 */
  onOptionClick: (option: string) => void;
  /** 多选题点击回调 */
  onMultiOptionClick: (option: string) => void;
  /** 是否暗色模式 */
  isDark: boolean;
  /** 是否移动端 */
  isMobile: boolean;
  /** 设置 showAnswer 的回调，用于提交按钮内部 */
  onSetShowAnswer: (show: boolean) => void;
}

/**
 * QuizOptionArea
 * 负责 6 种题型的选项渲染（choice/multi_choice/true_false/fill_in_the_blank/qa/essay）
 * 以及 showAnswer=false 时的提交按钮逻辑
 */
export function QuizOptionArea({
  currentCard,
  currentOptions,
  isQA,
  isChoice,
  isMultiChoice,
  isTrueFalse,
  isFillBlank,
  isEssay,
  selectedSet,
  correctSet,
  showAnswer,
  selectedOption,
  onOptionClick,
  onMultiOptionClick,
  isDark,
  isMobile,
  onSetShowAnswer,
}: QuizOptionAreaProps) {
  const { t } = useTranslation();

  const { fontSize, lineHeight } = useQuizSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
    })),
  );
  const secondaryTextStyle = resolveSecondaryTextStyle(fontSize, lineHeight);

  return (
    <div className="w-full pb-4 md:pb-6">
      {isChoice && currentOptions.length > 0 && (
        <div className="flex flex-col gap-2 md:gap-2 mt-3 md:mt-4">
          {currentOptions.map((option: string, idx: number) => {
            const isSelected = selectedOption === option;
            const isCorrect = option === currentCard.answer;

            let btnClass = `group ${isMobile ? "p-3.5" : "p-3"} rounded-xl border transition-all duration-200 relative flex items-start gap-3 shadow-sm `;
            if (showAnswer) {
              if (isCorrect)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md"
                  : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";}
              else if (isSelected)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md"
                  : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";}
              else
                {btnClass += isDark
                  ? "bg-slate-800/50 border-slate-700 text-slate-500"
                  : "bg-gray-50 border-gray-200 text-gray-400";}
            } else {
              btnClass += isDark
                ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-primary-900/30 hover:to-slate-800/50 hover:border-primary-500 cursor-pointer text-slate-200 hover:shadow-md"
                : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-primary-50 hover:to-white hover:border-primary-300 cursor-pointer text-gray-700 hover:shadow-md";
            }

            return (
              <button
                key={idx}
                onClick={() => onOptionClick(option)}
                disabled={showAnswer}
                className={btnClass}
              >
                <span
                  className={`flex-shrink-0 ${isMobile ? "w-8 h-8" : "w-7 h-7"} rounded-lg flex items-center justify-center font-bold ${isMobile ? "text-base" : "text-sm"} transition-all ${
                    isSelected
                      ? "bg-primary-500 text-white shadow-sm scale-105"
                      : isDark
                        ? "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
                        : "bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span
                  className={`flex-1 ${isMobile ? "text-base" : "text-sm"} font-medium leading-snug`}
                  style={secondaryTextStyle}
                >
                  {option.replace(/^[A-Z]\.\s*/, "")}
                </span>
                {showAnswer && isCorrect && (
                  <Check
                    className="text-emerald-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
                {showAnswer && isSelected && !isCorrect && (
                  <X
                    className="text-red-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isMultiChoice && currentOptions.length > 0 && (
        <div className="flex flex-col gap-2 md:gap-2 mt-3 md:mt-4">
          {currentOptions.map((option: string, idx: number) => {
            const isSelected = selectedSet.has(option);
            const isCorrect = correctSet.has(option);

            let btnClass = `group ${isMobile ? "p-3.5" : "p-3"} rounded-xl border transition-all duration-200 relative flex items-start gap-3 shadow-sm `;
            if (showAnswer) {
              if (isCorrect)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md"
                  : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";}
              else if (isSelected)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md"
                  : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";}
              else
                {btnClass += isDark
                  ? "bg-slate-800/50 border-slate-700 text-slate-500"
                  : "bg-gray-50 border-gray-200 text-gray-400";}
            } else {
              btnClass += isSelected
                ? isDark
                  ? "bg-gradient-to-r from-primary-900/40 to-primary-900/20 border-primary-500 text-primary-300 shadow-md"
                  : "bg-gradient-to-r from-primary-100 to-primary-50 border-primary-400 text-primary-700 shadow-md"
                : isDark
                  ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-primary-900/30 hover:to-slate-800/50 hover:border-primary-500 cursor-pointer text-slate-200 hover:shadow-md"
                  : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-primary-50 hover:to-white hover:border-primary-300 cursor-pointer text-gray-700 hover:shadow-md";
            }

            return (
              <button
                key={idx}
                onClick={() => onMultiOptionClick(option)}
                disabled={showAnswer}
                className={btnClass}
              >
                <span
                  className={`flex-shrink-0 ${isMobile ? "w-8 h-8" : "w-7 h-7"} rounded-lg flex items-center justify-center font-bold ${isMobile ? "text-base" : "text-sm"} transition-all ${
                    isSelected
                      ? "bg-primary-500 text-white shadow-sm scale-105"
                      : isDark
                        ? "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
                        : "bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span
                  className={`flex-1 ${isMobile ? "text-base" : "text-sm"} font-medium leading-snug`}
                  style={secondaryTextStyle}
                >
                  {option.replace(/^[A-Z]\.\s*/, "")}
                </span>
                {showAnswer && isCorrect && (
                  <Check
                    className="text-emerald-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
                {showAnswer && isSelected && !isCorrect && (
                  <X
                    className="text-red-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isTrueFalse && (
        <div
          className={`flex ${isMobile ? "flex-col gap-3" : "flex-col md:flex-row gap-3"} justify-center mt-3 md:mt-4`}
        >
          {(["True", "False"] as const).map((option) => {
            const isSelected = selectedOption === option;
            const correctAnswer = normalizeBooleanAnswer(currentCard.answer);
            const isCorrect = option === correctAnswer;

            let btnClass = `group flex-1 ${isMobile ? "p-5" : "p-4"} rounded-xl border transition-all duration-200 font-bold ${isMobile ? "text-lg" : "text-base"} relative flex flex-col items-center justify-center gap-2 shadow-sm `;
            if (showAnswer) {
              if (isCorrect)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md"
                  : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";}
              else if (isSelected)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md"
                  : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";}
              else
                {btnClass += isDark
                  ? "bg-slate-800/50 border-slate-700 text-slate-500"
                  : "bg-gray-50 border-gray-200 text-gray-400";}
            } else {
              btnClass += isDark
                ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-primary-900/30 hover:to-slate-800/50 hover:border-primary-500 cursor-pointer text-slate-200 hover:shadow-md"
                : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-primary-50 hover:to-white hover:border-primary-300 cursor-pointer text-gray-700 hover:shadow-md";
            }

            return (
              <button
                key={option}
                onClick={() => onOptionClick(option)}
                disabled={showAnswer}
                className={btnClass}
              >
                <span
                  className={`${isMobile ? "text-xl" : "text-lg"} font-bold`}
                >
                  {option === "True"
                    ? t("study.quiz.correct")
                    : t("study.quiz.incorrect")}
                </span>
                <span
                  className={`text-xs opacity-50 uppercase tracking-wider`}
                >
                  {option}
                </span>
                {showAnswer && isCorrect && (
                  <Check
                    className="text-emerald-500 absolute top-3 right-3"
                    size={isMobile ? 20 : 16}
                  />
                )}
                {showAnswer && isSelected && !isCorrect && (
                  <X
                    className="text-red-500 absolute top-3 right-3"
                    size={isMobile ? 20 : 16}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {!showAnswer && (
        <div className="w-full mt-4 md:mt-6">
          {isQA || isEssay || isFillBlank ? (
            <button
              onClick={() => onSetShowAnswer(true)}
              className={`w-full ${isMobile ? "py-4" : "py-4"} bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 flex items-center justify-center gap-2`}
            >
              <BookOpen size={isMobile ? 22 : 20} />
              <span className={isMobile ? "text-lg" : ""}>
                {t("study.quiz.showAnswer")}
              </span>
            </button>
          ) : isMultiChoice ? (
            <button
              onClick={() => onSetShowAnswer(true)}
              disabled={!selectedOption || selectedSet.size === 0}
              className={`w-full ${isMobile ? "py-4" : "py-4"} bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 disabled:opacity-50 disabled:shadow-none ${isMobile ? "text-lg" : ""}`}
            >
              {t("study.quiz.submitAnswer")}
            </button>
          ) : (
            <div
              className={`text-center py-4 ${isMobile ? "text-base" : "text-sm"} font-medium ${isDark ? "text-slate-500" : "text-gray-400"}`}
            >
              {t("study.quiz.selectOption")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

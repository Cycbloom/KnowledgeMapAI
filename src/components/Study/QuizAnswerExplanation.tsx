import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { Brain, Check, X } from "lucide-react";

/**
 * QuizAnswerExplanation 组件 Props
 * 负责 showAnswer=true 时的答案解析整块渲染
 */
interface QuizAnswerExplanationProps {
  /** 当前学习卡片 */
  currentCard: StudyCard;
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
  /** 单选/判断题选中项 */
  selectedOption: string | null;
  /** 是否显示答案（应为 true，否则不渲染内容） */
  showAnswer: boolean;
  /** 是否暗色模式 */
  isDark: boolean;
  /** 是否移动端 */
  isMobile?: boolean;
}

/**
 * QuizAnswerExplanation
 * 负责 showAnswer=true 时的「正确答案 + 你选了 X / 正确应为 Y + 🧠 解析 + evidence（如有）」整块渲染
 */
export function QuizAnswerExplanation({
  currentCard,
  isQA,
  isChoice,
  isMultiChoice,
  isTrueFalse,
  isFillBlank,
  isEssay,
  selectedSet,
  correctSet,
  selectedOption,
  showAnswer,
  isDark,
  isMobile = false,
}: QuizAnswerExplanationProps) {
  const { t } = useTranslation();

  if (!showAnswer) {
    return null;
  }

  /** 计算选择题「你选了 X / 正确应为 Y」的状态 */
  const getChoiceStatus = () => {
    if (!isChoice && !isTrueFalse) {
      return null;
    }
    const correctAnswer = isTrueFalse
      ? currentCard.answer.trim()
      : currentCard.answer;
    const isCorrect = selectedOption === correctAnswer;
    return {
      isCorrect,
      selectedLabel: selectedOption,
      correctLabel: correctAnswer,
    };
  };

  /** 计算多选题「你选了 X / 正确应为 Y」的状态 */
  const getMultiChoiceStatus = () => {
    if (!isMultiChoice) {
      return null;
    }
    const selectedArr = Array.from(selectedSet).sort();
    const correctArr = Array.from(correctSet).sort();
    const isCorrect =
      selectedArr.length === correctArr.length &&
      selectedArr.every((item) => correctSet.has(item));
    return {
      isCorrect,
      selectedArr,
      correctArr,
    };
  };

  const choiceStatus = getChoiceStatus();
  const multiChoiceStatus = getMultiChoiceStatus();

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {(isQA || isEssay || isFillBlank) && (
        <div
          className={`border-t ${isMobile ? "pt-4" : "pt-6"} ${isDark ? "border-slate-700" : "border-gray-100"}`}
        >
          <h3
            className={`uppercase tracking-widest text-[10px] md:text-[11px] font-bold mb-3 md:mb-4 px-2 md:px-3 py-0.5 md:py-1 rounded-md w-fit ${
              isDark
                ? "bg-emerald-900/30 text-emerald-400"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {isFillBlank
              ? t("study.quiz.fillContent")
              : t("study.quiz.standardAnswer")}
          </h3>
          <div
            className={`${isMobile ? "text-base" : "text-lg md:text-xl"} font-medium ${isDark ? "text-slate-200" : "text-gray-800"} whitespace-pre-wrap`}
          >
            {currentCard.answer}
          </div>
        </div>
      )}

      {(isChoice || isTrueFalse) && choiceStatus && (
        <div
          className={`border-t ${isMobile ? "pt-4" : "pt-6"} ${isDark ? "border-slate-700" : "border-gray-100"}`}
        >
          <div className="flex flex-col gap-3">
            <div
              className={`flex items-start gap-2 ${
                choiceStatus.isCorrect
                  ? isDark
                    ? "text-emerald-400"
                    : "text-emerald-700"
                  : isDark
                    ? "text-red-400"
                    : "text-red-700"
              }`}
            >
              {choiceStatus.isCorrect ? (
                <Check size={18} className="flex-shrink-0 mt-0.5" />
              ) : (
                <X size={18} className="flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold text-sm">
                  {choiceStatus.isCorrect
                    ? t("study.quiz.correct")
                    : t("study.quiz.incorrect")}
                </div>
                {!choiceStatus.isCorrect && (
                  <div className="text-sm opacity-80 mt-1">
                    <div>
                      你选择了：
                      <span className="font-medium">
                        {choiceStatus.selectedLabel ?? "（未选择）"}
                      </span>
                    </div>
                    <div className="mt-1">
                      正确答案：
                      <span className="font-medium">
                        {choiceStatus.correctLabel}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isMultiChoice && multiChoiceStatus && (
        <div
          className={`border-t ${isMobile ? "pt-4" : "pt-6"} ${isDark ? "border-slate-700" : "border-gray-100"}`}
        >
          <div className="flex flex-col gap-3">
            <div
              className={`flex items-start gap-2 ${
                multiChoiceStatus.isCorrect
                  ? isDark
                    ? "text-emerald-400"
                    : "text-emerald-700"
                  : isDark
                    ? "text-red-400"
                    : "text-red-700"
              }`}
            >
              {multiChoiceStatus.isCorrect ? (
                <Check size={18} className="flex-shrink-0 mt-0.5" />
              ) : (
                <X size={18} className="flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold text-sm">
                  {multiChoiceStatus.isCorrect
                    ? t("study.quiz.correct")
                    : t("study.quiz.incorrect")}
                </div>
                {!multiChoiceStatus.isCorrect && (
                  <div className="text-sm opacity-80 mt-1">
                    <div>
                      你选择了：
                      <span className="font-medium">
                        {multiChoiceStatus.selectedArr.length > 0
                          ? multiChoiceStatus.selectedArr.join("、")
                          : "（未选择）"}
                      </span>
                    </div>
                    <div className="mt-1">
                      正确答案：
                      <span className="font-medium">
                        {multiChoiceStatus.correctArr.join("、")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentCard.explanation && (
        <div
          className={`border-t ${isMobile ? "pt-4" : "pt-6"} ${isDark ? "border-slate-700" : "border-gray-100"}`}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4 text-primary-500">
            <Brain size={isMobile ? 16 : 18} />
            <h4 className="font-bold tracking-wider text-xs md:text-sm uppercase">
              {t("study.quiz.explanation")}
            </h4>
          </div>
          <div
            className={`p-3 md:p-5 rounded-2xl text-sm leading-relaxed border ${
              isDark
                ? "bg-slate-900/50 text-slate-400 border-slate-700"
                : "bg-primary-50/30 text-gray-600 border-primary-100"
            }`}
          >
            {currentCard.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { StudyCard } from "@shared/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUpdateCardProgressMutation } from "../../hooks/mutations";
import { getCardTypeBadgeMeta, badgeToneClasses } from "../../utils/quizBadgeMeta";
import { getDifficultyBadgeMeta } from "../../utils/quizDifficultyMeta";
import { useQuizSettingsStore } from "../../store/useQuizSettingsStore";
import {
  resolveFocusWidthClass,
  resolvePrimaryTextStyle,
} from "../../utils/quizTypography";
import { QuizOptionArea } from "./QuizOptionArea";
import { QuizAnswerExplanation } from "./QuizAnswerExplanation";
import { QuizRatingBar } from "./QuizRatingBar";

type UpdateProgressMutation = ReturnType<typeof useUpdateCardProgressMutation>;

/**
 * QuizFocusLayout 组件 Props
 * 在 QuizFlashLayoutProps 基础上扩展，并添加分栏布局的上下题回调
 */
export interface QuizFocusLayoutProps {
  isDark: boolean;
  isMobile: boolean;
  currentCard: StudyCard;
  currentCardIndex: number;
  quizCardsLength: number;
  showAnswer: boolean;
  selectedOption: string | null;
  updateProgressMutation: UpdateProgressMutation;
  onRate: (quality: number) => void;
  onOptionClick: (option: string) => void;
  onMultiOptionClick: (option: string) => void;
  onSetShowAnswer: (show: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  _swipeDirection?: "left" | "right" | null;
  _onDragEnd?: (_: unknown, info: { velocity: { x: number }; offset: { x: number } }) => void;
  _cardKey?: number;
  _similarityWithPrev?: number | null;
}

/**
 * QuizFocusLayout
 * 分栏精读（Focus）模式布局组件：
 * - 左栏：题型胶囊 + 题干 + QuizOptionArea（选项区）
 * - 右栏：QuizAnswerExplanation（答案解析区，未显示答案时显示空态）
 * - 底栏：上一题/下一题按钮 + QuizRatingBar + 进度 pill + 快捷键提示
 */
export const QuizFocusLayout = memo(function QuizFocusLayout(props: QuizFocusLayoutProps) {
  const {
    isDark,
    isMobile,
    currentCard,
    currentCardIndex,
    quizCardsLength,
    showAnswer,
    selectedOption,
    updateProgressMutation,
    onRate,
    onOptionClick,
    onMultiOptionClick,
    onSetShowAnswer,
    onPrev,
    onNext,
  } = props;

  const { t } = useTranslation();

  const { fontSize, lineHeight, contentWidthMode } = useQuizSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      contentWidthMode: s.contentWidthMode,
    })),
  );
  const primaryTextStyle = resolvePrimaryTextStyle(fontSize, lineHeight);
  const focusWidthClass = resolveFocusWidthClass(contentWidthMode);

  const isQA = !currentCard.card_type || currentCard.card_type === "qa";
  const isChoice = currentCard.card_type === "choice";
  const isMultiChoice = currentCard.card_type === "multi_choice";
  const isTrueFalse = currentCard.card_type === "true_false";
  const isFillBlank = currentCard.card_type === "fill_in_the_blank";
  const isEssay = currentCard.card_type === "essay";

  const currentOptions: string[] = useMemo(() => {
    if (!currentCard?.options) return [];
    if (Array.isArray(currentCard.options)) return currentCard.options;
    try {
      if (typeof currentCard.options === "string") {
        return JSON.parse(currentCard.options);
      }
    } catch (e) {
      console.error("Failed to parse card options:", e);
    }
    return [];
  }, [currentCard]);

  const selectedSet = useMemo(() => {
    if (isMultiChoice && selectedOption) {
      try {
        const parsed = JSON.parse(selectedOption);
        if (Array.isArray(parsed)) return new Set(parsed as string[]);
      } catch {
        return new Set<string>();
      }
    }
    return new Set<string>();
  }, [isMultiChoice, selectedOption]);

  const correctSet = useMemo(() => {
    if (isMultiChoice) {
      try {
        const parsed = JSON.parse(currentCard.answer);
        if (Array.isArray(parsed)) return new Set(parsed as string[]);
      } catch {
        return new Set<string>();
      }
    }
    return new Set<string>();
  }, [isMultiChoice, currentCard.answer]);

  const currentBadgeMeta = getCardTypeBadgeMeta(currentCard.card_type ?? "qa");
  const CurrentBadgeIcon = currentBadgeMeta.Icon;
  const currentDifficultyMeta = getDifficultyBadgeMeta(currentCard.difficulty);

  const isFirstCard = currentCardIndex === 0;
  const isLastCard = currentCardIndex === quizCardsLength - 1;

  /**
   * 全局键盘快捷键监听
   * - ArrowLeft: 上一题
   * - ArrowRight: 下一题
   * - Enter / Space: 触发提交（当 QA/Essay/FillBlank 且未显示答案时，或多选时）
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target?.tagName;
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!showAnswer) {
          if (isQA || isEssay || isFillBlank) {
            onSetShowAnswer(true);
          } else if (isMultiChoice && selectedOption && selectedSet.size > 0) {
            onSetShowAnswer(true);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    onPrev,
    onNext,
    showAnswer,
    isQA,
    isEssay,
    isFillBlank,
    isMultiChoice,
    selectedOption,
    selectedSet.size,
    onSetShowAnswer,
  ]);

  return (
    <div
      className={`h-full w-full flex flex-col ${isMobile ? "p-2" : "p-4 md:p-6"} transition-colors ${isDark ? "bg-slate-900" : "bg-gray-100"}`}
    >
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className={`grid grid-rows-[1fr_auto] h-full w-full mx-auto rounded-2xl border overflow-hidden ${
            isDark
              ? "bg-surface border-slate-700 dark:bg-slate-800"
              : "bg-white border-gray-200"
          } grid-cols-1 lg:grid-cols-5 ${focusWidthClass}`}
        >
        <div
          className={`lg:col-span-3 min-h-0 overflow-y-auto custom-scrollbar p-6 md:p-8 border-r ${
            isDark
              ? "dark:border-slate-700 max-lg:border-r-0 max-lg:border-b border-b-slate-700"
              : "border-gray-200 max-lg:border-r-0 max-lg:border-b border-b-gray-200"
          }`}
          aria-label={t("study.a11y.quizQuestionRegion")}
        >
          <div className="flex flex-col h-full">
            <div className="flex flex-col items-start text-left mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <span
                  className={`${badgeToneClasses(currentBadgeMeta.tone, isDark)} text-xs md:text-[13px] font-bold inline-flex items-center gap-1 px-2.5 py-1`}
                >
                  <CurrentBadgeIcon size={14} />
                  {t(currentBadgeMeta.labelKey as never)}
                </span>
                {currentDifficultyMeta && (
                  <span
                    className={`${badgeToneClasses(currentDifficultyMeta.tone, isDark)} text-xs md:text-[13px] font-bold inline-flex items-center gap-1 px-2.5 py-1`}
                    aria-label={t(currentDifficultyMeta.labelKey as never)}
                  >
                    {t(currentDifficultyMeta.labelKey as never)}
                  </span>
                )}
                <h3
                  className={`uppercase tracking-widest text-[10px] md:text-[11px] font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-md ${
                    isDark
                      ? "bg-primary-900/30 text-primary-400"
                      : "bg-primary-50 text-primary-600"
                  }`}
                >
                  {t("study.quiz.question")}
                </h3>
              </div>
              <div
                className={`${isMobile ? "text-base" : "text-lg md:text-xl"} font-semibold leading-snug mt-2 md:mt-3 ${isDark ? "text-slate-100" : "text-gray-900"}`}
                style={primaryTextStyle}
              >
                {currentCard.question}
              </div>
            </div>

            <div className="flex-1">
              <QuizOptionArea
                currentCard={currentCard}
                currentOptions={currentOptions}
                isQA={isQA}
                isChoice={isChoice}
                isMultiChoice={isMultiChoice}
                isTrueFalse={isTrueFalse}
                isFillBlank={isFillBlank}
                isEssay={isEssay}
                selectedSet={selectedSet}
                correctSet={correctSet}
                showAnswer={showAnswer}
                selectedOption={selectedOption}
                onOptionClick={onOptionClick}
                onMultiOptionClick={onMultiOptionClick}
                isDark={isDark}
                isMobile={isMobile}
                onSetShowAnswer={onSetShowAnswer}
              />
            </div>
          </div>
        </div>

        <div
          className={`lg:col-span-2 min-h-0 overflow-y-auto custom-scrollbar p-6 md:p-8 border-l dark:border-slate-700 max-lg:border-l-0 max-lg:border-t ${
            isDark ? "dark:border-slate-700" : "border-gray-200"
          }`}
          aria-label={t("study.a11y.quizExplanationRegion")}
        >
          {!showAnswer ? (
            <div className="h-full flex items-center justify-center">
              <div
                className={`text-center px-4 py-8 opacity-60 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              >
                <div className="text-sm md:text-base font-medium">
                  {t("study.quiz.emptyExplanation")}
                </div>
              </div>
            </div>
          ) : (
            <QuizAnswerExplanation
              currentCard={currentCard}
              isQA={isQA}
              isChoice={isChoice}
              isMultiChoice={isMultiChoice}
              isTrueFalse={isTrueFalse}
              isFillBlank={isFillBlank}
              isEssay={isEssay}
              selectedSet={selectedSet}
              correctSet={correctSet}
              selectedOption={selectedOption}
              showAnswer={showAnswer}
              isDark={isDark}
              isMobile={isMobile}
            />
          )}
        </div>

        <div
          className={`row-span-1 col-span-full sticky bottom-0 border-t px-6 py-4 flex items-center justify-between gap-4 z-10 ${
            isDark
              ? "dark:bg-slate-800/80 border-slate-700"
              : "bg-surface bg-white/90 border-gray-200"
          } backdrop-blur`}
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onPrev}
              disabled={isFirstCard}
              className={`flex items-center gap-1 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-medium transition-all ${
                isDark
                  ? isFirstCard
                    ? "bg-slate-700/30 text-slate-600 cursor-not-allowed"
                    : "bg-slate-700/50 text-slate-200 hover:bg-slate-700"
                  : isFirstCard
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              aria-label={t("study.quiz.prevCard")}
            >
              <ChevronLeft size={18} />
              <span className={`${isMobile ? "hidden sm:inline" : "inline"} text-sm`}>
                {t("study.quiz.prevCard")}
              </span>
            </button>
            <button
              onClick={onNext}
              disabled={isLastCard}
              className={`flex items-center gap-1 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-medium transition-all ${
                isDark
                  ? isLastCard
                    ? "bg-slate-700/30 text-slate-600 cursor-not-allowed"
                    : "bg-primary-600 text-white hover:bg-primary-700"
                  : isLastCard
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-primary-600 text-white hover:bg-primary-700"
              }`}
              aria-label={t("study.quiz.nextCard")}
            >
              <span className={`${isMobile ? "hidden sm:inline" : "inline"} text-sm`}>
                {t("study.quiz.nextCard")}
              </span>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex-1 max-w-md min-w-0 flex items-center justify-center">
            <div className="w-full max-w-md">
              <QuizRatingBar
                showAnswer={showAnswer}
                updateProgressMutation={updateProgressMutation}
                isDark={isDark}
                isMobile={isMobile}
                onRate={onRate}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`hidden md:inline-flex text-[10px] md:text-xs px-2.5 py-1 rounded-md ${
                isDark
                  ? "bg-slate-700/40 text-slate-400"
                  : "bg-gray-100 text-gray-500"
              }`}
              title={t("study.quiz.shortcuts")}
            >
              ← → {t("study.quiz.switchShortcut")} · Enter {t("study.quiz.submitShortcut")}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
});

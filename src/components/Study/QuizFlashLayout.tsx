import { useMemo, memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import {
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { useUpdateCardProgressMutation } from "../../hooks/mutations";
import { getCardTypeBadgeMeta, badgeToneClasses } from "../../utils/quizBadgeMeta";
import { QuizOptionArea } from "./QuizOptionArea";
import { QuizAnswerExplanation } from "./QuizAnswerExplanation";
import { QuizRatingBar } from "./QuizRatingBar";

type UpdateProgressMutation = ReturnType<typeof useUpdateCardProgressMutation>;

export interface QuizFlashLayoutProps {
  isDark: boolean;
  isMobile: boolean;
  currentCard: StudyCard;
  currentCardIndex: number;
  showAnswer: boolean;
  selectedOption: string | null;
  cardKey: number;
  swipeDirection: "left" | "right" | null;
  quizCards: StudyCard[];
  similarityWithPrev: number | null;
  updateProgressMutation: UpdateProgressMutation;
  onRate: (quality: number) => void;
  onOptionClick: (option: string) => void;
  onMultiOptionClick: (option: string) => void;
  onDragEnd: (_: unknown, info: { velocity: { x: number }; offset: { x: number } }) => void;
  onSetShowAnswer: (show: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export const QuizFlashLayout = memo(function QuizFlashLayout({
  isDark,
  isMobile,
  currentCard,
  currentCardIndex,
  showAnswer,
  selectedOption,
  cardKey,
  swipeDirection,
  quizCards,
  similarityWithPrev,
  updateProgressMutation,
  onRate,
  onOptionClick,
  onMultiOptionClick,
  onDragEnd,
  onSetShowAnswer,
  onPrev,
  onNext,
}: QuizFlashLayoutProps) {
  const { t } = useTranslation();

  const handlePrev = onPrev ?? (() => {});
  const handleNext = onNext ?? (() => {});

  /**
   * 闪卡模式全局键盘导航：与专注模式保持一致。
   * - ArrowLeft: 上一张
   * - ArrowRight: 下一张
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
        handlePrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePrev, handleNext]);

  const rotation = useMotionValue(0);
  const rightOpacity = useMotionValue(0);
  const rightScale = useMotionValue(0.8);
  const leftOpacity = useMotionValue(0);
  const leftScale = useMotionValue(0.8);

  const resetMotionValues = () => {
    rotation.set(0);
    rightOpacity.set(0);
    rightScale.set(0.8);
    leftOpacity.set(0);
    leftScale.set(0.8);
  };

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

  return (
    <div
      className={`h-full w-full flex flex-col ${isMobile ? "p-2" : "p-4 md:p-6"} transition-colors ${isDark ? "bg-slate-900" : "bg-gray-100"}`}
    >
      <div className="flex-1 min-h-0 w-full mx-auto max-w-3xl flex items-center justify-center">
        <div
          className={`relative perspective-1000 h-full w-full flex items-center justify-center`}
        >
          {quizCards
            .slice(currentCardIndex + 1, currentCardIndex + 3)
            .map((stackCard, index) => {
              const stackIndex = index + 1;
              const isNext = stackIndex === 1;
              const stackCardOptions = (() => {
                if (!stackCard.options) return [];
                if (Array.isArray(stackCard.options)) return stackCard.options;
                try {
                  if (typeof stackCard.options === "string")
                    {return JSON.parse(stackCard.options);}
                } catch {
                  return [];
                }
                return [];
              })();
              const isStackQA =
                !stackCard.card_type || stackCard.card_type === "qa";
              const isStackChoice = stackCard.card_type === "choice";
              const isStackMultiChoice = stackCard.card_type === "multi_choice";
              const isStackTrueFalse = stackCard.card_type === "true_false";
              const isStackFillBlank =
                stackCard.card_type === "fill_in_the_blank";

              const stackBadgeMeta = getCardTypeBadgeMeta(stackCard.card_type ?? "qa");
              const StackBadgeIcon = stackBadgeMeta.Icon;

              return (
                <motion.div
                  key={`stack-${stackCard.id}`}
                  className={`absolute inset-0 rounded-3xl shadow-lg transition-colors border overflow-hidden ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-gray-100"
                  }`}
                  initial={{
                    rotate: -8 * stackIndex,
                    y: stackIndex * 20,
                    scale: 1 - stackIndex * 0.03,
                    opacity: 0,
                  }}
                  animate={{
                    rotate: -8 * stackIndex,
                    y: stackIndex * 20,
                    scale: 1 - stackIndex * 0.03,
                    opacity: isNext ? 1 : 0.6,
                  }}
                  exit={{
                    rotate: 0,
                    y: 0,
                    scale: 1,
                    opacity: 1,
                  }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    zIndex: 10 - stackIndex,
                    transformOrigin: "bottom center",
                  }}
                >
                  {isNext && (
                    <div className="p-5 md:p-8 flex flex-col h-full">
                      <div
                        className={`absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isDark
                            ? "bg-slate-700 text-slate-400"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t("study.quiz.nextCard")}
                      </div>
                      <div className="flex-1 overflow-hidden mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`${badgeToneClasses(stackBadgeMeta.tone, isDark)} text-xs md:text-[13px] font-bold inline-flex items-center gap-1 px-2.5 py-1`}
                          >
                            <StackBadgeIcon size={14} />
                            {t(stackBadgeMeta.labelKey as never)}
                          </span>
                          <h3
                            className={`uppercase tracking-widest text-[10px] font-bold px-2 py-0.5 rounded-md inline-block ${
                              isDark
                                ? "bg-primary-900/30 text-primary-400"
                                : "bg-primary-50 text-primary-600"
                            }`}
                          >
                            {t("study.quiz.question")}
                          </h3>
                        </div>
                        <div
                          className={`text-base md:text-lg font-semibold leading-snug mb-3 line-clamp-2 ${
                            isDark ? "text-slate-200" : "text-gray-800"
                          }`}
                        >
                          {stackCard.question}
                        </div>

                        {isStackChoice && stackCardOptions.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {stackCardOptions
                              .slice(0, 4)
                              .map((option: string, idx: number) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                                    isDark
                                      ? "bg-slate-700/50 text-slate-300"
                                      : "bg-gray-50 text-gray-600"
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                      isDark
                                        ? "bg-slate-600 text-slate-400"
                                        : "bg-gray-200 text-gray-500"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className="truncate flex-1">
                                    {option.replace(/^[A-Z]\.\s*/, "")}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}

                        {isStackMultiChoice && stackCardOptions.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {stackCardOptions
                              .slice(0, 4)
                              .map((option: string, idx: number) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                                    isDark
                                      ? "bg-slate-700/50 text-slate-300"
                                      : "bg-gray-50 text-gray-600"
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                                      isDark
                                        ? "bg-slate-600 text-slate-400"
                                        : "bg-gray-200 text-gray-500"
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className="truncate flex-1">
                                    {option.replace(/^[A-Z]\.\s*/, "")}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}

                        {isStackTrueFalse && (
                          <div className="flex gap-2">
                            <div
                              className={`flex-1 p-2 rounded-lg text-center text-sm font-medium ${
                                isDark
                                  ? "bg-slate-700/50 text-slate-300"
                                  : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              {t("study.quiz.correct")}
                            </div>
                            <div
                              className={`flex-1 p-2 rounded-lg text-center text-sm font-medium ${
                                isDark
                                  ? "bg-slate-700/50 text-slate-300"
                                  : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              {t("study.quiz.incorrect")}
                            </div>
                          </div>
                        )}

                        {(isStackQA || isStackFillBlank) && (
                          <div
                            className={`mt-2 p-3 rounded-lg text-sm ${
                              isDark
                                ? "bg-slate-700/30 text-slate-400"
                                : "bg-gray-50 text-gray-500"
                            }`}
                          >
                            <span className="text-xs font-medium opacity-70">
                              {t("study.quiz.answer")}：
                            </span>
                            <span className="ml-1 line-clamp-1">
                              {stackCard.answer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={cardKey}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDrag={(_, info) => {
                rotation.set(info.offset.x * 0.12);
                if (info.offset.x > 30) {
                  rightOpacity.set(1);
                  rightScale.set(1);
                  leftOpacity.set(0);
                  leftScale.set(0.8);
                } else if (info.offset.x < -30) {
                  leftOpacity.set(1);
                  leftScale.set(1);
                  rightOpacity.set(0);
                  rightScale.set(0.8);
                } else {
                  rightOpacity.set(0);
                  rightScale.set(0.8);
                  leftOpacity.set(0);
                  leftScale.set(0.8);
                }
              }}
              onDragEnd={(_, info) => {
                resetMotionValues();
                onDragEnd(_, info);
              }}
              initial={{ rotate: -20, y: 40, scale: 0.92, opacity: 0 }}
              animate={{ rotate: 0, y: 0, scale: 1, opacity: 1 }}
              exit={{
                rotate: swipeDirection === "right" ? 150 : -150,
                y: -80,
                x: swipeDirection === "right" ? 200 : -200,
                opacity: 0,
                scale: 0.85,
                transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] },
              }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={`absolute inset-0 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl ${isMobile ? "p-4" : "p-6 md:p-10"} flex flex-col cursor-grab active:cursor-grabbing transition-colors border ${
                isDark ? "border-slate-700" : "border-gray-100"
              }`}
              style={{
                transformOrigin: "bottom center",
                rotate: rotation,
                zIndex: 10,
              }}
            >
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                style={{ opacity: rightOpacity, scale: rightScale }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className={`bg-green-500/20 ${isMobile ? "p-4" : "p-8"} rounded-full border-4 border-green-500 text-green-500`}
                >
                  <ThumbsUp size={isMobile ? 48 : 80} />
                </div>
              </motion.div>
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                style={{ opacity: leftOpacity, scale: leftScale }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className={`bg-red-500/20 ${isMobile ? "p-4" : "p-8"} rounded-full border-4 border-red-500 text-red-500`}
                >
                  <ThumbsDown size={isMobile ? 48 : 80} />
                </div>
              </motion.div>

              <div
                className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${isMobile ? "pr-0" : "pr-1"} space-y-4 md:space-y-6 mt-2 md:mt-4`}
              >
                {similarityWithPrev !== null && similarityWithPrev > 0.75 && (
                  <div
                    className={`w-fit text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      isDark
                        ? "bg-amber-900/40 text-amber-400 border border-amber-700/50"
                        : "bg-amber-50 text-amber-600 border border-amber-200"
                    }`}
                  >
                    <AlertTriangle size={10} />
                    {t("study.semantic.similar", { percent: Math.round(similarityWithPrev * 100) })}
                  </div>
                )}

                <div className="flex flex-col items-start text-left">
                  <div className="flex items-center gap-2">
                    <span
                      className={`${badgeToneClasses(currentBadgeMeta.tone, isDark)} text-xs md:text-[13px] font-bold inline-flex items-center gap-1 px-2.5 py-1`}
                    >
                      <CurrentBadgeIcon size={14} />
                      {t(currentBadgeMeta.labelKey as never)}
                    </span>
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
                  >
                    {currentCard.question}
                  </div>
                </div>

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

                {showAnswer && (
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
                className={`mt-auto ${isMobile ? "pt-4" : "pt-6"} border-t ${isDark ? "border-slate-700" : "border-gray-100"}`}
              >
                <AnimatePresence mode="wait">
                  {showAnswer && (
                    <motion.div
                      key="rating-action"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full"
                    >
                      {currentCardIndex > 0 && (
                        <div className="flex items-center justify-between gap-2 mb-2 md:mb-3">
                          <button
                            type="button"
                            onClick={handlePrev}
                            className={`inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition-colors ${
                              isDark
                                ? "text-slate-400 hover:text-slate-200"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <ChevronLeft size={14} aria-hidden={true} />
                            <span>{t("study.quiz.prevCard")}</span>
                          </button>
                          <div className="flex-1" />
                        </div>
                      )}
                      <QuizRatingBar
                        showAnswer={showAnswer}
                        updateProgressMutation={updateProgressMutation}
                        isDark={isDark}
                        isMobile={isMobile}
                        onRate={onRate}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

import { useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import {
  Check,
  X,
  RefreshCw,
  BookOpen,
  Brain,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Clock,
  Target,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { useUpdateCardProgressMutation } from "../../hooks/mutations";
import { formatTimeFromSeconds } from "../../utils/formatters";

type UpdateProgressMutation = ReturnType<typeof useUpdateCardProgressMutation>;

interface QuizViewFinishedProps {
  isDark: boolean;
  isMobile: boolean;
  nodeId: string | null;
  from: string | null;
  quizCardsLength: number;
  reviewedCount: number;
  correctCount: number;
  sessionDuration: number;
  onBackToDashboard: () => void;
  onRestart: () => void;
}

export const QuizViewFinished = memo(function QuizViewFinished({
  isDark,
  isMobile,
  nodeId,
  from,
  quizCardsLength,
  reviewedCount,
  correctCount,
  sessionDuration,
  onBackToDashboard,
  onRestart,
}: QuizViewFinishedProps) {
  const { t } = useTranslation();
  const accuracy =
    reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;

  return (
    <div
      className={`min-h-full flex flex-col items-center justify-center ${isMobile ? "p-4" : "p-8"} ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      <div
        className={`w-full max-w-md ${isDark ? "bg-slate-800" : "bg-white"} rounded-2xl shadow-xl ${isMobile ? "p-6" : "p-10"} text-center animate-fade-in-up`}
      >
        <div
          className={`w-16 md:w-20 h-16 md:h-20 ${isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"} rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6`}
        >
          <Check size={isMobile ? 32 : 40} strokeWidth={3} />
        </div>
        <h2
          className={`${isMobile ? "text-2xl" : "text-3xl"} font-bold mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}
        >
          {nodeId
            ? t("study.completed.levelComplete")
            : t("study.completed.sessionComplete")}
        </h2>
        <p
          className={`mb-6 md:mb-8 ${isMobile ? "text-base" : "text-lg"} ${isDark ? "text-slate-400" : "text-gray-500"}`}
        >
          {nodeId
            ? t("study.completed.levelCompleteDesc")
            : t("study.completed.sessionCompleteDesc", {
                count: quizCardsLength,
              })}
        </p>

        {/* Session summary stats (UX2-09) */}
        <div
          className={`grid grid-cols-3 gap-2 md:gap-3 mb-6 md:mb-8 ${isMobile ? "" : ""}`}
        >
          <div
            className={`p-3 md:p-4 rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
          >
            <Layers
              size={isMobile ? 16 : 18}
              className={`mx-auto mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
            />
            <div
              className={`${isMobile ? "text-xl" : "text-2xl"} font-black ${isDark ? "text-slate-100" : "text-gray-900"}`}
            >
              {reviewedCount}
            </div>
            <div
              className={`text-[10px] md:text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {t("study.completed.cardsReviewed")}
            </div>
          </div>
          <div
            className={`p-3 md:p-4 rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
          >
            <Clock
              size={isMobile ? 16 : 18}
              className={`mx-auto mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
            />
            <div
              className={`${isMobile ? "text-xl" : "text-2xl"} font-black ${isDark ? "text-slate-100" : "text-gray-900"}`}
            >
              {formatTimeFromSeconds(sessionDuration)}
            </div>
            <div
              className={`text-[10px] md:text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {t("study.completed.timeSpent")}
            </div>
          </div>
          <div
            className={`p-3 md:p-4 rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
          >
            <Target
              size={isMobile ? 16 : 18}
              className={`mx-auto mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}
            />
            <div
              className={`${isMobile ? "text-xl" : "text-2xl"} font-black ${
                accuracy >= 80
                  ? isDark
                    ? "text-emerald-400"
                    : "text-emerald-600"
                  : accuracy >= 60
                    ? isDark
                      ? "text-amber-400"
                      : "text-amber-600"
                    : isDark
                      ? "text-red-400"
                      : "text-red-600"
              }`}
            >
              {accuracy}%
            </div>
            <div
              className={`text-[10px] md:text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {t("study.completed.accuracy")}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onBackToDashboard}
            className={`w-full bg-primary-600 text-white ${isMobile ? "py-4" : "py-3"} rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 flex items-center justify-center ${isMobile ? "text-lg" : ""}`}
          >
            {from === "learning"
              ? t("study.completed.backToLearning")
              : t("study.completed.backToCenter")}
          </button>
          <button
            onClick={onRestart}
            className={`w-full ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-gray-50 text-gray-600 hover:bg-gray-100"} ${isMobile ? "py-4" : "py-3"} rounded-xl font-bold transition-all flex items-center justify-center ${isMobile ? "text-lg" : ""}`}
          >
            <RefreshCw className="mr-2" size={isMobile ? 20 : 18} />
            {t("study.completed.practiceAgain")}
          </button>
        </div>
      </div>
    </div>
  );
});

interface QuizViewActiveProps {
  isDark: boolean;
  isMobile: boolean;
  currentCard: StudyCard;
  currentCardIndex: number;
  quizCardsLength: number;
  showAnswer: boolean;
  selectedOption: string | null;
  cardKey: number;
  swipeDirection: "left" | "right" | null;
  quizCards: StudyCard[];
  similarityWithPrev: number | null;
  updateProgressMutation: UpdateProgressMutation;
  onBackToDashboard: () => void;
  onRate: (quality: number) => void;
  onOptionClick: (option: string) => void;
  onMultiOptionClick: (option: string) => void;
  onDragEnd: (_: unknown, info: { velocity: { x: number }; offset: { x: number } }) => void;
  onSetShowAnswer: (show: boolean) => void;
}

export const QuizViewActive = memo(function QuizViewActive({
  isDark,
  isMobile,
  currentCard,
  currentCardIndex,
  quizCardsLength,
  showAnswer,
  selectedOption,
  cardKey,
  swipeDirection,
  quizCards,
  similarityWithPrev,
  updateProgressMutation,
  onBackToDashboard,
  onRate,
  onOptionClick,
  onMultiOptionClick,
  onDragEnd,
  onSetShowAnswer,
}: QuizViewActiveProps) {
  const { t } = useTranslation();

  // Motion values for drag-driven feedback (layout thread, no re-render)
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

  return (
    <div
      className={`min-h-full flex flex-col items-center justify-center ${isMobile ? "p-2" : "p-4 md:p-8"} transition-colors ${isDark ? "bg-slate-900" : "bg-gray-100"}`}
    >
      <div className="w-full max-w-2xl">
        <div className={`flex justify-between items-center mb-4 md:mb-6 px-2`}>
          <button
            onClick={onBackToDashboard}
            className={`flex items-center transition-colors ${isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-800"} ${isMobile ? "p-2 -ml-2" : ""}`}
          >
            <ArrowLeft
              size={isMobile ? 24 : 20}
              className={isMobile ? "" : "mr-1"}
            />
            <span className={`font-medium ${isMobile ? "hidden" : "inline"}`}>
              {t("study.quiz.exit")}
            </span>
          </button>
          <div className="text-center">
            <h2
              className={`${isMobile ? "text-base" : "text-lg"} font-bold ${isDark ? "text-slate-200" : "text-gray-800"}`}
            >
              {t("study.quiz.mode")}
            </h2>
            <p
              className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"} ${isMobile ? "hidden" : ""}`}
            >
              {t("study.quiz.swipeHint")}
            </p>
          </div>
          <span
            className={`font-bold px-3 py-1 rounded-full ${isMobile ? "text-xs" : "text-sm"} ${isDark ? "bg-slate-800 text-slate-300" : "bg-white text-gray-500 shadow-sm"}`}
          >
            {currentCardIndex + 1} / {quizCardsLength}
          </span>
        </div>

        <div
          className={`relative perspective-1000 ${isMobile ? "h-[65vh]" : "h-[550px] md:h-[600px]"}`}
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
                        <h3
                          className={`uppercase tracking-widest text-[10px] font-bold mb-2 px-2 py-0.5 rounded-md inline-block ${
                            isDark
                              ? "bg-primary-900/30 text-primary-400"
                              : "bg-primary-50 text-primary-600"
                          }`}
                        >
                          {t("study.quiz.question")}
                        </h3>
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
              {/* Swipe Feedback Icons */}
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

              {/* Card Type Badge */}
              <div
                className={`absolute ${isMobile ? "top-3 right-3" : "top-6 right-6"} text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider z-10 ${
                  isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {isQA
                  ? t("study.cardType.qa")
                  : isChoice
                    ? t("study.cardType.choice")
                    : isMultiChoice
                      ? t("study.cardType.multiChoice")
                      : isTrueFalse
                        ? t("study.cardType.trueFalse")
                        : isFillBlank
                          ? t("study.cardType.fillBlank")
                          : t("study.cardType.essay")}
              </div>

              {/* Semantic Similarity Hint */}
              {similarityWithPrev !== null && similarityWithPrev > 0.75 && (
                <div
                  className={`absolute ${isMobile ? "top-3 left-3" : "top-6 left-6"} text-[10px] font-bold px-2.5 py-1 rounded-full z-10 flex items-center gap-1 ${
                    isDark
                      ? "bg-amber-900/40 text-amber-400 border border-amber-700/50"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}
                >
                  <AlertTriangle size={10} />
                  {t("study.semantic.similar", { percent: Math.round(similarityWithPrev * 100) })}
                </div>
              )}

              <div
                className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "pr-0" : "pr-1"} space-y-4 md:space-y-8 mt-2 md:mt-4`}
              >
                {/* Question Section */}
                <div className="flex flex-col items-start text-left">
                  <h3
                    className={`uppercase tracking-widest text-[10px] md:text-[11px] font-bold mb-2 md:mb-3 px-2 md:px-3 py-0.5 md:py-1 rounded-md ${
                      isDark
                        ? "bg-primary-900/30 text-primary-400"
                        : "bg-primary-50 text-primary-600"
                    }`}
                  >
                    {t("study.quiz.question")}
                  </h3>
                  <div
                    className={`${isMobile ? "text-base" : "text-lg md:text-xl"} font-semibold leading-snug ${isDark ? "text-slate-100" : "text-gray-900"}`}
                  >
                    {currentCard.question}
                  </div>
                </div>

                {/* Answer Content Section */}
                <div className="w-full pb-4 md:pb-6">
                  {showAnswer && (
                    <div className="space-y-4 md:space-y-8 animate-fade-in">
                      {(isQA || isEssay || isFillBlank) && (
                        <div
                          className={`border-t ${isMobile ? "pt-4" : "pt-8"} ${isDark ? "border-slate-700" : "border-gray-100"}`}
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

                      {currentCard.explanation && (
                        <div
                          className={`border-t ${isMobile ? "pt-4" : "pt-8"} ${isDark ? "border-slate-700" : "border-gray-100"}`}
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
                  )}

                  {/* Choice Options */}
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

                  {/* Multi-Choice Options */}
                  {isMultiChoice && currentOptions.length > 0 && (
                    <div className="flex flex-col gap-2 md:gap-2 mt-3 md:mt-4">
                      {currentOptions.map((option: string, idx: number) => {
                        const selectedList = selectedOption
                          ? JSON.parse(selectedOption)
                          : [];
                        const isSelected = selectedList.includes(option);
                        let correctList: string[] = [];
                        try {
                          correctList = JSON.parse(currentCard.answer);
                        } catch {
                          correctList = [];
                        }
                        const isCorrect = correctList.includes(option);

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

                  {/* True/False Options */}
                  {isTrueFalse && (
                    <div
                      className={`flex ${isMobile ? "flex-col gap-3" : "flex-col md:flex-row gap-3"} justify-center mt-3 md:mt-4`}
                    >
                      {["True", "False"].map((option) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = option === currentCard.answer;

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
                </div>
              </div>

              {/* Action Footer */}
              <div
                className={`mt-auto ${isMobile ? "pt-4" : "pt-6"} border-t ${isDark ? "border-slate-700" : "border-gray-100"}`}
              >
                <AnimatePresence mode="wait">
                  {!showAnswer ? (
                    <motion.div
                      key="submit-action"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full"
                    >
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
                          disabled={
                            !selectedOption ||
                            JSON.parse(selectedOption).length === 0
                          }
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
                    </motion.div>
                  ) : (
                    <motion.div
                      key="rating-action"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full"
                    >
                      <div
                        className={`flex items-center gap-2 mb-2 md:mb-4 text-slate-400 dark:text-slate-500`}
                      >
                        <Check size={14} />
                        <h4 className="font-bold tracking-wider text-[10px] uppercase">
                          {t("study.quiz.rateMemory")}
                        </h4>
                        {updateProgressMutation.isPending && (
                          <span
                            className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary-500"
                            role="status"
                            aria-live="polite"
                          >
                            <span
                              className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                              aria-hidden="true"
                            />
                            {t("study.rating.submitting")}
                          </span>
                        )}
                      </div>
                      <div
                        className={`grid ${isMobile ? "grid-cols-4 gap-2" : "grid-cols-2 md:grid-cols-4 gap-3"}`}
                      >
                        <button
                          onClick={() => onRate(1)}
                          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
                            isDark
                              ? "bg-red-900/20 text-red-400 hover:bg-red-900/40"
                              : "bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <span
                            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
                          >
                            1
                          </span>
                          <ThumbsDown
                            size={isMobile ? 16 : 16}
                            className={isMobile ? "mb-1" : "mb-1"}
                          />
                          <span className={isMobile ? "text-xs" : "text-xs"}>
                            {t("study.rating.again")}
                          </span>
                        </button>
                        <button
                          onClick={() => onRate(2)}
                          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
                            isDark
                              ? "bg-orange-900/20 text-orange-400 hover:bg-orange-900/40"
                              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <span
                            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
                          >
                            2
                          </span>
                          <span className={isMobile ? "text-xs" : "text-xs"}>
                            {t("study.rating.hard")}
                          </span>
                        </button>
                        <button
                          onClick={() => onRate(3)}
                          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
                            isDark
                              ? "bg-primary-900/20 text-primary-400 hover:bg-primary-900/40"
                              : "bg-primary-50 text-primary-700 hover:bg-primary-100"
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <span
                            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
                          >
                            3
                          </span>
                          <ThumbsUp
                            size={isMobile ? 16 : 16}
                            className={isMobile ? "mb-1" : "mb-1"}
                          />
                          <span className={isMobile ? "text-xs" : "text-xs"}>
                            {t("study.rating.good")}
                          </span>
                        </button>
                        <button
                          onClick={() => onRate(4)}
                          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
                            isDark
                              ? "bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                          disabled={updateProgressMutation.isPending}
                        >
                          <span
                            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
                          >
                            4
                          </span>
                          <span className={isMobile ? "text-xs" : "text-xs"}>
                            {t("study.rating.easy")}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Swipe Instructions */}
        {!showAnswer && !isMobile && (
          <div className="mt-8 text-center animate-bounce-slow">
            <p
              className={`text-sm font-medium ${isDark ? "text-slate-500" : "text-gray-400"}`}
            >
              {t("study.quiz.swipeInstruction")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  RefreshCw,
  Clock,
  Target,
  Layers,
} from "lucide-react";
import { formatTimeFromSeconds } from "../../utils/formatters";
import {
  QuizFlashLayout,
  type QuizFlashLayoutProps,
} from "./QuizFlashLayout";
import {
  QuizFocusLayout,
} from "./QuizFocusLayout";

export type QuizViewActiveProps = QuizFlashLayoutProps & {
  quizCardsLength: number;
  layoutMode?: "flash" | "focus";
  onPrev?: () => void;
  onNext?: () => void;
};

export type { QuizFlashLayoutProps };

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

export const QuizViewActive = memo(function QuizViewActive(props: QuizViewActiveProps) {
  const layoutMode = props.layoutMode ?? "flash";
  const { onPrev, onNext } = props;

  const handlePrevCardProp = onPrev ?? (() => {});
  const handleNextCardProp = onNext ?? (() => {});

  return (
    <>
      {layoutMode === "flash" ? (
        <QuizFlashLayout {...props} />
      ) : (
        <QuizFocusLayout
          isDark={props.isDark}
          isMobile={props.isMobile}
          currentCard={props.currentCard}
          currentCardIndex={props.currentCardIndex}
          quizCardsLength={props.quizCardsLength}
          showAnswer={props.showAnswer}
          selectedOption={props.selectedOption}
          shuffledOptions={props.shuffledOptions}
          updateProgressMutation={props.updateProgressMutation}
          onRate={props.onRate}
          onOptionClick={props.onOptionClick}
          onMultiOptionClick={props.onMultiOptionClick}
          onSetShowAnswer={props.onSetShowAnswer}
          onPrev={handlePrevCardProp}
          onNext={handleNextCardProp}
          onSuggestedQualityChange={props.onSuggestedQualityChange}
          _swipeDirection={props.swipeDirection}
          _onDragEnd={props.onDragEnd}
          _cardKey={props.cardKey}
          _similarityWithPrev={props.similarityWithPrev}
        />
      )}
    </>
  );
});

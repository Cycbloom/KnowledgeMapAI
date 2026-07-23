import { useLayoutEffect, useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useStudyCards, useSemanticGroups, useReviewForecast } from "../hooks/queries";
import { StudyCard } from "../types";
import { QuestionBank } from "../components/Study/QuestionBank";
import { FocusStats } from "../components/Study/FocusStats";
import { QuizList, QuizGenerationModal } from "../components/Quiz";
import { useTheme, useIsMobile } from "../hooks";
import { api } from "../services/api";
import { useCardReviewLogic } from "../hooks/useCardReviewLogic";
import { useQuizLogic } from "../hooks/useQuizLogic";
import { StudyHeader } from "../components/Study/StudyHeader";
import { CardReviewView } from "../components/Study/CardReviewView";
import { QuizViewFinished, QuizViewActive } from "../components/Study/QuizView";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { useCelebration } from "@/hooks/common";
import type { WeakPoint, Prediction } from "../components/Study/WeakPointAnalysis";
import { themeClasses } from "@/utils/themeClasses";

export const Study = () => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const graphId = searchParams.get("graph_id");
  const nodeId = searchParams.get("node_id");
  const nodeIds = searchParams.get("node_ids");
  const mode = searchParams.get("mode");
  const from = searchParams.get("from");

  const scopeParams = useMemo(() => {
    if (nodeIds) return { knowledge_point_ids: nodeIds.split(",") };
    if (nodeId) return { knowledge_point_id: nodeId };
    if (graphId) return { graph_id: graphId };
    return undefined;
  }, [graphId, nodeId, nodeIds]);

  const { data: allCardsData, isLoading } = useStudyCards(scopeParams);
  const { data: dueCardsData } = useStudyCards(
    scopeParams ? { ...scopeParams, due: true } : { due: true },
  );
  const { data: semanticGroupsData } = useSemanticGroups(graphId ?? undefined);
  const { data: forecastData } = useReviewForecast(scopeParams);

  const [semanticSimilarityMap, setSemanticSimilarityMap] = useState<Map<string, Map<string, number>>>(new Map());

  useEffect(() => {
    if (semanticGroupsData && typeof semanticGroupsData === "object" && "interference_pairs" in semanticGroupsData) {
      const map = new Map<string, Map<string, number>>();
      const pairs = (semanticGroupsData as { interference_pairs: Array<{ kpId1: string; kpId2: string; similarity: number }> }).interference_pairs;
      for (const pair of pairs) {
        if (!map.has(pair.kpId1)) map.set(pair.kpId1, new Map());
        if (!map.has(pair.kpId2)) map.set(pair.kpId2, new Map());
        map.get(pair.kpId1)?.set(pair.kpId2, pair.similarity);
        map.get(pair.kpId2)?.set(pair.kpId1, pair.similarity);
      }
      setSemanticSimilarityMap(map);
    }
  }, [semanticGroupsData]);

  const allCards = useMemo(
    () => (Array.isArray(allCardsData) ? (allCardsData as StudyCard[]) : []),
    [allCardsData],
  );
  const dueCards = useMemo(
    () => (Array.isArray(dueCardsData) ? (dueCardsData as StudyCard[]) : []),
    [dueCardsData],
  );

  // View State
  const [viewState, setViewState] = useState<
    "dashboard" | "quiz" | "bank" | "focus" | "quizzes"
  >("dashboard");
  const [showQuizModal, setShowQuizModal] = useState(false);

  // Card review logic hook
  const cardReview = useCardReviewLogic({
    semanticSimilarityMap,
    isMobile: isMobile ?? false,
  });

  // 庆祝动画:复习 session 结束时触发(Task 19.2)
  const { triggerCelebration } = useCelebration();
  useEffect(() => {
    if (cardReview.finished) {
      triggerCelebration("review-finished");
    }
  }, [cardReview.finished, triggerCelebration]);

  // Compute current options for keyboard shortcuts (UX2-03)
  const currentOptions: string[] = useMemo(() => {
    if (!cardReview.currentCard?.options) return [];
    if (Array.isArray(cardReview.currentCard.options))
      {return cardReview.currentCard.options;}
    try {
      if (typeof cardReview.currentCard.options === "string") {
        return JSON.parse(cardReview.currentCard.options);
      }
    } catch (e) {
      console.error("Failed to parse card options:", e);
    }
    return [];
  }, [cardReview.currentCard]);

  const isMultiChoice = cardReview.currentCard?.card_type === "multi_choice";

  // Quiz logic hook
  const quizLogic = useQuizLogic({
    showAnswer: cardReview.showAnswer,
    selectedOption: cardReview.selectedOption,
    setSelectedOption: cardReview.setSelectedOption,
    setShowAnswer: cardReview.setShowAnswer,
    setViewState,
    startCardReview: cardReview.startCardReview,
    currentOptions,
    isMultiChoice,
  });

  // Health data
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [weeklyStudyTime, setWeeklyStudyTime] = useState(0);

  // Reset state when params change
  useLayoutEffect(() => {
    cardReview.resetReviewState();
    setViewState(mode === "quiz" ? "quiz" : "dashboard");
    // 仅在路由参数变化时重置；cardReview/setViewState 为稳定引用，无需进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId, nodeId, nodeIds, mode]);

  // Auto-start quiz when mode=quiz and cards loaded
  useEffect(() => {
    if (mode === "quiz" && allCards.length > 0 && cardReview.quizCards.length === 0) {
      cardReview.startCardReview(allCards);
    }
    // 用 quizCards.length（数字）替代数组引用避免重复触发；startCardReview 通过 allCards 入参获取最新数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, allCards, cardReview.quizCards.length]);

  // Fetch health data
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const [overviewRes, weakRes, predRes] = await Promise.all([
          api.health.getOverview() as { streakDays?: number; weeklyStudyTime?: number },
          api.health.getWeakPoints() as { weakPoints?: WeakPoint[] },
          api.health.getPredictions() as { predictions?: Prediction[] },
        ]);

        setStreakDays(overviewRes?.streakDays || 0);
        setWeeklyStudyTime(overviewRes?.weeklyStudyTime || 0);
        setWeakPoints(weakRes?.weakPoints || []);
        setPredictions(predRes?.predictions || []);
      } catch (error) {
        console.error("Failed to fetch health data:", error);
      }
    };

    fetchHealthData();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = allCards.length;
    const mastered = allCards.filter((c) => (c.review_count || 0) > 0).length;
    const due = dueCards.length;

    const distribution = {
      new: allCards.filter((c) => (c.fsrs_state || "New") === "New").length,
      learning: allCards.filter((c) => (c.fsrs_state || "New") === "Learning").length,
      review: allCards.filter((c) => (c.fsrs_state || "New") === "Review").length,
      relearning: allCards.filter((c) => (c.fsrs_state || "New") === "Relearning").length,
    };

    return { total, mastered, due, distribution };
  }, [allCards, dueCards]);

  const handleBackToDashboard = () => {
    if (from === "learning" && graphId && nodeId) {
      navigate(`/learning?graph_id=${graphId}&node_id=${nodeId}`);
    } else {
      cardReview.resetReviewState();
      setViewState("dashboard");
    }
  };

  const handlePracticeCard = (card: StudyCard) => {
    cardReview.practiceSingleCard(card);
    setViewState("quiz");
  };

  if (isLoading)
    {return (
      <div
        className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"} ${isMobile ? "p-3" : "p-8"}`}
      >
        <div
          className={`${isMobile ? "max-w-full" : "max-w-6xl"} mx-auto space-y-6 md:space-y-8`}
        >
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg animate-pulse ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
            <div className={`h-7 w-40 rounded animate-pulse ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
          </div>

          {/* Stats cards skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border animate-pulse ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
                  <div className={`h-3 w-16 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
                </div>
                <div className={`h-6 w-12 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
              </div>
            ))}
          </div>

          {/* List skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border animate-pulse ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-5 w-48 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
                  <div className={`h-4 w-20 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
                </div>
                <div className={`h-4 w-full rounded mb-2 ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
                <div className={`h-4 w-2/3 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );}

  // --- Dashboard & Bank & Focus & Quizzes View ---
  if (
    viewState === "dashboard" ||
    viewState === "bank" ||
    viewState === "focus" ||
    viewState === "quizzes"
  ) {
    return (
      <div
        className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"} ${isMobile ? "p-3" : "p-8"}`}
      >
        <div
          className={`${isMobile ? "max-w-full" : "max-w-6xl"} mx-auto space-y-6 md:space-y-8`}
        >
          <StudyHeader
            isDark={isDark}
            isMobile={isMobile ?? false}
            graphId={graphId}
            nodeId={nodeId}
            nodeIds={nodeIds}
            viewState={viewState}
            setViewState={setViewState}
          />

          {viewState === "bank" ? (
            <QuestionBank cards={allCards} />
          ) : viewState === "focus" ? (
            <FocusStats />
          ) : viewState === "quizzes" ? (
            <QuizList
              onCreateQuiz={() => {
                setShowQuizModal(true);
              }}
              onEditQuiz={(quiz) => {
                navigate(`/quiz/${quiz.id}`);
              }}
              onStartPractice={(quiz) => {
                navigate(`/quiz/${quiz.id}/practice`);
              }}
              onViewQuiz={(quiz) => {
                navigate(`/quiz/${quiz.id}`);
              }}
            />
          ) : (
            <CardReviewView
              isDark={isDark}
              isMobile={isMobile ?? false}
              allCards={allCards}
              dueCards={dueCards}
              stats={stats}
              streakDays={streakDays}
              weeklyStudyTime={weeklyStudyTime}
              weakPoints={weakPoints}
              predictions={predictions}
              forecast={forecastData ?? undefined}
              onStartQuiz={(mode) => quizLogic.handleStartQuiz(mode, allCards, dueCards)}
              onPracticeCard={handlePracticeCard}
            />
          )}
        </div>

        {/* Quiz Generation Modal */}
        <QuizGenerationModal
          open={showQuizModal}
          onClose={() => setShowQuizModal(false)}
          graphId={graphId || undefined}
          onComplete={(quizSetId) => {
            setShowQuizModal(false);
            navigate(`/quiz/${quizSetId}`);
          }}
        />
      </div>
    );
  }

  // --- Quiz View: Finished ---
  if (cardReview.finished) {
    return (
      <QuizViewFinished
        isDark={isDark}
        isMobile={isMobile ?? false}
        nodeId={nodeId}
        from={from}
        quizCardsLength={cardReview.quizCards.length}
        reviewedCount={cardReview.reviewedCount}
        correctCount={cardReview.correctCount}
        sessionDuration={cardReview.sessionDuration}
        onBackToDashboard={handleBackToDashboard}
        onRestart={cardReview.handleRestart}
      />
    );
  }

  // Guard against index out of bounds if cards changed
  if (!cardReview.currentCard) return null;

  // --- Quiz View: Active ---
  return (
    <ErrorBoundary
      fallbackRender={(error, resetErrorBoundary) => (
        <div
          className={`min-h-full flex flex-col items-center justify-center ${isMobile ? "p-4" : "p-8"} ${isDark ? "bg-slate-900" : "bg-gray-100"}`}
        >
          <div
            className={`w-full max-w-md ${isDark ? "bg-slate-800" : "bg-white"} rounded-2xl shadow-xl ${isMobile ? "p-6" : "p-8"} text-center`}
          >
            <div
              className={`w-16 h-16 mx-auto mb-4 rounded-full ${isDark ? "bg-red-900/30" : "bg-red-100"} flex items-center justify-center`}
            >
              <AlertTriangle
                className={`w-8 h-8 ${isDark ? "text-red-400" : "text-red-600"}`}
              />
            </div>
            <h2
              className={`text-xl font-bold mb-2 ${isDark ? "text-slate-100" : "text-gray-900"}`}
            >
              卡片渲染失败
            </h2>
            <p
              className={`text-xs mb-4 font-mono break-all ${themeClasses.textSecondary(isDark)}`}
            >
              {error.message}
            </p>
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}
    >
      <QuizViewActive
        isDark={isDark}
        isMobile={isMobile ?? false}
        currentCard={cardReview.currentCard}
        currentCardIndex={cardReview.currentCardIndex}
        quizCardsLength={cardReview.quizCards.length}
        showAnswer={cardReview.showAnswer}
        selectedOption={cardReview.selectedOption}
        cardKey={cardReview.cardKey}
        swipeDirection={cardReview.swipeDirection}
        dragDirection={cardReview.dragDirection}
        cardRotation={cardReview.cardRotation}
        quizCards={cardReview.quizCards}
        similarityWithPrev={cardReview.similarityWithPrev}
        updateProgressMutation={cardReview.updateProgressMutation}
        onBackToDashboard={handleBackToDashboard}
        onRate={cardReview.handleRate}
        onOptionClick={quizLogic.handleOptionClick}
        onMultiOptionClick={quizLogic.handleMultiOptionClick}
        onDragEnd={cardReview.handleDragEnd}
        onSetShowAnswer={cardReview.setShowAnswer}
        onSetDragDirection={cardReview.setDragDirection}
        onSetCardRotation={cardReview.setCardRotation}
      />
    </ErrorBoundary>
  );
};

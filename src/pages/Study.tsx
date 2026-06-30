import { useLayoutEffect, useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useStudyCards, useSemanticGroups } from "../hooks/queries";
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
import type { WeakPoint, Prediction } from "../components/Study/WeakPointAnalysis";

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

  // Quiz logic hook
  const quizLogic = useQuizLogic({
    showAnswer: cardReview.showAnswer,
    selectedOption: cardReview.selectedOption,
    setSelectedOption: cardReview.setSelectedOption,
    setShowAnswer: cardReview.setShowAnswer,
    setViewState,
    startCardReview: cardReview.startCardReview,
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
  }, [graphId, nodeId, nodeIds, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start quiz when mode=quiz and cards loaded
  useEffect(() => {
    if (mode === "quiz" && allCards.length > 0 && cardReview.quizCards.length === 0) {
      cardReview.startCardReview(allCards);
    }
  }, [mode, allCards, cardReview.quizCards.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    return (
      <div
        className={`min-h-full flex items-center justify-center ${isMobile ? "p-4" : "p-8"} ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        Loading...
      </div>
    );

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
        onBackToDashboard={handleBackToDashboard}
        onRestart={cardReview.handleRestart}
      />
    );
  }

  // Guard against index out of bounds if cards changed
  if (!cardReview.currentCard) return null;

  // --- Quiz View: Active ---
  return (
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
  );
};

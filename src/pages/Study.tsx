import { useLayoutEffect, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useSemanticGroups, useReviewForecast } from "../hooks/queries";
import { queryKeys, realtimeQueryConfig } from "../hooks/queries/config";
import { StudyCard } from "../types";
import { QuestionBank } from "../components/Study/QuestionBank";
import { FocusStats } from "../components/Study/FocusStats";
import { QuizList } from "../components/Quiz";
const QuizGenerationModal = lazy(() =>
  import("../components/Quiz/QuizGenerationModal").then((module) => ({
    default: module.QuizGenerationModal,
  })),
);
import { useTheme, useIsMobile } from "../hooks";
import { api } from "../services/api";
import { useCardReviewLogic } from "../hooks/study/useCardReviewLogic";
import { useQuizLogic } from "../hooks/quiz/useQuizLogic";
import { StudyHeader } from "../components/Study/StudyHeader";
import { CardReviewView } from "../components/Study/CardReviewView";
import { QuizViewFinished, QuizViewActive } from "../components/Study/QuizView";
import { ErrorBoundary, Skeleton } from "../components/common";
import { motion } from "framer-motion";
import { useCelebration } from "@/hooks/common";
import type { WeakPoint, Prediction } from "../components/Study/WeakPointAnalysis";
import { themeClasses } from "@/utils/themeClasses";

export const Study = () => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const studyCardResults = useQueries({
    queries: [
      {
        queryKey: queryKeys.studyCards(scopeParams),
        queryFn: async () => {
          const result = await api.study.getCards(scopeParams);
          if (result && typeof result === "object" && "cards" in result) {
            return result.cards;
          }
          return result;
        },
        ...realtimeQueryConfig,
      },
      {
        queryKey: queryKeys.studyCards(
          scopeParams ? { ...scopeParams, due: true } : { due: true },
        ),
        queryFn: async () => {
          const result = await api.study.getCards(
            scopeParams ? { ...scopeParams, due: true } : { due: true },
          );
          if (result && typeof result === "object" && "cards" in result) {
            return result.cards;
          }
          return result;
        },
        ...realtimeQueryConfig,
      },
    ],
  });
  const allCardsData = studyCardResults[0].data;
  const dueCardsData = studyCardResults[1].data;
  const isLoading = studyCardResults[0].isLoading;
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

  // Health data — 使用 useQueries 并行获取，替代 useEffect 手动管理
  const healthResults = useQueries({
    queries: [
      {
        queryKey: ["health", "overview"],
        queryFn: () => api.health.getOverview() as Promise<{ streakDays?: number; weeklyStudyTime?: number }>,
        staleTime: 60000,
      },
      {
        queryKey: ["health", "weak-points"],
        queryFn: () => api.health.getWeakPoints() as Promise<{ weakPoints?: WeakPoint[] }>,
        staleTime: 60000,
      },
      {
        queryKey: ["health", "predictions"],
        queryFn: () => api.health.getPredictions() as Promise<{ predictions?: Prediction[] }>,
        staleTime: 60000,
      },
    ],
  });
  const overviewData = healthResults[0].data;
  const weakPointsData = healthResults[1].data;
  const predictionsData = healthResults[2].data;
  const streakDays = overviewData?.streakDays ?? 0;
  const weeklyStudyTime = overviewData?.weeklyStudyTime ?? 0;
  const weakPoints = weakPointsData?.weakPoints ?? [];
  const predictions = predictionsData?.predictions ?? [];

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

  // Stats
  const stats = useMemo(() => {
    const total = allCards.length;
    const distribution = { new: 0, learning: 0, review: 0, relearning: 0 };
    let mastered = 0;
    // 单趟统计掌握数与各状态分布，替代五次 filter 的 O(5*allCards) 扫描
    for (const c of allCards) {
      if ((c.review_count || 0) > 0) mastered++;
      switch (c.fsrs_state || "New") {
        case "New":
          distribution.new++;
          break;
        case "Learning":
          distribution.learning++;
          break;
        case "Review":
          distribution.review++;
          break;
        case "Relearning":
          distribution.relearning++;
          break;
      }
    }
    const due = dueCards.length;

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"} ${isMobile ? "p-3" : "p-8"}`}
      >
        <div
          className={`${isMobile ? "max-w-full" : "max-w-6xl"} mx-auto space-y-6 md:space-y-8`}
        >
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={32} height={32} />
            <Skeleton variant="text" width={160} height={28} />
          </div>

          {/* Stats cards skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton variant="rectangular" width={32} height={32} />
                  <Skeleton variant="text" width={64} height={12} />
                </div>
                <Skeleton variant="text" width={48} height={24} />
              </div>
            ))}
          </div>

          {/* List skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Skeleton variant="text" width={192} height={20} />
                  <Skeleton variant="text" width={80} height={16} />
                </div>
                <div className="space-y-2">
                  <Skeleton variant="text" width="100%" height={16} />
                  <Skeleton variant="text" width="66.67%" height={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
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
          <h1 className="sr-only">{t('study.title')}</h1>
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
            <QuestionBank {...scopeParams} />
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
        <Suspense fallback={null}>
          <QuizGenerationModal
            open={showQuizModal}
            onClose={() => setShowQuizModal(false)}
            graphId={graphId || undefined}
            onComplete={(quizSetId) => {
              setShowQuizModal(false);
              navigate(`/quiz/${quizSetId}`);
            }}
          />
        </Suspense>
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
        quizCards={cardReview.quizCards}
        similarityWithPrev={cardReview.similarityWithPrev}
        updateProgressMutation={cardReview.updateProgressMutation}
        onBackToDashboard={handleBackToDashboard}
        onRate={cardReview.handleRate}
        onOptionClick={quizLogic.handleOptionClick}
        onMultiOptionClick={quizLogic.handleMultiOptionClick}
        onDragEnd={cardReview.handleDragEnd}
        onSetShowAnswer={cardReview.setShowAnswer}
      />
    </ErrorBoundary>
  );
};

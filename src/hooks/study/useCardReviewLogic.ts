import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { useUpdateCardProgressMutation } from "../mutations";
import { message } from "../../utils/messageHelper";

interface UseCardReviewLogicParams {
  semanticSimilarityMap: Map<string, Map<string, number>>;
  isMobile: boolean;
}

export const useCardReviewLogic = ({
  semanticSimilarityMap,
  isMobile,
}: UseCardReviewLogicParams) => {
  const { t } = useTranslation();
  const updateProgressMutation = useUpdateCardProgressMutation();

  const [quizCards, setQuizCards] = useState<StudyCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [prevKnowledgePointId, setPrevKnowledgePointId] = useState<
    string | null
  >(null);

  // Swipe state
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null,
  );
  const [cardKey, setCardKey] = useState(0);

  // Session tracking (UX2-09)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Semantic-aware shuffle
  const semanticAwareShuffle = useCallback(
    (cards: StudyCard[]) => {
      if (cards.length <= 2 || semanticSimilarityMap.size === 0) {
        cards.sort(() => Math.random() - 0.5);
        return;
      }

      const unused: number[] = cards.map((_, i) => i);
      const result: StudyCard[] = [];

      const startIdx = Math.floor(Math.random() * cards.length);
      result.push(cards[startIdx]);
      unused.splice(startIdx, 1);

      while (result.length < cards.length) {
        const lastKpId = result[result.length - 1].knowledge_point_id;
        const simMap = semanticSimilarityMap.get(lastKpId);

        let bestPos = -1;
        let bestIdx = -1;
        let bestSimilarity = Infinity;

        // Only scan the remaining unused candidates instead of the full array,
        // avoiding the repeated `used.has` check on every position.
        for (let p = 0; p < unused.length; p++) {
          const i = unused[p];
          const candidateKpId = cards[i].knowledge_point_id;
          const sim = simMap?.get(candidateKpId) ?? 0;

          if (
            sim < bestSimilarity ||
            (sim === bestSimilarity && Math.random() < 0.5)
          ) {
            bestSimilarity = sim;
            bestIdx = i;
            bestPos = p;
          }
        }

        if (bestIdx === -1) break;
        result.push(cards[bestIdx]);
        unused.splice(bestPos, 1);
      }

      for (let p = 0; p < unused.length; p++) {
        result.push(cards[unused[p]]);
      }

      cards.length = 0;
      cards.push(...result);
    },
    [semanticSimilarityMap],
  );

  const handleNextCard = useCallback(() => {
    if (currentCardIndex < quizCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setShowAnswer(false);
      setSelectedOption(null);
    } else {
      setSessionDuration(
        sessionStartTime
          ? Math.floor((Date.now() - sessionStartTime) / 1000)
          : 0,
      );
      setFinished(true);
    }
  }, [currentCardIndex, quizCards.length, sessionStartTime]);

  const handlePrevCard = useCallback(() => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => Math.max(0, prev - 1));
      setShowAnswer(false);
      setSelectedOption(null);
    }
  }, [currentCardIndex]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (!quizCards[currentCardIndex]) return;

      setReviewedCount((prev) => prev + 1);
      if (quality >= 3) setCorrectCount((prev) => prev + 1);

      try {
        await updateProgressMutation.mutateAsync({
          id: quizCards[currentCardIndex].id,
          quality,
        });
        handleNextCard();
      } catch (err) {
        console.error(err);
        message.error(t("study.messages.saveProgressFailed"));
      }
    },
    [quizCards, currentCardIndex, updateProgressMutation, handleNextCard, t],
  );

  const handleSwipeRate = useCallback(
    async (quality: number) => {
      if (!quizCards[currentCardIndex]) return;

      setReviewedCount((prev) => prev + 1);
      if (quality >= 3) setCorrectCount((prev) => prev + 1);

      try {
        await updateProgressMutation.mutateAsync({
          id: quizCards[currentCardIndex].id,
          quality,
        });
        setPrevKnowledgePointId(quizCards[currentCardIndex].knowledge_point_id);
      } catch (err) {
        console.error(err);
        message.error(t("study.messages.saveProgressFailed"));
      }
    },
    [quizCards, currentCardIndex, updateProgressMutation, t],
  );

  const handleRestart = useCallback(() => {
    setFinished(false);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setSwipeDirection(null);
    setCardKey((k) => k + 1);
    setPrevKnowledgePointId(null);
    setSessionStartTime(Date.now());
    setSessionDuration(0);
    setReviewedCount(0);
    setCorrectCount(0);

    setQuizCards((prev) => {
      const next = [...prev];
      semanticAwareShuffle(next);
      return next;
    });
  }, [semanticAwareShuffle]);

  const handleDragEnd = useCallback(
    (
      _: unknown,
      info: { velocity: { x: number }; offset: { x: number } },
    ) => {
      const threshold = isMobile ? 60 : 100;
      const velocity = info.velocity.x;
      const offset = info.offset.x;

      const shouldSwipeRight =
        offset > threshold || (offset > 30 && velocity > 300);
      const shouldSwipeLeft =
        offset < -threshold || (offset < -30 && velocity < -300);

      if (shouldSwipeRight) {
        setSwipeDirection("right");
        handleSwipeRate(3);
        setTimeout(() => {
          handleNextCard();
          setCardKey((k) => k + 1);
          setSwipeDirection(null);
        }, isMobile ? 300 : 450);
      } else if (shouldSwipeLeft) {
        setSwipeDirection("left");
        handleSwipeRate(1);
        setTimeout(() => {
          handleNextCard();
          setCardKey((k) => k + 1);
          setSwipeDirection(null);
        }, isMobile ? 300 : 450);
      }
    },
    [isMobile, handleSwipeRate, handleNextCard],
  );

  const startCardReview = useCallback(
    (cards: StudyCard[]) => {
      const next = [...cards];
      semanticAwareShuffle(next);
      setQuizCards(next);
      setCurrentCardIndex(0);
      setFinished(false);
      setShowAnswer(false);
      setSelectedOption(null);
      setPrevKnowledgePointId(null);
      setSessionStartTime(Date.now());
      setSessionDuration(0);
      setReviewedCount(0);
      setCorrectCount(0);
    },
    [semanticAwareShuffle],
  );

  const practiceSingleCard = useCallback((card: StudyCard) => {
    setQuizCards([card]);
    setCurrentCardIndex(0);
    setFinished(false);
    setShowAnswer(false);
    setSelectedOption(null);
    setSessionStartTime(Date.now());
    setSessionDuration(0);
    setReviewedCount(0);
    setCorrectCount(0);
  }, []);

  const resetReviewState = useCallback(() => {
    setQuizCards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setFinished(false);
    setPrevKnowledgePointId(null);
    setSessionStartTime(null);
    setSessionDuration(0);
    setReviewedCount(0);
    setCorrectCount(0);
  }, []);

  const currentCard = quizCards[currentCardIndex];

  const similarityWithPrev = (() => {
    if (!currentCard?.knowledge_point_id || !prevKnowledgePointId) return null;
    return (
      semanticSimilarityMap
        .get(prevKnowledgePointId)
        ?.get(currentCard.knowledge_point_id) ?? null
    );
  })();

  // FSRS rating keyboard shortcuts (UX2-02)
  const canRateWithKeyboard =
    showAnswer &&
    !updateProgressMutation.isPending &&
    !swipeDirection &&
    !finished &&
    !!currentCard;

  useEffect(() => {
    if (!canRateWithKeyboard) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;

      const key = event.key;
      if (key === "1") {
        event.preventDefault();
        handleRate(1);
      } else if (key === "2") {
        event.preventDefault();
        handleRate(2);
      } else if (key === "3") {
        event.preventDefault();
        handleRate(3);
      } else if (key === "4") {
        event.preventDefault();
        handleRate(4);
      } else if (key === " " || key === "Enter") {
        event.preventDefault();
        handleRate(3);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRateWithKeyboard, handleRate]);

  return {
    // State
    quizCards,
    currentCardIndex,
    showAnswer,
    finished,
    selectedOption,
    swipeDirection,
    cardKey,
    currentCard,
    similarityWithPrev,
    updateProgressMutation,

    // Session stats (UX2-09)
    sessionStartTime,
    sessionDuration,
    reviewedCount,
    correctCount,

    // State setters
    setShowAnswer,
    setSelectedOption,
    setQuizCards,
    setCurrentCardIndex,
    setFinished,
    setCardKey,
    setSwipeDirection,
    setSessionDuration,

    // Actions
    handleRate,
    handleSwipeRate,
    handleNextCard,
    handlePrevCard,
    handleRestart,
    handleDragEnd,
    semanticAwareShuffle,
    startCardReview,
    practiceSingleCard,
    resetReviewState,
  };
};
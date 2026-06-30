import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { useUpdateCardProgressMutation } from "./mutations";
import { frontendEventBus } from "../services/timer/FrontendEventBus";

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
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(
    null,
  );
  const [cardKey, setCardKey] = useState(0);
  const [cardRotation, setCardRotation] = useState(0);

  // Semantic-aware shuffle
  const semanticAwareShuffle = useCallback(
    (cards: StudyCard[]) => {
      if (cards.length <= 2 || semanticSimilarityMap.size === 0) {
        cards.sort(() => Math.random() - 0.5);
        return;
      }

      const used = new Set<number>();
      const result: StudyCard[] = [];

      const startIdx = Math.floor(Math.random() * cards.length);
      result.push(cards[startIdx]);
      used.add(startIdx);

      while (result.length < cards.length) {
        const lastKpId = result[result.length - 1].knowledge_point_id;
        const simMap = semanticSimilarityMap.get(lastKpId);

        let bestIdx = -1;
        let bestSimilarity = Infinity;

        for (let i = 0; i < cards.length; i++) {
          if (used.has(i)) continue;
          const candidateKpId = cards[i].knowledge_point_id;
          const sim = simMap?.get(candidateKpId) ?? 0;

          if (
            sim < bestSimilarity ||
            (sim === bestSimilarity && Math.random() < 0.5)
          ) {
            bestSimilarity = sim;
            bestIdx = i;
          }
        }

        if (bestIdx === -1) break;
        result.push(cards[bestIdx]);
        used.add(bestIdx);
      }

      for (let i = 0; i < cards.length; i++) {
        if (!used.has(i)) result.push(cards[i]);
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
      setFinished(true);
    }
  }, [currentCardIndex, quizCards.length]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (!quizCards[currentCardIndex]) return;

      try {
        await updateProgressMutation.mutateAsync({
          id: quizCards[currentCardIndex].id,
          quality,
        });
        handleNextCard();
      } catch (err) {
        console.error(err);
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("study.messages.saveProgressFailed"),
        });
      }
    },
    [quizCards, currentCardIndex, updateProgressMutation, handleNextCard, t],
  );

  const handleSwipeRate = useCallback(
    async (quality: number) => {
      if (!quizCards[currentCardIndex]) return;

      try {
        await updateProgressMutation.mutateAsync({
          id: quizCards[currentCardIndex].id,
          quality,
        });
        setPrevKnowledgePointId(quizCards[currentCardIndex].knowledge_point_id);
      } catch (err) {
        console.error(err);
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("study.messages.saveProgressFailed"),
        });
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

      setDragDirection(null);
      setCardRotation(0);

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
    },
    [semanticAwareShuffle],
  );

  const practiceSingleCard = useCallback((card: StudyCard) => {
    setQuizCards([card]);
    setCurrentCardIndex(0);
    setFinished(false);
    setShowAnswer(false);
    setSelectedOption(null);
  }, []);

  const resetReviewState = useCallback(() => {
    setQuizCards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setFinished(false);
    setPrevKnowledgePointId(null);
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

  return {
    // State
    quizCards,
    currentCardIndex,
    showAnswer,
    finished,
    selectedOption,
    swipeDirection,
    dragDirection,
    cardKey,
    cardRotation,
    currentCard,
    similarityWithPrev,
    updateProgressMutation,

    // State setters
    setShowAnswer,
    setSelectedOption,
    setDragDirection,
    setCardRotation,
    setQuizCards,
    setCurrentCardIndex,
    setFinished,
    setCardKey,
    setSwipeDirection,

    // Actions
    handleRate,
    handleSwipeRate,
    handleNextCard,
    handleRestart,
    handleDragEnd,
    semanticAwareShuffle,
    startCardReview,
    practiceSingleCard,
    resetReviewState,
  };
};

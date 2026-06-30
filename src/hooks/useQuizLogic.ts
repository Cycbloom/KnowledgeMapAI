import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { frontendEventBus } from "../services/timer/FrontendEventBus";

interface UseQuizLogicParams {
  showAnswer: boolean;
  selectedOption: string | null;
  setSelectedOption: (option: string | null) => void;
  setShowAnswer: (show: boolean) => void;
  setViewState: (state: "dashboard" | "quiz" | "bank" | "focus" | "quizzes") => void;
  startCardReview: (cards: StudyCard[]) => void;
}

export const useQuizLogic = ({
  showAnswer,
  selectedOption,
  setSelectedOption,
  setShowAnswer,
  setViewState,
  startCardReview,
}: UseQuizLogicParams) => {
  const { t } = useTranslation();

  const handleStartQuiz = useCallback(
    (mode: "all" | "due", allCards: StudyCard[], dueCards: StudyCard[]) => {
      const selected = mode === "due" ? dueCards : allCards;

      if (selected.length === 0) {
        frontendEventBus.publish("message_show", {
          content: t("study.messages.noCardsToReview"),
          type: "info",
        });
        return;
      }

      startCardReview(selected);
      setViewState("quiz");
    },
    [t, startCardReview, setViewState],
  );

  const handleOptionClick = useCallback(
    (option: string) => {
      if (showAnswer) return;
      setSelectedOption(option);
      setShowAnswer(true);
    },
    [showAnswer, setSelectedOption, setShowAnswer],
  );

  const handleMultiOptionClick = useCallback(
    (option: string) => {
      if (showAnswer) return;
      const currentSelected = selectedOption ? JSON.parse(selectedOption) : [];
      const newSelected = currentSelected.includes(option)
        ? currentSelected.filter((o: string) => o !== option)
        : [...currentSelected, option];
      setSelectedOption(JSON.stringify(newSelected));
    },
    [showAnswer, selectedOption, setSelectedOption],
  );

  return {
    handleStartQuiz,
    handleOptionClick,
    handleMultiOptionClick,
  };
};

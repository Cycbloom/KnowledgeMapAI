import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { message } from "../../utils/messageHelper";

interface UseQuizLogicParams {
  showAnswer: boolean;
  selectedOption: string | null;
  setSelectedOption: (option: string | null) => void;
  setShowAnswer: (show: boolean) => void;
  setViewState: (state: "dashboard" | "quiz" | "bank" | "quizzes") => void;
  startCardReview: (cards: StudyCard[]) => void;
  currentOptions: string[];
  isMultiChoice: boolean;
}

export const useQuizLogic = ({
  showAnswer,
  selectedOption,
  setSelectedOption,
  setShowAnswer,
  setViewState,
  startCardReview,
  currentOptions,
  isMultiChoice,
}: UseQuizLogicParams) => {
  const { t } = useTranslation();

  const handleStartQuiz = useCallback(
    (mode: "all" | "due", allCards: StudyCard[], dueCards: StudyCard[]) => {
      const selected = mode === "due" ? dueCards : allCards;

      if (selected.length === 0) {
        message.info(t("study.messages.noCardsToReview"));
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

  // Quiz option keyboard shortcuts (UX2-03)
  const canSelectWithKeyboard = !showAnswer && currentOptions.length > 0;

  useEffect(() => {
    if (!canSelectWithKeyboard) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;

      let optionIndex = -1;
      const key = event.key.toLowerCase();
      if (key >= "1" && key <= "9") {
        optionIndex = Number(key) - 1;
      } else if (key >= "a" && key <= "i") {
        optionIndex = key.charCodeAt(0) - "a".charCodeAt(0);
      }

      if (optionIndex < 0 || optionIndex >= currentOptions.length) return;

      event.preventDefault();
      const option = currentOptions[optionIndex];
      if (isMultiChoice) {
        handleMultiOptionClick(option);
      } else {
        handleOptionClick(option);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSelectWithKeyboard, currentOptions, isMultiChoice, handleOptionClick, handleMultiOptionClick]);

  return {
    handleStartQuiz,
    handleOptionClick,
    handleMultiOptionClick,
  };
};
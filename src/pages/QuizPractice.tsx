import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  X,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  Flag,
  Layers,
} from 'lucide-react';
import { useTheme } from '../hooks';
import { useQuizSet } from '../hooks/queries';
import { QuizProgressBar } from '../components/Quiz/QuizProgressBar';
import { QuizResult } from '../components/Quiz/QuizResult';
import { Skeleton } from '../components/common';
import { EmptyState } from '@/components/common/EmptyState';
import type { StudyCard } from '@shared/types/common';

interface AnswerRecord {
  cardId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
}

export const QuizPractice: React.FC = () => {
  const { t } = useTranslation();
  const { quizSetId } = useParams<{ quizSetId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const cardTypeLabels: Record<string, string> = useMemo(() => ({
    qa: t('study.quizPractice.cardType.qa'),
    choice: t('study.quizPractice.cardType.choice'),
    multi_choice: t('study.quizPractice.cardType.multi_choice'),
    true_false: t('study.quizPractice.cardType.true_false'),
    fill_in_the_blank: t('study.quizPractice.cardType.fill_in_the_blank'),
    essay: t('study.quizPractice.cardType.essay'),
  }), [t]);

  const { data: quizSetData, isLoading, error } = useQuizSet(quizSetId || '');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [practiceCards, setPracticeCards] = useState<StudyCard[] | null>(null);

  // Session timing (UX2-04, UX2-12)
  const [sessionStartTime] = useState<number>(() => Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now());
  const [questionTimings, setQuestionTimings] = useState<Array<{ cardId: string; duration: number }>>([]);

  // Flagged questions (UX2-11)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  const cards = useMemo(() => {
    if (practiceCards) return practiceCards;
    if (!quizSetData?.cards) return [];
    return quizSetData.cards as StudyCard[];
  }, [quizSetData, practiceCards]);

  const currentCard = cards[currentIndex];

  const currentOptions: string[] = useMemo(() => {
    if (!currentCard?.options) return [];
    if (Array.isArray(currentCard.options)) return currentCard.options;
    try {
      if (typeof currentCard.options === 'string') {
        return JSON.parse(currentCard.options);
      }
    } catch {
      console.error('Failed to parse card options');
    }
    return [];
  }, [currentCard]);

  const answered = useMemo(() => {
    const result = new Array(cards.length).fill(false);
    // 预构建 cardId -> index 映射，避免每个 answerRecord 线性扫描 cards（原为 O(records*cards)）
    const cardIndexMap = new Map<string, number>();
    cards.forEach((c, i) => {
      cardIndexMap.set(c.id, i);
    });
    answerRecords.forEach((record) => {
      const index = cardIndexMap.get(record.cardId) ?? -1;
      if (index >= 0) result[index] = true;
    });
    return result;
  }, [cards, answerRecords]);

  const isQA = !currentCard?.card_type || currentCard?.card_type === 'qa';
  const isChoice = currentCard?.card_type === 'choice';
  const isMultiChoice = currentCard?.card_type === 'multi_choice';
  const isTrueFalse = currentCard?.card_type === 'true_false';
  const isFillBlank = currentCard?.card_type === 'fill_in_the_blank';
  const isEssay = currentCard?.card_type === 'essay';

  // Options used for keyboard shortcuts (UX2-03): true_false uses hardcoded options
  const keyboardOptions = useMemo(() => {
    if (isTrueFalse) return ['True', 'False'];
    return currentOptions;
  }, [isTrueFalse, currentOptions]);

  // Record per-question timing (UX2-12)
  const recordQuestionTime = useCallback(
    (cardId: string) => {
      const duration = Math.floor((Date.now() - questionStartTime) / 1000);
      setQuestionTimings((prev) => {
        const filtered = prev.filter((t) => t.cardId !== cardId);
        return [...filtered, { cardId, duration }];
      });
    },
    [questionStartTime]
  );

  // Toggle flag for current question (UX2-11)
  const toggleFlag = useCallback(() => {
    if (!currentCard) return;
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) {
        next.delete(currentCard.id);
      } else {
        next.add(currentCard.id);
      }
      return next;
    });
  }, [currentCard]);

  // Reset question start time when navigating to a new question (UX2-12)
  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [currentIndex]);

  const checkAnswer = useCallback(
    (card: StudyCard, userAnswer: string): boolean => {
      if (isChoice || isTrueFalse) {
        return userAnswer === card.answer;
      }
      if (isMultiChoice) {
        const correctAnswers = JSON.parse(card.answer);
        const userAnswers = JSON.parse(userAnswer);
        return (
          correctAnswers.length === userAnswers.length &&
          correctAnswers.every((a: string) => userAnswers.includes(a))
        );
      }
      return false;
    },
    [isChoice, isTrueFalse, isMultiChoice]
  );

  const handleOptionClick = useCallback(
    (option: string) => {
      if (showAnswer) return;
      setSelectedOption(option);
      setShowAnswer(true);
      recordQuestionTime(currentCard.id);

      const isCorrect = checkAnswer(currentCard, option);
      setAnswerRecords((prev) => [
        ...prev.filter((r) => r.cardId !== currentCard.id),
        {
          cardId: currentCard.id,
          isCorrect,
          userAnswer: option,
          correctAnswer: currentCard.answer,
        },
      ]);
    },
    [showAnswer, currentCard, checkAnswer, recordQuestionTime]
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
    [showAnswer, selectedOption]
  );

  // Quiz option keyboard shortcuts (UX2-03)
  const canSelectWithKeyboard = !showAnswer && keyboardOptions.length > 0;

  useEffect(() => {
    if (!canSelectWithKeyboard) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      let optionIndex = -1;
      const key = event.key.toLowerCase();
      if (key === 'a' || key === '1') optionIndex = 0;
      else if (key === 'b' || key === '2') optionIndex = 1;
      else if (key === 'c' || key === '3') optionIndex = 2;
      else if (key === 'd' || key === '4') optionIndex = 3;

      if (optionIndex < 0 || optionIndex >= keyboardOptions.length) return;

      event.preventDefault();
      const option = keyboardOptions[optionIndex];
      if (isMultiChoice) {
        handleMultiOptionClick(option);
      } else {
        handleOptionClick(option);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canSelectWithKeyboard,
    keyboardOptions,
    isMultiChoice,
    handleMultiOptionClick,
    handleOptionClick,
  ]);

  const handleSubmitMultiChoice = () => {
    if (!selectedOption || JSON.parse(selectedOption).length === 0) return;
    setShowAnswer(true);
    recordQuestionTime(currentCard.id);

    const isCorrect = checkAnswer(currentCard, selectedOption);
    setAnswerRecords((prev) => [
      ...prev.filter((r) => r.cardId !== currentCard.id),
      {
        cardId: currentCard.id,
        isCorrect,
        userAnswer: selectedOption,
        correctAnswer: currentCard.answer,
      },
    ]);
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    recordQuestionTime(currentCard.id);
    setAnswerRecords((prev) => [
      ...prev.filter((r) => r.cardId !== currentCard.id),
      {
        cardId: currentCard.id,
        isCorrect: false,
        userAnswer: '',
        correctAnswer: currentCard.answer,
      },
    ]);
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setSelectedOption(null);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(answered[currentIndex - 1]);
      const record = answerRecords.find((r) => r.cardId === cards[currentIndex - 1]?.id);
      setSelectedOption(record?.userAnswer || null);
    }
  };

  const handleJump = (index: number) => {
    setCurrentIndex(index);
    setShowAnswer(answered[index]);
    const record = answerRecords.find((r) => r.cardId === cards[index]?.id);
    setSelectedOption(record?.userAnswer || null);
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setAnswerRecords([]);
    setIsFinished(false);
    setPracticeCards(null);
    setQuestionTimings([]);
    setFlaggedIds(new Set());
    setQuestionStartTime(Date.now());
  };

  const handleRetryWrong = () => {
    const wrongCards = cards.filter((card) => {
      const record = answerRecords.find((r) => r.cardId === card.id);
      return record && !record.isCorrect;
    });
    if (wrongCards.length === 0) return;
    setPracticeCards(wrongCards);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setAnswerRecords([]);
    setIsFinished(false);
    setQuestionTimings([]);
    setFlaggedIds(new Set());
    setQuestionStartTime(Date.now());
  };

  const handleBack = () => {
    navigate('/study?view=quizzes');
  };

  const results = useMemo(() => {
    const correct = answerRecords.filter((r) => r.isCorrect).length;
    const byType: Record<string, { correct: number; total: number }> = {};

    cards.forEach((card) => {
      const type = card.card_type;
      if (!byType[type]) {
        byType[type] = { correct: 0, total: 0 };
      }
      byType[type].total++;
      const record = answerRecords.find((r) => r.cardId === card.id);
      if (record?.isCorrect) {
        byType[type].correct++;
      }
    });

    const wrongCards = cards.filter((card) => {
      const record = answerRecords.find((r) => r.cardId === card.id);
      return record && !record.isCorrect;
    });

    // Timing stats (UX2-12): sum actual per-question durations
    const totalTime = questionTimings.reduce((sum, t) => sum + t.duration, 0);
    const answeredCount = questionTimings.length;
    const avgTime = answeredCount > 0 ? totalTime / answeredCount : 0;

    let fastest: { cardId: string; duration: number } | null = null;
    let slowest: { cardId: string; duration: number } | null = null;
    for (const t of questionTimings) {
      if (!fastest || t.duration < fastest.duration) fastest = t;
      if (!slowest || t.duration > slowest.duration) slowest = t;
    }

    return {
      total: cards.length,
      correct,
      byType,
      wrongCards,
      totalTime,
      avgTime: Math.round(avgTime),
      fastest: fastest ?? undefined,
      slowest: slowest ?? undefined,
      cards,
    };
  }, [cards, answerRecords, questionTimings]);

  if (isLoading) {
    return (
      <div
        className={`min-h-full flex items-center justify-center p-8 ${
          isDark ? 'bg-slate-900' : 'bg-gray-50'
        }`}
      >
        <div
          className={`w-full max-w-2xl rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !quizSetData) {
    return (
      <div
        className={`min-h-full flex flex-col items-center justify-center p-8 ${
          isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'
        }`}
      >
        <p role="alert" className="text-red-500 mb-4">{t('study.quizPractice.loadFailed')}</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {t('study.quizPractice.backToList')}
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        className={`min-h-full flex items-center justify-center p-8 ${
          isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'
        }`}
      >
        <EmptyState
          icon={<Layers size={32} />}
          title={t('study.quizPractice.noCards')}
          action={{
            label: t('study.quizPractice.backToList'),
            onClick: handleBack,
          }}
        />
      </div>
    );
  }

  if (isFinished) {
    return (
      <QuizResult
        quizSetId={quizSetId || ''}
        results={results}
        onRetry={handleRetry}
        onRetryWrong={handleRetryWrong}
        onBack={handleBack}
      />
    );
  }

  return (
    <div
      className={`min-h-full flex flex-col ${
        isDark ? 'bg-slate-900' : 'bg-gray-50'
      }`}
    >
      <div
        className={`sticky top-0 z-20 p-4 border-b ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-100'
        }`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowLeft size={18} />
              {t('study.quizPractice.exitQuiz')}
            </button>
            <h1
              className={`text-lg font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {quizSetData.title}
            </h1>
            <div className="w-20" />
          </div>
          <QuizProgressBar
            current={currentIndex}
            total={cards.length}
            answered={answered}
            onJump={handleJump}
            startTime={sessionStartTime}
            flaggedCount={flaggedIds.size}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className={`rounded-3xl shadow-2xl overflow-hidden border ${
                isDark
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-white border-gray-100'
              }`}
            >
              <div className="p-6 md:p-10">
                <div className="flex items-center justify-between mb-6">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isDark
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {cardTypeLabels[currentCard.card_type] || currentCard.card_type}
                  </span>
                  <button
                    onClick={toggleFlag}
                    className={`p-1.5 rounded-lg transition-all ${
                      flaggedIds.has(currentCard.id)
                        ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : isDark
                          ? 'text-slate-500 hover:text-amber-400 hover:bg-slate-700'
                          : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'
                    }`}
                    title={flaggedIds.has(currentCard.id) ? t('study.quizPractice.unflag') : t('study.quizPractice.flagForReview')}
                  >
                    <Flag
                      size={16}
                      fill={flaggedIds.has(currentCard.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>

                <div className="mb-8">
                  <h2
                    className={`text-lg md:text-xl font-semibold leading-snug ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {currentCard.question}
                  </h2>
                </div>

                {isChoice && currentOptions.length > 0 && (
                  <div className="space-y-3">
                    {currentOptions.map((option, idx) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option === currentCard.answer;

                      let btnClass =
                        'w-full p-4 rounded-xl border transition-all text-left flex items-start gap-3 ';
                      if (showAnswer) {
                        if (isCorrect)
                          {btnClass += isDark
                            ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400'
                            : 'bg-emerald-50 border-emerald-400 text-emerald-700';}
                        else if (isSelected)
                          {btnClass += isDark
                            ? 'bg-red-900/30 border-red-500 text-red-400'
                            : 'bg-red-50 border-red-400 text-red-700';}
                        else
                          {btnClass += isDark
                            ? 'bg-slate-800/50 border-slate-700 text-slate-500'
                            : 'bg-gray-50 border-gray-200 text-gray-400';}
                      } else {
                        btnClass += isSelected
                          ? isDark
                            ? 'bg-primary-900/40 border-primary-500 text-primary-300'
                            : 'bg-primary-50 border-primary-400 text-primary-700'
                          : isDark
                            ? 'bg-slate-800 border-slate-700 hover:border-primary-500 text-slate-200 cursor-pointer'
                            : 'bg-white border-gray-200 hover:border-primary-300 text-gray-700 cursor-pointer';
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleOptionClick(option)}
                          disabled={showAnswer}
                          className={btnClass}
                        >
                          <span
                            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                              isSelected
                                ? 'bg-primary-500 text-white'
                                : isDark
                                  ? 'bg-slate-700 text-slate-400'
                                  : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1 font-medium">{option}</span>
                          {showAnswer && isCorrect && (
                            <Check className="text-emerald-500 flex-shrink-0" size={20} />
                          )}
                          {showAnswer && isSelected && !isCorrect && (
                            <X className="text-red-500 flex-shrink-0" size={20} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isMultiChoice && currentOptions.length > 0 && (
                  <div className="space-y-3">
                    {currentOptions.map((option, idx) => {
                      const selectedList = selectedOption ? JSON.parse(selectedOption) : [];
                      const isSelected = selectedList.includes(option);
                      let correctList: string[] = [];
                      try {
                        correctList = JSON.parse(currentCard.answer);
                      } catch {
                        correctList = [];
                      }
                      const isCorrect = correctList.includes(option);

                      let btnClass =
                        'w-full p-4 rounded-xl border transition-all text-left flex items-start gap-3 ';
                      if (showAnswer) {
                        if (isCorrect)
                          {btnClass += isDark
                            ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400'
                            : 'bg-emerald-50 border-emerald-400 text-emerald-700';}
                        else if (isSelected)
                          {btnClass += isDark
                            ? 'bg-red-900/30 border-red-500 text-red-400'
                            : 'bg-red-50 border-red-400 text-red-700';}
                        else
                          {btnClass += isDark
                            ? 'bg-slate-800/50 border-slate-700 text-slate-500'
                            : 'bg-gray-50 border-gray-200 text-gray-400';}
                      } else {
                        btnClass += isSelected
                          ? isDark
                            ? 'bg-primary-900/40 border-primary-500 text-primary-300'
                            : 'bg-primary-50 border-primary-400 text-primary-700'
                          : isDark
                            ? 'bg-slate-800 border-slate-700 hover:border-primary-500 text-slate-200 cursor-pointer'
                            : 'bg-white border-gray-200 hover:border-primary-300 text-gray-700 cursor-pointer';
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleMultiOptionClick(option)}
                          disabled={showAnswer}
                          className={btnClass}
                        >
                          <span
                            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                              isSelected
                                ? 'bg-primary-500 text-white'
                                : isDark
                                  ? 'bg-slate-700 text-slate-400'
                                  : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1 font-medium">{option}</span>
                          {showAnswer && isCorrect && (
                            <Check className="text-emerald-500 flex-shrink-0" size={20} />
                          )}
                          {showAnswer && isSelected && !isCorrect && (
                            <X className="text-red-500 flex-shrink-0" size={20} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isTrueFalse && (
                  <div className="flex gap-4">
                    {['True', 'False'].map((option) => {
                      const isSelected = selectedOption === option;
                      const isCorrect = option === currentCard.answer;

                      let btnClass =
                        'flex-1 p-6 rounded-xl border transition-all font-bold text-lg flex flex-col items-center justify-center gap-2 ';
                      if (showAnswer) {
                        if (isCorrect)
                          {btnClass += isDark
                            ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400'
                            : 'bg-emerald-50 border-emerald-400 text-emerald-700';}
                        else if (isSelected)
                          {btnClass += isDark
                            ? 'bg-red-900/30 border-red-500 text-red-400'
                            : 'bg-red-50 border-red-400 text-red-700';}
                        else
                          {btnClass += isDark
                            ? 'bg-slate-800/50 border-slate-700 text-slate-500'
                            : 'bg-gray-50 border-gray-200 text-gray-400';}
                      } else {
                        btnClass += isSelected
                          ? isDark
                            ? 'bg-primary-900/40 border-primary-500 text-primary-300'
                            : 'bg-primary-50 border-primary-400 text-primary-700'
                          : isDark
                            ? 'bg-slate-800 border-slate-700 hover:border-primary-500 text-slate-200 cursor-pointer'
                            : 'bg-white border-gray-200 hover:border-primary-300 text-gray-700 cursor-pointer';
                      }

                      return (
                        <button
                          key={option}
                          onClick={() => handleOptionClick(option)}
                          disabled={showAnswer}
                          className={btnClass}
                        >
                          <span className="text-xl font-bold">
                            {option === 'True' ? t('study.quizPractice.trueLabel') : t('study.quizPractice.falseLabel')}
                          </span>
                          <span className="text-xs opacity-50 uppercase tracking-wider">
                            {option}
                          </span>
                          {showAnswer && isCorrect && (
                            <Check className="text-emerald-500" size={20} />
                          )}
                          {showAnswer && isSelected && !isCorrect && (
                            <X className="text-red-500" size={20} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(isQA || isEssay || isFillBlank) && showAnswer && (
                  <div className="space-y-6">
                    <div
                      className={`p-6 rounded-2xl ${
                        isDark ? 'bg-slate-700/50' : 'bg-gray-50'
                      }`}
                    >
                      <h3
                        className={`text-sm font-bold mb-3 ${
                          isDark ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                      >
                        {t('study.quizPractice.referenceAnswer')}
                      </h3>
                      <p
                        className={`text-base leading-relaxed ${
                          isDark ? 'text-slate-200' : 'text-gray-800'
                        }`}
                      >
                        {currentCard.answer}
                      </p>
                    </div>
                  </div>
                )}

                {showAnswer && currentCard.explanation && (
                  <div
                    className={`mt-6 p-5 rounded-2xl border ${
                      isDark
                        ? 'bg-slate-900/50 border-slate-700'
                        : 'bg-primary-50/30 border-primary-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3 text-primary-500">
                      <Brain size={18} />
                      <h3 className="font-bold text-sm uppercase tracking-wider">{t('study.quizPractice.explanationTitle')}</h3>
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        isDark ? 'text-slate-400' : 'text-gray-600'
                      }`}
                    >
                      {currentCard.explanation}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={`p-6 border-t ${
                  isDark ? 'border-slate-700' : 'border-gray-100'
                }`}
              >
                {!showAnswer ? (
                  (isQA || isEssay || isFillBlank) ? (
                    <button
                      onClick={handleShowAnswer}
                      className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 flex items-center justify-center gap-2"
                    >
                      <BookOpen size={20} />
                      {t('study.quizPractice.showAnswer')}
                    </button>
                  ) : isMultiChoice ? (
                    <button
                      onClick={handleSubmitMultiChoice}
                      disabled={!selectedOption || JSON.parse(selectedOption).length === 0}
                      className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 disabled:opacity-50 disabled:shadow-none"
                    >
                      {t('study.quizPractice.submitAnswer')}
                    </button>
                  ) : (
                    <p
                      className={`text-center py-4 text-sm ${
                        isDark ? 'text-slate-500' : 'text-gray-400'
                      }`}
                    >
                      {t('study.quizPractice.selectOption')}
                    </p>
                  )
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                        currentIndex === 0
                          ? 'opacity-30 cursor-not-allowed'
                          : isDark
                            ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <ChevronLeft size={20} />
                      {t('study.quizPractice.prevQuestion')}
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 flex items-center justify-center gap-2"
                    >
                      {currentIndex === cards.length - 1 ? t('study.quizPractice.finishQuiz') : t('study.quizPractice.nextQuestion')}
                      {currentIndex < cards.length - 1 && <ChevronRight size={20} />}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

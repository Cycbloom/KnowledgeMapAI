import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Layers,
  Send,
  Shuffle,
} from 'lucide-react';
import { useTheme } from '../hooks';
import { useQuizSet } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/common/useDocumentTitle';
import { QuizProgressBar } from '../components/Quiz/QuizProgressBar';
import { Skeleton } from '../components/common';
import { EmptyState } from '@/components/common/EmptyState';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { api } from '../services/api';
import type { StudyCard } from '@shared/types/common';
import { isTrueFalseAnswerEqual } from '../utils/textUtils';
import { isSelectFromOptionsCorrect } from '../utils/quizNewTypes';
import { getCardTypeBadgeMeta, badgeToneClasses } from '../utils/quizBadgeMeta';
import { getDifficultyBadgeMeta } from '../utils/quizDifficultyMeta';
import { CardStatsStrip, CardDatesLine, FocusTopicBadge } from '../components/Study/common';
import { VoiceDictationControl } from '../components/Study/common/VoiceDictationControl';
import { useVoiceDictation } from '../hooks/common/useVoiceDictation';
import { formatTimeFromSeconds } from '../utils/formatters';
import { shuffleArray, shuffleOptions } from '../utils/quizShuffle';
import { useQuizSettingsStore } from '../store/useQuizSettingsStore';
import { QuizExamGrading, type ExamAnswerRecord } from '../components/Quiz/QuizExamGrading';

const isOpenType = (type?: string): boolean => {
  return (
    !type ||
    type === 'qa' ||
    type === 'essay' ||
    type === 'fill_in_the_blank' ||
    type === 'cloze' ||
    type === 'matching' ||
    type === 'ordering'
  );
};

export const QuizPractice: React.FC = () => {
  const { t } = useTranslation();
  const { quizSetId } = useParams<{ quizSetId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { data: quizSetData, isLoading, error } = useQuizSet(quizSetId || '');

  useDocumentTitle(quizSetData?.title, t("documentTitle.suffix"));

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'exam' | 'grading'>('exam');
  const [grades, setGrades] = useState<Record<string, ExamAnswerRecord>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now());
  const [timeSpentByCard, setTimeSpentByCard] = useState<Record<string, number>>({});
  // 考试总用时：常驻顶部，随会话开始计时，重新测验时归零
  const sessionStartRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const baseCards = useMemo(() => {
    if (!quizSetData?.cards) return [] as StudyCard[];
    return quizSetData.cards as StudyCard[];
  }, [quizSetData]);

  // 题目顺序：默认随机打乱整卷（打断顺序记忆），可在设置中关闭
  const examShuffleQuestions = useQuizSettingsStore((s) => s.examShuffleQuestions);
  const setExamShuffleQuestions = useQuizSettingsStore((s) => s.setExamShuffleQuestions);
  const optionShuffle = useQuizSettingsStore((s) => s.optionShuffle);

  const [shuffleQuestions, setShuffleQuestions] = useState(examShuffleQuestions);
  const [cards, setCards] = useState<StudyCard[]>([]);
  useEffect(() => {
    if (baseCards.length > 0) {
      setCards(shuffleQuestions ? shuffleArray(baseCards) : baseCards);
    }
    // 数据加载后初始化一次，不随每题切换重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCards]);

  const toggleShuffle = useCallback(() => {
    setShuffleQuestions((prev) => {
      const next = !prev;
      setExamShuffleQuestions(next);
      setCards(next ? shuffleArray(baseCards) : baseCards);
      setCurrentIndex(0);
      setAnswers({});
      setTimeSpentByCard({});
      setQuestionStartTime(Date.now());
      return next;
    });
  }, [baseCards, setExamShuffleQuestions]);

  const currentCard = cards[currentIndex];

  const isMultiChoiceCard = currentCard?.card_type === 'multi_choice';
  const isChoiceCard = currentCard?.card_type === 'choice';
  const isSelectFromOptionsCard = currentCard?.card_type === 'select_from_options';

  const currentOptions: string[] = useMemo(() => {
    let options: string[] = [];
    if (!currentCard?.options) return [];
    if (Array.isArray(currentCard.options)) options = currentCard.options;
    else if (typeof currentCard.options === 'string') {
      try {
        options = JSON.parse(currentCard.options);
      } catch {
        return [];
      }
    }
    // 选择题选项随机排列，打断位置记忆（判分基于完整选项串，不受影响；可在设置中关闭）
    if (isChoiceCard || isMultiChoiceCard || isSelectFromOptionsCard) {
      if (optionShuffle) return shuffleOptions(options);
    }
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.id, isChoiceCard, isMultiChoiceCard, isSelectFromOptionsCard, optionShuffle]);
  const selectedSet = useMemo(() => {
    if (isMultiChoiceCard) {
      try {
        const parsed = JSON.parse(answers[currentCard.id] ?? '[]');
        if (Array.isArray(parsed)) return new Set(parsed as string[]);
      } catch {
        return new Set<string>();
      }
    }
    return new Set<string>();
  }, [isMultiChoiceCard, currentCard, answers]);

  const answered = useMemo(() => {
    return cards.map((c) => {
      const v = answers[c.id];
      return !!v && v.trim() !== '';
    });
  }, [cards, answers]);

  const handleBack = () => {
    navigate('/study?view=quizzes', { replace: true });
  };

  const recordCurrentTime = useCallback(() => {
    if (!currentCard) return;
    const duration = Math.max(1, Math.floor((Date.now() - questionStartTime) / 1000));
    setTimeSpentByCard((prev) => ({
      ...prev,
      [currentCard.id]: Math.max(prev[currentCard.id] ?? 0, duration),
    }));
    setQuestionStartTime(Date.now());
  }, [currentCard, questionStartTime]);

  const setAnswer = useCallback((cardId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [cardId]: value }));
  }, []);

  // 开放题语音听写：转写结果写回当前题的答案；录音期间切卡则丢弃迟到结果
  const voiceCardIdRef = useRef<string | null>(null);
  const currentAnswerValue = currentCard ? answers[currentCard.id] ?? '' : '';
  const handleVoiceAnswer = useCallback(
    (next: string) => {
      if (!currentCard || voiceCardIdRef.current !== currentCard.id) return;
      setAnswer(currentCard.id, next);
    },
    [currentCard, setAnswer],
  );
  const answerDictation = useVoiceDictation(currentAnswerValue, handleVoiceAnswer);
  const answerDictationRef = useRef(answerDictation);
  useEffect(() => {
    answerDictationRef.current = answerDictation;
  }, [answerDictation]);

  const handleMicToggle = () => {
    if (
      currentCard &&
      !answerDictation.isListening &&
      !answerDictation.isTranscribing &&
      !answerDictation.isConnecting
    ) {
      voiceCardIdRef.current = currentCard.id;
    }
    void answerDictation.toggleListening();
  };

  const handleEngineToggle = () => {
    answerDictation.setEngine(answerDictation.engine === "realtime" ? "file" : "realtime");
  };

  const handleOptionSelect = (card: StudyCard, option: string) => {
    if (card.card_type === 'multi_choice') {
      let current: string[] = [];
      const raw = answers[card.id];
      if (raw) {
        try {
          current = JSON.parse(raw);
        } catch {
          current = [];
        }
      }
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      setAnswer(card.id, JSON.stringify(next));
    } else {
      setAnswer(card.id, option);
    }
  };

  const gradeObjective = useCallback((card: StudyCard, userAnswer: string): boolean => {
    if (!userAnswer) return false;
    const type = card.card_type;
    if (type === 'choice') return userAnswer === card.answer;
    if (type === 'select_from_options') return isSelectFromOptionsCorrect(card.answer, userAnswer);
    if (type === 'true_false') return isTrueFalseAnswerEqual(userAnswer, card.answer);
    if (type === 'multi_choice') {
      try {
        const correct = JSON.parse(card.answer) as unknown;
        const user = JSON.parse(userAnswer) as unknown;
        if (!Array.isArray(correct) || !Array.isArray(user)) return false;
        return correct.length === user.length && correct.every((a) => user.includes(a as never));
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const handleSubmit = async () => {
    if (cards.length === 0) return;
    recordCurrentTime();

    const unansweredCount = cards.filter((c) => !answers[c.id] || answers[c.id].trim() === '').length;
    if (unansweredCount > 0) {
      const ok = await asyncConfirm({
        title: t('study.quizPractice.exam.unansweredTitle', '还有题目未作答'),
        message: t('study.quizPractice.exam.unansweredMessage', { count: unansweredCount }),
        isDangerous: false,
      });
      if (!ok) return;
    }

    setIsGrading(true);
    try {
      // 1) 客观题即时规则判分；主观题先占位再逐题 AI 判分
      const gradeMap: Record<string, ExamAnswerRecord> = {};
      const openCards: StudyCard[] = [];
      for (const card of cards) {
        const userAnswer = answers[card.id] ?? '';
        const base: ExamAnswerRecord = {
          cardId: card.id,
          isCorrect: false,
          userAnswer,
          correctAnswer: card.answer,
        };
        if (isOpenType(card.card_type)) {
          if (!userAnswer.trim()) {
            base.feedback = t('study.quizPractice.exam.notAnswered', '未作答');
            base.score = 0;
          } else {
            openCards.push(card);
          }
          gradeMap[card.id] = base;
        } else {
          base.isCorrect = gradeObjective(card, userAnswer);
          gradeMap[card.id] = base;
        }
      }

      // 2) 逐题 AI 判分（主观题）
      for (const card of openCards) {
        const userAnswer = answers[card.id] ?? '';
        try {
          const res = await api.ai.gradeAnswer({
            question: card.question,
            card_type: card.card_type ?? 'qa',
            reference_answer: card.answer,
            user_answer: userAnswer,
            explanation: card.explanation,
            difficulty: card.difficulty ? String(card.difficulty) : undefined,
          });
          gradeMap[card.id] = {
            ...gradeMap[card.id],
            isCorrect: res.data.correct,
            score: res.data.score,
            feedback: res.data.feedback,
            aiGraded: true,
          };
        } catch (err) {
          console.error('AI 判分失败:', err);
          gradeMap[card.id] = {
            ...gradeMap[card.id],
            score: 0,
            feedback: t('study.quizPractice.exam.aiGradeFailed', 'AI 评分失败，请人工核对'),
          };
        }
        setGrades({ ...gradeMap });
      }
      setGrades(gradeMap);

      // 3) 持久化测验结果
      try {
        await api.study.recordQuizAttempt(
          quizSetId ?? '',
          cards.map((c) => ({
            card_id: c.id,
            correct: gradeMap[c.id]?.isCorrect ?? false,
            user_answer: answers[c.id] ?? '',
            time_spent: timeSpentByCard[c.id] ?? 0,
          })),
        );
      } catch (err) {
        console.error('记录测验结果失败:', err);
      }

      setPhase('grading');
      setCurrentIndex(0);
    } finally {
      setIsGrading(false);
    }
  };

  const handleNext = () => {
    recordCurrentTime();
    if (currentIndex < cards.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    recordCurrentTime();
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleJump = (index: number) => {
    recordCurrentTime();
    setCurrentIndex(index);
  };

  const handleRetry = () => {
    setAnswers({});
    setGrades({});
    setTimeSpentByCard({});
    setCurrentIndex(0);
    setPhase('exam');
    setQuestionStartTime(Date.now());
    sessionStartRef.current = Date.now();
    setElapsedSeconds(0);
  };

  useEffect(() => {
    void answerDictationRef.current.stopListening();
    setQuestionStartTime(Date.now());
  }, [currentIndex]);

  // 考试总用时：每秒刷新，基于会话起点计算（与每题耗时 questionStartTime 区分）
  useEffect(() => {
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sessionStartRef.current) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 键盘快捷键：左右切换题目
  useEffect(() => {
    if (phase !== 'exam') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tagName = target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.key === 'ArrowLeft') handlePrev();
      else if (event.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, cards.length, answers, currentCard]);

  if (isLoading) {
    return (
      <div className={`min-h-full flex items-center justify-center p-8 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`w-full max-w-2xl rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
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
      <div className={`min-h-full flex flex-col items-center justify-center p-8 ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
        <p role="alert" className="text-red-500 mb-4">{t('study.quizPractice.loadFailed')}</p>
        <button onClick={handleBack} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          {t('study.quizPractice.backToList')}
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className={`min-h-full flex items-center justify-center p-8 ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
        <EmptyState
          icon={<Layers size={32} />}
          title={t('study.quizPractice.noCards')}
          action={{ label: t('study.quizPractice.backToList'), onClick: handleBack }}
        />
      </div>
    );
  }

  // === 评分阶段 ===
  if (phase === 'grading') {
    return (
      <QuizExamGrading
        cards={cards}
        grades={grades}
        isDark={isDark}
        onBack={handleBack}
        onRetry={handleRetry}
      />
    );
  }

  // === 答题阶段（考试模式）===
  const cardBadgeMeta = getCardTypeBadgeMeta(currentCard.card_type ?? 'qa');
  const CardBadgeIcon = cardBadgeMeta.Icon;
  const difficultyMeta = getDifficultyBadgeMeta(currentCard.difficulty);
  const currentAnswered = !!answers[currentCard.id] && answers[currentCard.id].trim() !== '';
  const isOpen = isOpenType(currentCard.card_type);
  const isTrueFalse = currentCard.card_type === 'true_false';

  const optionBtnClass = (selected: boolean) => {
    const base = 'w-full p-4 rounded-xl border transition-all text-left flex items-start gap-3 min-h-[48px] ';
    if (selected) {
      return base + (isDark
        ? 'bg-primary-900/40 border-primary-500 text-primary-200 cursor-pointer'
        : 'bg-primary-50 border-primary-400 text-primary-700 cursor-pointer');
    }
    return base + (isDark
      ? 'bg-slate-800 border-slate-700 hover:border-primary-500 text-slate-200 cursor-pointer'
      : 'bg-white border-gray-200 hover:border-primary-300 text-gray-700 cursor-pointer');
  };

  return (
    <div className={`min-h-full flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* 顶部栏 */}
      <div className={`sticky top-0 z-20 p-4 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 mb-3">
            <button
              onClick={handleBack}
              className={`justify-self-start inline-flex items-center gap-1 text-sm font-medium transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowLeft size={18} />
              {t('study.quizPractice.exitQuiz', '退出测验')}
            </button>
            <h1 className={`text-lg font-bold truncate min-w-0 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {quizSetData.title}
            </h1>
            <div className="justify-self-end flex items-center gap-2">
              <button
                onClick={toggleShuffle}
                aria-pressed={shuffleQuestions}
                title={shuffleQuestions ? t('study.quizPractice.shuffleOn', '已随机打乱题目顺序') : t('study.quizPractice.shuffleOff', '按原始顺序作答')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium transition-colors ${
                  shuffleQuestions
                    ? isDark
                      ? 'bg-primary-900/40 border-primary-500 text-primary-300'
                      : 'bg-primary-50 border-primary-400 text-primary-700'
                    : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
                }`}
              >
                <Shuffle size={15} aria-hidden="true" />
                {shuffleQuestions
                  ? t('study.quizPractice.shuffleOn', '已随机')
                  : t('study.quizPractice.shuffleOff', '原始顺序')}
              </button>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-medium tabular-nums ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
                title={t('quiz.progress.elapsedTime')}
              >
                <Clock size={15} className="text-primary-500" aria-hidden="true" />
                <span aria-live="polite" aria-atomic="true">{formatTimeFromSeconds(elapsedSeconds)}</span>
              </span>
            </div>
          </div>
          <QuizProgressBar
            current={currentIndex}
            total={cards.length}
            answered={answered}
            onJump={handleJump}
          />
        </div>
      </div>

      {/* 主体：居中的题目卡片 */}
      <div className="flex-1 flex items-start md:items-center justify-center p-4 md:p-6 max-w-6xl mx-auto w-full">
        <div className="w-full max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCard.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={`rounded-3xl shadow-2xl overflow-hidden border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}
              >
                <div className="p-6 md:p-8">
                  {/* 信息行 */}
                  <div className="w-full flex items-center justify-between gap-2 md:gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <CardStatsStrip card={currentCard} isDark={isDark} variant="masteryOnly" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`${badgeToneClasses(cardBadgeMeta.tone, isDark, 'ring')} text-xs font-bold gap-1 px-2.5 py-1`}>
                        <CardBadgeIcon size={14} />
                        {t(cardBadgeMeta.labelKey as never)}
                      </span>
                      {difficultyMeta && (
                        <span className={`${badgeToneClasses(difficultyMeta.tone, isDark, 'ring')} text-xs font-bold px-2.5 py-1`}>
                          {t(difficultyMeta.labelKey as never)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full flex items-start justify-between gap-2 md:gap-3 mb-4">
                    <FocusTopicBadge focusTopic={currentCard.focus_topic ?? undefined} variant="pill" grow />
                    <CardDatesLine card={currentCard} isDark={isDark} className="shrink-0" />
                  </div>

                  <h2 className={`text-lg md:text-xl font-semibold leading-snug mb-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {currentCard.question}
                  </h2>

                  {/* 答题输入区 */}
                  {isOpen ? (
                    <div>
                      <div
                        className={`rounded-xl border transition-colors ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 focus-within:border-primary-500'
                            : 'bg-white border-gray-200 focus-within:border-primary-400'
                        }`}
                      >
                        <textarea
                          value={answers[currentCard.id] ?? ''}
                          onChange={(e) => setAnswer(currentCard.id, e.target.value)}
                          rows={4}
                          placeholder={t('study.quizPractice.exam.answerPlaceholder', '在此输入你的答案…')}
                          className={`w-full p-4 pb-2 rounded-t-xl text-base resize-y min-h-[120px] bg-transparent focus:outline-none ${
                            isDark ? 'text-white placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
                          }`}
                          aria-label={t('study.quizPractice.exam.answerPlaceholder', '在此输入你的答案…')}
                        />
                        {answerDictation.hasSupport && (
                          <div className="flex items-center justify-end px-3 pb-3">
                            <VoiceDictationControl
                              isDark={isDark}
                              engine={answerDictation.engine}
                              isListening={answerDictation.isListening}
                              isTranscribing={answerDictation.isTranscribing}
                              isConnecting={answerDictation.isConnecting}
                              error={answerDictation.error}
                              hasSupport={answerDictation.hasSupport}
                              onToggle={handleMicToggle}
                              onToggleEngine={handleEngineToggle}
                              className="items-end"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentOptions.length === 0 && isTrueFalse
                        ? ['True', 'False'].map((option) => {
                            const isSelected = answers[currentCard.id] === option;
                            return (
                              <button
                                key={option}
                                onClick={() => setAnswer(currentCard.id, option)}
                                className={optionBtnClass(isSelected)}
                              >
                                <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                  isSelected ? 'bg-primary-500 text-white' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {option === 'True' ? t('study.quizPractice.trueLabel', '正确') : t('study.quizPractice.falseLabel', '错误')}
                                </span>
                                <span className="flex-1 font-medium">{option === 'True' ? t('study.quizPractice.trueLabel', '正确') : t('study.quizPractice.falseLabel', '错误')}</span>
                              </button>
                            );
                          })
                        : currentOptions.map((option, idx) => {
                            const isSelected = isMultiChoiceCard
                              ? selectedSet.has(option)
                              : answers[currentCard.id] === option;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleOptionSelect(currentCard, option)}
                                className={optionBtnClass(isSelected)}
                              >
                                <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                  isSelected ? 'bg-primary-500 text-white' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="flex-1 font-medium">{option}</span>
                              </button>
                            );
                          })}
                      {isMultiChoiceCard && (
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                          {t('study.quizPractice.exam.multiChoiceHint', '可多选，选择全部正确答案')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 底部操作 */}
                <div className={`p-5 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <div className="flex gap-3">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className={`flex-1 py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                        currentIndex === 0
                          ? 'opacity-30 cursor-not-allowed'
                          : isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <ChevronLeft size={20} />
                      {t('study.quizPractice.prevQuestion', '上一题')}
                    </button>
                    {currentIndex === cards.length - 1 ? (
                      <button
                        onClick={handleSubmit}
                        disabled={isGrading}
                        className="flex-1 py-3.5 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isGrading ? (
                          <><Loader2 size={20} className="animate-spin" />{t('study.quizPractice.exam.grading', '评分中…')}</>
                        ) : (
                          <><Send size={18} />{t('study.quizPractice.exam.submit', '交卷')}</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleNext}
                        className="flex-1 py-3.5 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 flex items-center justify-center gap-2"
                      >
                        {t('study.quizPractice.nextQuestion', '下一题')}
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>
                  {!currentAnswered && (
                    <p className={`text-center text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {t('study.quizPractice.exam.unansweredTip', '本道题尚未作答')}
                    </p>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
    </div>
  );
};

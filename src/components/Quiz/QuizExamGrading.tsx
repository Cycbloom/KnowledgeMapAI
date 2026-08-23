import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { StudyCard } from '@shared/types/common';
import { api } from '../../services/api';
import { message as toast } from '@/utils/messageHelper';
import { getCardTypeBadgeMeta, badgeToneClasses } from '../../utils/quizBadgeMeta';
import { getDifficultyBadgeMeta } from '../../utils/quizDifficultyMeta';
import { QuizExamNavigator } from './QuizExamNavigator';

export interface ExamAnswerRecord {
  cardId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  score?: number;
  feedback?: string;
  aiGraded?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QuizExamGradingProps {
  cards: StudyCard[];
  grades: Record<string, ExamAnswerRecord>;
  isDark: boolean;
  onBack: () => void;
  onRetry: () => void;
}

export const QuizExamGrading = ({
  cards,
  grades,
  isDark,
  onBack,
  onRetry,
}: QuizExamGradingProps) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentCard = cards[selectedIndex];
  const currentGrade = currentCard ? grades[currentCard.id] : undefined;

  const summary = useMemo(() => {
    const total = cards.length;
    let correct = 0;
    let totalScore = 0;
    const byType: Record<string, { correct: number; total: number }> = {};
    for (const card of cards) {
      const grade = grades[card.id];
      if (!byType[card.card_type ?? 'qa']) byType[card.card_type ?? 'qa'] = { correct: 0, total: 0 };
      byType[card.card_type ?? 'qa'].total++;
      if (grade?.isCorrect) correct++;
      totalScore += grade?.score ?? (grade?.isCorrect ? 100 : 0);
    }
    const avgScore = total > 0 ? Math.round(totalScore / total) : 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, accuracy, avgScore, byType };
  }, [cards, grades]);

  const navigatorItems = useMemo(
    () =>
      cards.map((card, idx) => {
        const grade = grades[card.id];
        const status =
          grade?.isCorrect === true
            ? 'correct'
            : grade?.isCorrect === false
              ? 'wrong'
              : idx === selectedIndex
                ? 'current'
                : 'unanswered';
        return { id: card.id, status: status as 'correct' | 'wrong' | 'current' | 'unanswered' };
      }),
    [cards, grades, selectedIndex],
  );

  const scrollChatToEnd = () => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text || isChatting) return;
    setChatInput('');
    const card = currentCard;
    const grade = currentGrade;
    const contextPrefix =
      card && grade
        ? `我在测验中回答了一道题。\n题干：${card.question}\n我的答案：${grade.userAnswer || '（未作答）'}\n参考答案：${grade.correctAnswer}\n${
            grade.aiGraded && grade.score !== undefined ? `AI 评分：${grade.score} 分\n评语：${grade.feedback ?? ''}\n` : ''
          }请基于以上题目与答案，回答我的问题：`
        : '';
    const userMsg: ChatMessage = { role: 'user', content: text };
    setChatMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setIsChatting(true);
    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      await api.ai.tutorChatStream(
        { message: `${contextPrefix}${text}`, history, mode: 'free' },
        (chunk) => {
          setChatMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
          scrollChatToEnd();
        },
      );
    } catch (err) {
      console.error('AI 助教对话失败:', err);
      toast.error(t('study.quizPractice.exam.assistantFailed', 'AI 助教对话失败，请重试'));
      setChatMessages((prev) => {
        const next = [...prev];
        if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1].content) {
          next.pop();
        }
        return next;
      });
    } finally {
      setIsChatting(false);
    }
  };

  const cardBadgeMeta = getCardTypeBadgeMeta(currentCard?.card_type ?? 'qa');
  const CardBadgeIcon = cardBadgeMeta.Icon;
  const difficultyMeta = getDifficultyBadgeMeta(currentCard?.difficulty);

  return (
    <div className={`min-h-full ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* 头部：返回 + 标题 + 总结 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowLeft size={18} />
            {t('study.quizPractice.exam.backToQuiz', '返回测验列表')}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onRetry}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <RefreshCw size={16} />
              {t('study.quizPractice.exam.retry', '重新测验')}
            </button>
          </div>
        </div>

        {/* 总结卡片 */}
        <div
          className={`rounded-2xl border p-4 md:p-5 mb-5 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            <div>
              <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {t('study.quizPractice.exam.totalScore', '总分')}
              </div>
              <div className={`text-3xl font-black ${summary.avgScore >= 60 ? 'text-emerald-500' : 'text-red-500'}`}>
                {summary.avgScore}
                <span className={`text-base font-semibold ml-0.5 ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
                  /100
                </span>
              </div>
            </div>
            <div className={`w-px h-10 self-center ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
            <div>
              <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {t('study.quizPractice.exam.accuracy', '正确率')}
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>{summary.accuracy}%</div>
            </div>
            <div>
              <div className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {t('study.quizPractice.exam.correctCount', '答对题数')}
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                {summary.correct}
                <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-400'}`}> / {summary.total}</span>
              </div>
            </div>
            <div className="flex-1" />
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {t('study.quizPractice.exam.gradingComplete', '评分完成，点击左侧题目查看对错与解析')}
            </div>
          </div>
        </div>

        {/* 主体：左答题情况 + 右题目回顾 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div
            className={`md:w-56 shrink-0 rounded-2xl border p-4 ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'
            }`}
          >
            <QuizExamNavigator
              items={navigatorItems as { id: string; status: 'correct' | 'wrong' | 'current' | 'unanswered' }[]}
              currentIndex={selectedIndex}
              onSelect={setSelectedIndex}
              isDark={isDark}
              counts={{ correct: summary.correct, wrong: summary.total - summary.correct }}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            {currentCard && (
              <div
                className={`rounded-2xl border overflow-hidden ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                }`}
              >
                <div className="p-5 md:p-6">
                  {/* 题目头部信息 */}
                  <div className="w-full flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 ${badgeToneClasses(cardBadgeMeta.tone, isDark, 'ring')} text-xs font-bold px-2.5 py-1`}
                    >
                      <CardBadgeIcon size={14} />
                      {t(cardBadgeMeta.labelKey as never)}
                    </span>
                    {difficultyMeta && (
                      <span className={`${badgeToneClasses(difficultyMeta.tone, isDark, 'ring')} text-xs font-bold px-2.5 py-1`}>
                        {t(difficultyMeta.labelKey as never)}
                      </span>
                    )}
                  </div>
                  <h3 className={`text-lg font-semibold leading-snug mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {currentCard.question}
                  </h3>

                  {/* 你的答案 */}
                  <div className={`rounded-xl border p-4 mb-3 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-gray-200'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {currentGrade?.isCorrect ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <X size={14} className="text-red-500" />
                      )}
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {t('study.quizPractice.exam.yourAnswer', '你的答案')}
                      </span>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                      {currentGrade?.userAnswer || t('study.quizPractice.exam.notAnswered', '未作答')}
                    </p>
                  </div>

                  {/* 参考答案 */}
                  <div className={`rounded-xl border p-4 mb-3 ${isDark ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Check size={14} className="text-emerald-500" />
                      <span className={`text-xs font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                        {t('study.quizPractice.exam.referenceAnswer', '参考答案')}
                      </span>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-emerald-100' : 'text-emerald-900'}`}>
                      {currentGrade?.correctAnswer}
                    </p>
                  </div>

                  {/* AI 评分（主观题） */}
                  {currentGrade?.aiGraded && (
                    <div className={`rounded-xl border p-4 mb-3 ${isDark ? 'bg-primary-900/20 border-primary-800/40' : 'bg-primary-50 border-primary-200'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={14} className="text-primary-500" />
                        <span className={`text-xs font-semibold ${isDark ? 'text-primary-300' : 'text-primary-700'}`}>
                          {t('study.quizPractice.exam.aiFeedback', 'AI 评分')}
                        </span>
                        {currentGrade.score !== undefined && (
                          <span className={`ml-auto text-xs font-black ${isDark ? 'text-primary-300' : 'text-primary-600'}`}>
                            {currentGrade.score} / 100
                          </span>
                        )}
                      </div>
                      <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {currentGrade.feedback}
                      </p>
                    </div>
                  )}

                  {/* 解析 */}
                  {currentCard.explanation && (
                    <div className={`rounded-xl border p-4 ${isDark ? 'bg-amber-900/20 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain size={14} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                        <span className={`text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                          {t('study.quizPractice.exam.explanation', '解析')}
                        </span>
                      </div>
                      <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-amber-100' : 'text-amber-900'}`}>
                        {currentCard.explanation}
                      </p>
                    </div>
                  )}
                </div>

                <div className={`p-4 border-t flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <button
                    onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                    disabled={selectedIndex === 0}
                    className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-30 ${
                      isDark
                        ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ChevronLeft size={16} />
                    {t('study.quizPractice.prevQuestion', '上一题')}
                  </button>
                  <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {selectedIndex + 1} / {cards.length}
                  </span>
                  <button
                    onClick={() => setSelectedIndex((i) => Math.min(cards.length - 1, i + 1))}
                    disabled={selectedIndex === cards.length - 1}
                    className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-30 ${
                      isDark
                        ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('study.quizPractice.nextQuestion', '下一题')}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* AI 助教聊天 */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <Sparkles size={16} className="text-primary-500" />
                <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  {t('study.quizPractice.exam.assistantTitle', 'AI 助教')}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {t('study.quizPractice.exam.assistantHint', '可就当前题目提问，AI 会结合题干与你的答案作答')}
                </span>
              </div>

              <div className={`max-h-72 overflow-y-auto custom-scrollbar p-4 space-y-3 ${isDark ? 'bg-slate-900/40' : 'bg-gray-50/60'}`}>
                {chatMessages.length === 0 ? (
                  <p className={`text-sm text-center py-6 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t('study.quizPractice.exam.assistantEmpty', '例如：我哪里答错了？这道题的关键知识点是什么？')}
                  </p>
                ) : (
                  chatMessages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                          m.role === 'user'
                            ? isDark
                              ? 'bg-primary-600 text-white'
                              : 'bg-primary-600 text-white'
                            : isDark
                              ? 'bg-slate-700 text-slate-200'
                              : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                      >
                        {m.content || (isChatting && idx === chatMessages.length - 1 ? <Loader2 size={14} className="animate-spin" /> : null)}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className={`p-3 border-t flex items-center gap-2 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder={t('study.quizPractice.exam.assistantPlaceholder', '输入你的问题…')}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white'
                      : 'bg-white border-gray-200 text-gray-800'
                  }`}
                  aria-label={t('study.quizPractice.exam.assistantPlaceholder', '输入你的问题…')}
                />
                <button
                  onClick={handleSend}
                  disabled={!chatInput.trim() || isChatting}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isChatting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span className="hidden sm:inline">{t('study.quizPractice.exam.send', '发送')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

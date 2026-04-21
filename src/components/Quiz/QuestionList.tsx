import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  HelpCircle,
  CheckSquare,
  ToggleLeft,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StudyCard } from '@shared/types/common';
import { useTheme } from "../../hooks";

interface QuestionListProps {
  cards: StudyCard[];
  quizSetId: string;
  onEdit: (card: StudyCard) => void;
  onDelete: (cardId: string) => void;
  onRegenerate: (cardId: string) => void;
  readOnly?: boolean;
}

type CardType = StudyCard['card_type'];

const cardTypeConfig: Record<CardType, { label: string; icon: React.ReactNode; color: string }> = {
  qa: { label: '问答题', icon: <MessageSquare size={16} />, color: 'text-primary-500' },
  choice: { label: '单选题', icon: <CheckSquare size={16} />, color: 'text-green-500' },
  multi_choice: { label: '多选题', icon: <CheckSquare size={16} />, color: 'text-primary-500' },
  true_false: { label: '判断题', icon: <ToggleLeft size={16} />, color: 'text-amber-500' },
  fill_in_the_blank: { label: '填空题', icon: <FileText size={16} />, color: 'text-primary-500' },
  essay: { label: '论述题', icon: <FileText size={16} />, color: 'text-rose-500' },
};

const difficultyConfig: Record<number, { label: string; color: string }> = {
  1: { label: '简单', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  2: { label: '较易', color: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400' },
  3: { label: '中等', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  4: { label: '较难', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  5: { label: '困难', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export const QuestionList: React.FC<QuestionListProps> = ({
  cards,
  quizSetId: _quizSetId,
  onEdit,
  onDelete,
  onRegenerate,
  readOnly = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<CardType>>(
    new Set(['qa', 'choice', 'multi_choice', 'true_false', 'fill_in_the_blank', 'essay'])
  );
  const [showAllAnswers, setShowAllAnswers] = useState(false);

  const groupedCards = useMemo(() => {
    const groups: Partial<Record<CardType, StudyCard[]>> = {};
    cards.forEach((card, index) => {
      if (!groups[card.card_type]) {
        groups[card.card_type] = [];
      }
      groups[card.card_type]!.push({ ...card, _index: index } as StudyCard & { _index: number });
    });
    return groups;
  }, [cards]);

  const toggleAnswer = (cardId: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleGroup = (type: CardType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleAllAnswers = () => {
    if (showAllAnswers) {
      setExpandedAnswers(new Set());
    } else {
      setExpandedAnswers(new Set(cards.map((c) => c.id)));
    }
    setShowAllAnswers(!showAllAnswers);
  };

  const getDifficultyDisplay = (difficulty?: number) => {
    if (!difficulty) return null;
    const config = difficultyConfig[Math.min(Math.max(difficulty, 1), 5)];
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const renderAnswer = (card: StudyCard) => {
    if (card.card_type === 'choice' || card.card_type === 'multi_choice') {
      return (
        <div className="space-y-1">
          {card.options?.map((option, idx) => {
            let isCorrect = false;
            if (card.card_type === 'choice') {
              isCorrect = card.answer === option;
            } else {
              try {
                const answers: string[] = JSON.parse(card.answer || '[]');
                isCorrect = Array.isArray(answers) && answers.includes(option);
              } catch {
                isCorrect = false;
              }
            }

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 p-2 rounded-lg ${
                  isCorrect
                    ? isDark
                      ? 'bg-green-900/30 border border-green-700'
                      : 'bg-green-50 border border-green-200'
                    : isDark
                      ? 'bg-slate-800/50'
                      : 'bg-gray-50'
                }`}
              >
                <span
                  className={`font-mono text-sm ${
                    isCorrect
                      ? 'text-green-500 font-bold'
                      : isDark
                        ? 'text-slate-500'
                        : 'text-gray-400'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span className={isCorrect ? 'font-medium' : ''}>{option}</span>
                {isCorrect && (
                  <CheckSquare size={14} className="text-green-500 ml-auto" />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (card.card_type === 'true_false') {
      return (
        <div className="flex gap-4">
          {['True', 'False'].map((val) => (
            <div
              key={val}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                card.answer === val
                  ? isDark
                    ? 'bg-green-900/30 border border-green-700'
                    : 'bg-green-50 border border-green-200'
                  : isDark
                    ? 'bg-slate-800/50'
                    : 'bg-gray-50'
              }`}
            >
              <span className={card.answer === val ? 'font-medium text-green-500' : ''}>
                {val === 'True' ? '正确' : '错误'}
              </span>
              {card.answer === val && (
                <CheckSquare size={14} className="text-green-500" />
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        className={`p-3 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} whitespace-pre-wrap`}
      >
        {card.answer}
      </div>
    );
  };

  const cardTypes = Object.keys(groupedCards) as CardType[];

  if (cards.length === 0) {
    return (
      <div
        className={`p-12 text-center rounded-xl border ${
          isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <HelpCircle size={48} className={`mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
        <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          暂无题目
        </p>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          点击上方"添加题目"按钮创建新题目
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          共 {cards.length} 道题目
        </div>
        <button
          onClick={toggleAllAnswers}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isDark
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {showAllAnswers ? <EyeOff size={16} /> : <Eye size={16} />}
          {showAllAnswers ? '隐藏答案' : '显示答案'}
        </button>
      </div>

      {cardTypes.map((type) => {
        const typeCards = groupedCards[type];
        if (!typeCards || typeCards.length === 0) return null;

        const config = cardTypeConfig[type];
        const isGroupExpanded = expandedGroups.has(type);

        return (
          <div
            key={type}
            className={`rounded-xl border overflow-hidden ${
              isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-gray-200'
            }`}
          >
            <button
              onClick={() => toggleGroup(type)}
              className={`w-full flex items-center justify-between p-4 ${
                isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={config.color}>{config.icon}</span>
                <span className="font-medium">{config.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {typeCards.length} 题
                </span>
              </div>
              {isGroupExpanded ? (
                <ChevronUp size={20} className={isDark ? 'text-slate-400' : 'text-gray-400'} />
              ) : (
                <ChevronDown size={20} className={isDark ? 'text-slate-400' : 'text-gray-400'} />
              )}
            </button>

            <AnimatePresence>
              {isGroupExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={`border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                    {typeCards.map((card, idx) => {
                      const cardWithIndex = card as StudyCard & { _index: number };
                      const isAnswerExpanded = expandedAnswers.has(card.id);

                      return (
                        <div
                          key={card.id}
                          className={`p-4 ${
                            idx > 0 ? `border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}` : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                isDark
                                  ? 'bg-primary-900/50 text-primary-300'
                                  : 'bg-primary-100 text-primary-600'
                              }`}
                            >
                              {(cardWithIndex._index ?? idx) + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium leading-relaxed">{card.question}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    {getDifficultyDisplay(card.difficulty)}
                                  </div>
                                </div>

                                {!readOnly && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => toggleAnswer(card.id)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isDark
                                          ? 'text-slate-400 hover:text-primary-400 hover:bg-slate-700'
                                          : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100'
                                      }`}
                                      title={isAnswerExpanded ? '隐藏答案' : '显示答案'}
                                    >
                                      {isAnswerExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                      onClick={() => onEdit(card)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isDark
                                          ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-700'
                                          : 'text-gray-400 hover:text-amber-600 hover:bg-gray-100'
                                      }`}
                                      title="编辑"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => onRegenerate(card.id)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isDark
                                          ? 'text-slate-400 hover:text-primary-400 hover:bg-slate-700'
                                          : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100'
                                      }`}
                                      title="重新生成"
                                    >
                                      <RefreshCw size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm('确定要删除这道题目吗？')) {
                                          onDelete(card.id);
                                        }
                                      }}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isDark
                                          ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                                          : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
                                      }`}
                                      title="删除"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <AnimatePresence>
                                {isAnswerExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="mt-3 overflow-hidden"
                                  >
                                    <div className="mb-2">
                                      <span
                                        className={`text-xs font-medium ${
                                          isDark ? 'text-slate-500' : 'text-gray-400'
                                        }`}
                                      >
                                        答案
                                      </span>
                                    </div>
                                    {renderAnswer(card)}

                                    {card.explanation && (
                                      <div className="mt-3">
                                        <span
                                          className={`text-xs font-medium ${
                                            isDark ? 'text-slate-500' : 'text-gray-400'
                                          }`}
                                        >
                                          解析
                                        </span>
                                        <div
                                          className={`mt-1 p-3 rounded-lg ${
                                            isDark
                                              ? 'bg-amber-900/20 border border-amber-800/50'
                                              : 'bg-amber-50 border border-amber-100'
                                          }`}
                                        >
                                          <p
                                            className={`text-sm ${
                                              isDark ? 'text-amber-200' : 'text-amber-800'
                                            }`}
                                          >
                                            {card.explanation}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

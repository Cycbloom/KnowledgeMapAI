import React, { useMemo } from 'react';
import { HelpCircle, CheckCircle, ListChecks, ToggleLeft, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import { useTheme } from "../../hooks";
import type { QuizSetConfig, CardType } from '@shared/types/quiz';

interface QuizTypeConfigProps {
  config: QuizSetConfig;
  onChange: (config: Partial<QuizSetConfig>) => void;
}

interface QuizTypeOption {
  id: CardType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultCount: number;
}

const quizTypes: QuizTypeOption[] = [
  {
    id: 'qa',
    label: '问答题',
    description: '开放式问题，需要完整回答',
    icon: <HelpCircle size={18} />,
    defaultCount: 5,
  },
  {
    id: 'choice',
    label: '单选题',
    description: '从多个选项中选择一个正确答案',
    icon: <CheckCircle size={18} />,
    defaultCount: 5,
  },
  {
    id: 'multi_choice',
    label: '多选题',
    description: '从多个选项中选择所有正确答案',
    icon: <ListChecks size={18} />,
    defaultCount: 3,
  },
  {
    id: 'true_false',
    label: '判断题',
    description: '判断陈述是否正确',
    icon: <ToggleLeft size={18} />,
    defaultCount: 5,
  },
  {
    id: 'fill_in_the_blank',
    label: '填空题',
    description: '填写空白处的正确内容',
    icon: <FileText size={18} />,
    defaultCount: 5,
  },
  {
    id: 'essay',
    label: '论述题',
    description: '深入分析，需要详细阐述',
    icon: <MessageSquare size={18} />,
    defaultCount: 2,
  },
];

export const QuizTypeConfig: React.FC<QuizTypeConfigProps> = ({ config, onChange }) => {
  const { isDark } = useTheme();

  const selectedTypes = config.cardTypes || [];
  const cardsPerType: Partial<Record<CardType, number>> = config.cardsPerType || {};

  const totalCount = useMemo(() => {
    return selectedTypes.reduce((sum, type) => sum + (cardsPerType[type] || 0), 0);
  }, [selectedTypes, cardsPerType]);

  const toggleType = (typeId: CardType) => {
    const newTypes = selectedTypes.includes(typeId)
      ? selectedTypes.filter((t) => t !== typeId)
      : [...selectedTypes, typeId];

    const newCardsPerType: Partial<Record<CardType, number>> = { ...cardsPerType };
    if (!selectedTypes.includes(typeId)) {
      const typeOption = quizTypes.find((t) => t.id === typeId);
      newCardsPerType[typeId] = typeOption?.defaultCount || 3;
    }

    onChange({
      cardTypes: newTypes,
      cardsPerType: newCardsPerType as Record<CardType, number>,
    });
  };

  const updateCount = (typeId: CardType, count: number) => {
    const newCardsPerType: Partial<Record<CardType, number>> = {
      ...cardsPerType,
      [typeId]: Math.max(1, Math.min(20, count)),
    };
    onChange({ cardsPerType: newCardsPerType as Record<CardType, number> });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          题型配置
        </label>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
          isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
        }`}>
          预计 {totalCount} 题
        </div>
      </div>

      {selectedTypes.length === 0 && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'
        }`}>
          <AlertCircle size={16} />
          <span>请至少选择一种题型</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {quizTypes.map((type) => {
          const isSelected = selectedTypes.includes(type.id);
          const count = cardsPerType[type.id] || type.defaultCount;

          return (
            <div
              key={type.id}
              onClick={() => toggleType(type.id)}
              className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? isDark
                    ? 'border-indigo-500 bg-indigo-900/20'
                    : 'border-indigo-500 bg-indigo-50'
                  : isDark
                    ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  isSelected
                    ? isDark
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-indigo-100 text-indigo-600'
                    : isDark
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-gray-100 text-gray-500'
                }`}>
                  {type.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${
                      isDark ? 'text-slate-200' : 'text-gray-800'
                    }`}>
                      {type.label}
                    </span>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 line-clamp-1 ${
                    isDark ? 'text-slate-500' : 'text-gray-500'
                  }`}>
                    {type.description}
                  </p>
                </div>
              </div>

              {isSelected && (
                <div
                  className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      题目数量
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCount(type.id, count - 1)}
                        disabled={count <= 1}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                          isDark
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50'
                        }`}
                      >
                        -
                      </button>
                      <span className={`w-8 text-center font-bold text-sm ${
                        isDark ? 'text-slate-200' : 'text-gray-800'
                      }`}>
                        {count}
                      </span>
                      <button
                        onClick={() => updateCount(type.id, count + 1)}
                        disabled={count >= 20}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                          isDark
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { Smile, Meh, Frown, Shuffle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface DifficultySelectorProps {
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  onChange: (difficulty: 'easy' | 'medium' | 'hard' | 'mixed') => void;
}

interface DifficultyOption {
  id: 'easy' | 'medium' | 'hard' | 'mixed';
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  darkBgColor: string;
  darkBorderColor: string;
}

const difficultyOptions: DifficultyOption[] = [
  {
    id: 'easy',
    label: '简单',
    description: '基础概念和定义，适合初学者',
    icon: <Smile size={20} />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500',
    darkBgColor: 'dark:bg-emerald-900/20',
    darkBorderColor: 'dark:border-emerald-500',
  },
  {
    id: 'medium',
    label: '中等',
    description: '需要理解和应用，适合进阶学习',
    icon: <Meh size={20} />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    darkBgColor: 'dark:bg-amber-900/20',
    darkBorderColor: 'dark:border-amber-500',
  },
  {
    id: 'hard',
    label: '困难',
    description: '深入分析和综合运用，挑战自我',
    icon: <Frown size={20} />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    darkBgColor: 'dark:bg-red-900/20',
    darkBorderColor: 'dark:border-red-500',
  },
  {
    id: 'mixed',
    label: '混合',
    description: '自动分配不同难度的题目',
    icon: <Shuffle size={20} />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-500',
    darkBgColor: 'dark:bg-indigo-900/20',
    darkBorderColor: 'dark:border-indigo-500',
  },
];

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  difficulty,
  onChange,
}) => {
  const { isDark } = useTheme();

  return (
    <div className="space-y-3">
      <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
        难度选择
      </label>

      <div className="grid grid-cols-2 gap-3">
        {difficultyOptions.map((option) => {
          const isSelected = difficulty === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? `${option.borderColor} ${isDark ? option.darkBgColor : option.bgColor}`
                  : isDark
                    ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isSelected
                      ? `${option.color} ${isDark ? option.darkBgColor : option.bgColor}`
                      : isDark
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {option.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-sm ${
                        isSelected
                          ? option.color
                          : isDark
                            ? 'text-slate-200'
                            : 'text-gray-800'
                      }`}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <div className={`w-2 h-2 rounded-full ${
                        option.id === 'easy' ? 'bg-emerald-500' :
                        option.id === 'medium' ? 'bg-amber-500' :
                        option.id === 'hard' ? 'bg-red-500' : 'bg-indigo-500'
                      }`} />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? 'text-slate-500' : 'text-gray-500'
                    }`}
                  >
                    {option.description}
                  </p>
                </div>
              </div>

              {isSelected && (
                <div
                  className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                    option.id === 'easy' ? 'bg-emerald-500' :
                    option.id === 'medium' ? 'bg-amber-500' :
                    option.id === 'hard' ? 'bg-red-500' : 'bg-indigo-500'
                  }`}
                >
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

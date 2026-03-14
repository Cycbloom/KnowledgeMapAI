import React from 'react';
import { GraduationCap, BookOpen, Mountain, Layers } from 'lucide-react';
import { useTheme } from "../../hooks";

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
    description: '基础概念题，直接考查知识点记忆',
    icon: <GraduationCap size={20} />,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    darkBgColor: 'dark:bg-green-900/20',
    darkBorderColor: 'dark:border-green-500',
  },
  {
    id: 'medium',
    label: '中等',
    description: '应用理解题，考查理解能力和应用',
    icon: <BookOpen size={20} />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    darkBgColor: 'dark:bg-orange-900/20',
    darkBorderColor: 'dark:border-orange-500',
  },
  {
    id: 'hard',
    label: '困难',
    description: '综合分析题，考查深度理解和分析',
    icon: <Mountain size={20} />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    darkBgColor: 'dark:bg-red-900/20',
    darkBorderColor: 'dark:border-red-500',
  },
  {
    id: 'mixed',
    label: '混合',
    description: '综合各难度层次的题目',
    icon: <Layers size={20} />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    darkBgColor: 'dark:bg-purple-900/20',
    darkBorderColor: 'dark:border-purple-500',
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
                        option.id === 'easy' ? 'bg-green-500' :
                        option.id === 'medium' ? 'bg-orange-500' :
                        option.id === 'hard' ? 'bg-red-500' : 'bg-purple-500'
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
                    option.id === 'easy' ? 'bg-green-500' :
                    option.id === 'medium' ? 'bg-orange-500' :
                    option.id === 'hard' ? 'bg-red-500' : 'bg-purple-500'
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

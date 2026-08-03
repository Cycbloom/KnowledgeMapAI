import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  difficulty,
  onChange,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const difficultyOptions = useMemo<DifficultyOption[]>(() => [
    {
      id: 'easy',
      label: t('quiz.difficultySelector.options.easy.label'),
      description: t('quiz.difficultySelector.options.easy.description'),
      icon: <GraduationCap size={20} aria-hidden="true" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
      darkBgColor: 'dark:bg-green-900/20',
      darkBorderColor: 'dark:border-green-500',
    },
    {
      id: 'medium',
      label: t('quiz.difficultySelector.options.medium.label'),
      description: t('quiz.difficultySelector.options.medium.description'),
      icon: <BookOpen size={20} aria-hidden="true" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-500',
      darkBgColor: 'dark:bg-orange-900/20',
      darkBorderColor: 'dark:border-orange-500',
    },
    {
      id: 'hard',
      label: t('quiz.difficultySelector.options.hard.label'),
      description: t('quiz.difficultySelector.options.hard.description'),
      icon: <Mountain size={20} aria-hidden="true" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
      darkBgColor: 'dark:bg-red-900/20',
      darkBorderColor: 'dark:border-red-500',
    },
    {
      id: 'mixed',
      label: t('quiz.difficultySelector.options.mixed.label'),
      description: t('quiz.difficultySelector.options.mixed.description'),
      icon: <Layers size={20} aria-hidden="true" />,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-500',
      darkBgColor: 'dark:bg-primary-900/20',
      darkBorderColor: 'dark:border-primary-500',
    },
  ], [t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFieldSetElement>) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.matches('[role="radio"]')) {
      return;
    }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') {
      return;
    }
    e.preventDefault();
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    if (radios.length === 0) return;
    const currentIndex = radios.findIndex((radio) => radio === target);
    if (currentIndex === -1) return;
    const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const nextIndex = isNext
      ? (currentIndex + 1) % radios.length
      : (currentIndex - 1 + radios.length) % radios.length;
    const nextRadio = radios[nextIndex];
    if (!nextRadio) return;
    nextRadio.focus();
    const nextOptionId = difficultyOptions[nextIndex]?.id;
    if (nextOptionId) {
      onChange(nextOptionId);
    }
  };

  return (
    <fieldset className="space-y-3" onKeyDown={handleKeyDown} role="radiogroup">
      <legend className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
        {t('study.difficultySelector.legend')}
      </legend>

      <div className="grid grid-cols-2 gap-3">
        {difficultyOptions.map((option) => {
          const isSelected = difficulty === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
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
                        option.id === 'hard' ? 'bg-red-500' : 'bg-primary-500'
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
                    option.id === 'hard' ? 'bg-red-500' : 'bg-primary-500'
                  }`}
                >
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
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
    </fieldset>
  );
};

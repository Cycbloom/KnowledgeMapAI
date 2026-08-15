import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, differenceInDays, isSameDay, isBefore } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import { TaskProgressPlan } from '../../types';

interface ProgressTimelineProps {
  progressPlans: TaskProgressPlan[];
  startDate: string;
  endDate: string;
  currentPercentage: number;
  onDayClick?: (date: string) => void;
  onProgressUpdate?: (date: string, percentage: number) => void;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({
  progressPlans,
  startDate,
  endDate,
  currentPercentage,
  onDayClick,
}) => {
  const { t, i18n } = useTranslation();
  const dateLocale = useMemo(() => {
    return i18n.language?.startsWith('zh') ? zhCN : enUS;
  }, [i18n.language]);
  const days = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = differenceInDays(end, start) + 1;
    return Array.from({ length: diff }, (_, i) => addDays(start, i));
  }, [startDate, endDate]);

  // 预构建 日期 -> plan 映射（首个匹配优先，与 find 语义一致），
  // 避免 days.map 中每天对 progressPlans 线性扫描（原为 O(days*plans)）
  const planByDayKey = useMemo(() => {
    const m = new Map<string, TaskProgressPlan>();
    progressPlans.forEach((p) => {
      const key = format(new Date(p.plan_date), 'yyyy-MM-dd');
      if (!m.has(key)) {
        m.set(key, p);
      }
    });
    return m;
  }, [progressPlans]);

  const getPlanForDate = (date: Date): TaskProgressPlan | undefined => {
    return planByDayKey.get(format(date, 'yyyy-MM-dd'));
  };

  const today = new Date();
  const totalDays = days.length;
  const completedDays = progressPlans.filter((p) => p.status === 'completed').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('scheduler.taskWorkbench.progressTimeline.title')}</h3>
        <div className="text-sm text-gray-500">
          {t('scheduler.progressTimeline.daysCompleted', { completed: completedDays, total: totalDays })}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">{t('scheduler.taskWorkbench.progressTimeline.totalProgress')}</span>
          <span className="font-medium text-gray-900 dark:text-white">{currentPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 via-primary-400 to-green-500 h-4 transition-all duration-500"
            style={{ width: `${currentPercentage}%` }}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-8 left-0 right-0 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
        
        <div
          className="absolute top-8 left-0 h-2 bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedDays / totalDays) * 100}%` }}
        />

        <div className="relative flex justify-between">
          {days.map((day, index) => {
            const plan = getPlanForDate(day);
            const isToday = isSameDay(day, today);
            const isPast = isBefore(day, today);
            const isCompleted = plan?.status === 'completed';
            const isSkipped = plan?.status === 'skipped';
            const progressDiff = plan ? plan.actual_percentage - plan.planned_percentage : 0;

            return (
              <div
                key={index}
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => onDayClick?.(format(day, 'yyyy-MM-dd'))}
              >
                <div
                  className={`text-xs mb-2 ${
                    isToday
                      ? 'text-primary-500 font-bold'
                      : isPast
                      ? 'text-gray-600 dark:text-gray-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {format(day, 'd', { locale: zhCN })}
                </div>

                <div
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isSkipped
                      ? 'bg-gray-400 text-white'
                      : isToday
                      ? 'bg-primary-500 text-white ring-4 ring-primary-200 dark:ring-primary-800'
                      : isPast
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                      : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isToday ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                </div>

                <div className="mt-2 text-center">
                  {plan && (
                    <>
                      <div
                        className={`text-xs font-medium ${
                          progressDiff >= 0 ? 'text-green-500' : 'text-orange-500'
                        }`}
                      >
                        {plan.actual_percentage > 0 ? `${plan.actual_percentage}%` : '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {t('scheduler.progressTimeline.plannedPercent', { percent: plan.planned_percentage })}
                      </div>
                    </>
                  )}
                </div>

                <div className="absolute bottom-full mb-2 hidden group-hover:block">
                  <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                    {format(day, t('scheduler.progressTimeline.monthDayFormat'), { locale: dateLocale })}
                    {plan && (
                      <div className="mt-1">
                        {t('scheduler.progressTimeline.plannedVsActual', {
                          planned: `${plan.planned_percentage}%`,
                          actual: `${plan.actual_percentage}%`,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>{t('scheduler.taskWorkbench.progressTimeline.completed')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-primary-500" />
          <span>{t('scheduler.taskWorkbench.progressTimeline.inProgress')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle className="w-4 h-4 text-gray-400" />
          <span>{t('scheduler.taskWorkbench.progressTimeline.pending')}</span>
        </div>
      </div>
    </div>
  );
};

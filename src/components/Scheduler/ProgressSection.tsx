import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import { TaskProgressPlan } from '../../types';
import { formatDate as formatDateUtil } from '../../utils/formatters';

interface ProgressSectionProps {
  progressPlans: TaskProgressPlan[];
  totalDuration?: number;
  progressPercentage: number;
}

export const ProgressSection: React.FC<ProgressSectionProps> = ({
  progressPlans,
  progressPercentage,
}) => {
  const { t } = useTranslation();
  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr, 'short');
  };

  const sortedPlans = [...progressPlans].sort((a, b) => 
    new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime()
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('scheduler.taskWorkbench.progressSection.title')}</h3>
      
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">{t('scheduler.taskWorkbench.progressSection.overallProgress')}</span>
          <span className="font-medium text-gray-900 dark:text-white">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-primary-500 to-green-500 h-3 rounded-full transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {sortedPlans.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">{t('scheduler.taskWorkbench.progressSection.dailyProgress')}</label>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {sortedPlans.map((plan) => {
              const isCompleted = plan.status === 'completed';
              const isSkipped = plan.status === 'skipped';
              const progressDiff = plan.actual_percentage - plan.planned_percentage;
              
              return (
                <div
                  key={plan.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    isCompleted ? 'bg-green-50 dark:bg-green-900/20' :
                    isSkipped ? 'bg-gray-50 dark:bg-gray-700' :
                    'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : isSkipped ? (
                    <Circle className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-primary-500" />
                  )}

                  <div className="w-16 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(plan.plan_date)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded h-2">
                        <div
                          className="bg-primary-500 h-2 rounded"
                          style={{ width: `${plan.planned_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-12">
                        {t('scheduler.progressSection.planned', { percent: plan.planned_percentage })}
                      </span>
                    </div>
                    {plan.actual_percentage > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded h-2">
                          <div
                            className={`h-2 rounded ${
                              progressDiff >= 0 ? 'bg-green-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${plan.actual_percentage}%` }}
                          />
                        </div>
                        <span className={`text-xs w-12 ${
                          progressDiff >= 0 ? 'text-green-500' : 'text-orange-500'
                        }`}>
                          {t('scheduler.progressSection.actual', { percent: plan.actual_percentage })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

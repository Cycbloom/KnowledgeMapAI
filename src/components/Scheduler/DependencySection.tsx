import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { TaskDependency } from '../../types';

interface DependencySectionProps {
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
  onTaskClick?: (taskId: string) => void;
}

export const DependencySection: React.FC<DependencySectionProps> = ({
  dependencies,
  dependents,
  onTaskClick,
}) => {
  const { t } = useTranslation();
  if (dependencies.length === 0 && dependents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('scheduler.taskWorkbench.dependencySection.title')}</h3>
      
      {dependencies.length > 0 && (
        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400">{t('scheduler.taskWorkbench.dependencySection.predecessors')}</label>
          <div className="mt-2 space-y-2">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => onTaskClick?.(dep.depends_on_task_id)}
              >
                <div className={`w-2 h-2 rounded-full ${
                  dep.depends_on_task?.status === 'completed' ? 'bg-green-500' :
                  dep.depends_on_task?.status === 'in_progress' ? 'bg-primary-500' : 'bg-gray-400'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {dep.depends_on_task?.title || t('scheduler.dependencySection.unknownTask')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dep.dependency_type === 'strict' ? t('scheduler.dependencySection.strictDependency') : t('scheduler.dependencySection.softDependency')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {dependents.length > 0 && (
        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400">{t('scheduler.taskWorkbench.dependencySection.successors')}</label>
          <div className="mt-2 space-y-2">
            {dependents.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => onTaskClick?.(dep.task_id)}
              >
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {dep.depends_on_task?.title || t('scheduler.dependencySection.unknownTask')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dep.dependency_type === 'strict' ? t('scheduler.dependencySection.strictDependencyOnTask') : t('scheduler.dependencySection.softDependencyOnTask')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

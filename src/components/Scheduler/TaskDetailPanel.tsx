import React from 'react';
import { X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { UserTaskDetail } from '../../types';
import { BasicInfoSection } from './BasicInfoSection';
import { DependencySection } from './DependencySection';
import { ProgressSection } from './ProgressSection';
import { RelatedResourcesSection } from './RelatedResourcesSection';

interface TaskDetailPanelProps {
  task: UserTaskDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
}

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  isOpen,
  onClose,
  onEdit,
  onStart,
  onComplete,
}) => {
  if (!isOpen || !task) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'in_progress': return 'text-primary-500';
      case 'paused': return 'text-yellow-500';
      case 'cancelled': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'one_time': return '一次性任务';
      case 'long_term': return '长期项目';
      case 'periodic': return '周期任务';
      case 'learning': return '学习任务';
      default: return '普通任务';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
            {task.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-sm ${getStatusColor(task.status)}`}>
              {task.status === 'completed' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : 
               task.status === 'in_progress' ? <Clock className="w-4 h-4 inline mr-1" /> :
               <AlertCircle className="w-4 h-4 inline mr-1" />}
              {task.status}
            </span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
              {getTaskTypeLabel(task.task_type || 'one_time')}
            </span>
          </div>

          <BasicInfoSection task={task} />

          <DependencySection 
            dependencies={task.dependencies || []}
            dependents={task.dependents || []}
          />

          {task.task_type === 'long_term' && (
            <ProgressSection 
              progressPlans={task.progress_plans || []}
              totalDuration={task.total_duration}
              progressPercentage={task.progress_percentage || 0}
            />
          )}

          {task.knowledge_point_id && (
            <RelatedResourcesSection knowledgePointId={task.knowledge_point_id} />
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3">
          {task.status === 'pending' && onStart && (
            <button
              onClick={onStart}
              className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              开始任务
            </button>
          )}
          {task.status === 'in_progress' && onComplete && (
            <button
              onClick={onComplete}
              className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              完成任务
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              编辑
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

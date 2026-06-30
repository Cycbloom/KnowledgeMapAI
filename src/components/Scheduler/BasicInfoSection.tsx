import React from 'react';
import { Calendar, Clock, Tag, AlertTriangle } from 'lucide-react';
import { formatDurationMinutes, formatDate as formatDateUtil } from '../../utils/formatters';
import { UserTaskDetail } from '../../types';

interface BasicInfoSectionProps {
  task: UserTaskDetail;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ task }) => {
  const formatDate = (date: string) => {
    return formatDateUtil(date);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">基本信息</h3>
      
      {task.description && (
        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400">描述</label>
          <p className="mt-1 text-gray-700 dark:text-gray-300">{task.description}</p>
        </div>
      )}

      {task.context && (
        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400">上下文</label>
          <p className="mt-1 text-gray-700 dark:text-gray-300">{typeof task.context === 'string' ? task.context : JSON.stringify(task.context)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {task.total_duration && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">总时长</label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formatDurationMinutes(task.total_duration, { format: 'zh-spaced', emptyText: '0 分钟' })}
              </p>
            </div>
          </div>
        )}
        
        {task.estimated_duration && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">预计时长</label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formatDurationMinutes(task.estimated_duration, { format: 'zh-spaced', emptyText: '0 分钟' })}
              </p>
            </div>
          </div>
        )}

        {task.deadline && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">截止日期</label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formatDate(task.deadline)}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">优先级</label>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              P{task.priority}
            </p>
          </div>
        </div>
      </div>

      {task.tags && task.tags.length > 0 && (
        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Tag className="w-4 h-4" /> 标签
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            {task.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {task.task_type === 'long_term' && (
        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400">完成进度</label>
          <div className="mt-2">
            <div className="flex justify-between text-sm mb-1">
              <span>{task.progress_percentage}%</span>
              {task.required_time_slots && (
                <span className="text-gray-400">约 {task.required_time_slots} 个时间片</span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{ width: `${task.progress_percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

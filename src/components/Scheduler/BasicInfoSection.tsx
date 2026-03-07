import React from 'react';
import { Calendar, Clock, Tag, AlertTriangle } from 'lucide-react';
import { TaskDetail } from '../../types';

interface BasicInfoSectionProps {
  task: TaskDetail;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ task }) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
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
          <p className="mt-1 text-gray-700 dark:text-gray-300">{task.context}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {task.total_duration && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">总时长</label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formatDuration(task.total_duration)}
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
                {formatDuration(task.estimated_duration)}
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
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm"
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
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${task.progress_percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, AlertCircle, CheckCircle, Play, Pause, Trash2, Edit, Calendar, Tag, BarChart3, Timer, AlertTriangle } from 'lucide-react';
import { TaskDetail } from '../types';
import { schedulerApi } from '../services/api/scheduler';
import { useMessageStore } from '../store/useMessageStore';
import { BasicInfoSection } from '../components/Scheduler/BasicInfoSection';
import { DependencySection } from '../components/Scheduler/DependencySection';
import { ProgressSection } from '../components/Scheduler/ProgressSection';
import { RelatedResourcesSection } from '../components/Scheduler/RelatedResourcesSection';

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { addMessage } = useMessageStore();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId) {
      loadTaskDetail();
    }
  }, [taskId]);

  const loadTaskDetail = async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await schedulerApi.getTaskDetail(taskId);
      if (response.success) {
        setTask(response.data);
      } else {
        setError('加载任务详情失败');
      }
    } catch (err: any) {
      console.error('Failed to load task detail:', err);
      setError(err.message || '加载任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    if (!task) return;
    try {
      await schedulerApi.startTask(task.id);
      addMessage({ type: 'success', content: '任务已开始' });
      loadTaskDetail();
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '开始任务失败' });
    }
  };

  const handlePauseTask = async () => {
    if (!task) return;
    try {
      await schedulerApi.pauseTask(task.id);
      addMessage({ type: 'success', content: '任务已暂停' });
      loadTaskDetail();
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '暂停任务失败' });
    }
  };

  const handleCompleteTask = async () => {
    if (!task) return;
    try {
      await schedulerApi.completeTask(task.id);
      addMessage({ type: 'success', content: '任务已完成' });
      loadTaskDetail();
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '完成任务失败' });
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm('确定要删除这个任务吗？此操作不可撤销。')) return;
    try {
      await schedulerApi.deleteTask(task.id);
      addMessage({ type: 'success', content: '任务已删除' });
      navigate('/scheduler');
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '删除任务失败' });
    }
  };

  const handleEditTask = () => {
    navigate('/scheduler', { state: { editTaskId: task?.id } });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'cancelled': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'paused': return '已暂停';
      case 'cancelled': return '已取消';
      default: return '待处理';
    }
  };

  const getTaskTypeLabel = (type?: string) => {
    switch (type) {
      case 'one_time': return '一次性任务';
      case 'long_term': return '长期项目';
      case 'periodic': return '周期任务';
      case 'learning': return '学习任务';
      default: return '普通任务';
    }
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 4) return { label: '高优先级', color: 'text-red-500' };
    if (priority >= 2) return { label: '中优先级', color: 'text-yellow-500' };
    return { label: '低优先级', color: 'text-green-500' };
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '未设置';
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未设置';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">加载失败</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error || '任务不存在'}</p>
        <button
          onClick={() => navigate('/scheduler')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          返回调度器
        </button>
      </div>
    );
  }

  const priorityInfo = getPriorityLabel(task.priority);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => navigate('/scheduler')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回调度器</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditTask}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <Edit className="w-4 h-4" />
                编辑
              </button>
              <button
                onClick={handleDeleteTask}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {task.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getStatusColor(task.status)}`}>
                    {getStatusIcon(task.status)}
                    {getStatusLabel(task.status)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300">
                    <Tag className="w-4 h-4" />
                    {getTaskTypeLabel(task.task_type)}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${priorityInfo.color}`}>
                    <AlertCircle className="w-4 h-4" />
                    {priorityInfo.label}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300">
                    Q{task.queue_level}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {task.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">描述</h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {task.context && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">任务背景</h3>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{task.context}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Timer className="w-4 h-4" />
                  <span className="text-sm">预计时长</span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDuration(task.estimated_duration)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">实际时长</span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDuration(task.actual_duration)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-sm">总时长</span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDuration(task.total_duration)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">截止日期</span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {task.deadline ? formatDate(task.deadline) : '未设置'}
                </p>
              </div>
            </div>

            {task.task_type === 'long_term' && task.progress_percentage !== undefined && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">进度</h3>
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${task.progress_percentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {task.progress_percentage}% 完成
                </p>
              </div>
            )}

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

            {task.tags && task.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">标签</h3>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">创建时间：</span>
                {formatDate(task.created_at)}
              </div>
              <div>
                <span className="font-medium">更新时间：</span>
                {formatDate(task.updated_at)}
              </div>
              {task.completed_at && (
                <div>
                  <span className="font-medium">完成时间：</span>
                  {formatDate(task.completed_at)}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex flex-wrap gap-3">
              {task.status === 'pending' && (
                <button
                  onClick={handleStartTask}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Play className="w-5 h-5" />
                  开始任务
                </button>
              )}
              {task.status === 'in_progress' && (
                <>
                  <button
                    onClick={handlePauseTask}
                    className="flex items-center gap-2 px-6 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <Pause className="w-5 h-5" />
                    暂停任务
                  </button>
                  <button
                    onClick={handleCompleteTask}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    完成任务
                  </button>
                </>
              )}
              {task.status === 'paused' && (
                <button
                  onClick={handleStartTask}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Play className="w-5 h-5" />
                  继续任务
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;

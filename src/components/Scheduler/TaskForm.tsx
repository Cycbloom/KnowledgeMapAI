import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, Tag, Link, Star, AlertCircle } from 'lucide-react';
import { ScheduledTask, CreateScheduledTaskData } from '../../services/api/scheduler';

interface TaskFormProps {
  task?: ScheduledTask;
  onSubmit: (data: CreateScheduledTaskData) => void;
  onCancel: () => void;
  knowledgePoints?: { id: string; title: string }[];
  defaultQueueLevel?: number;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 25, label: '25 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' },
  { value: 60, label: '1 小时' },
  { value: 90, label: '1.5 小时' },
  { value: 120, label: '2 小时' },
  { value: 180, label: '3 小时' },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: '低', color: 'text-slate-400' },
  { value: 2, label: '中', color: 'text-blue-400' },
  { value: 3, label: '高', color: 'text-amber-400' },
  { value: 4, label: '紧急', color: 'text-red-400' },
];

const COMMON_TAGS = [
  '学习', '工作', '阅读', '写作', '编程', '复习', '项目', '会议', '运动', '休息'
];

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  onSubmit,
  onCancel,
  knowledgePoints = [],
  defaultQueueLevel = 2,
}) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [estimatedDuration, setEstimatedDuration] = useState(task?.estimated_duration || 25);
  const [deadline, setDeadline] = useState(task?.deadline ? task.deadline.slice(0, 16) : '');
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [customTag, setCustomTag] = useState('');
  const [knowledgePointId, setKnowledgePointId] = useState(task?.knowledge_point_id || '');
  const [priority, setPriority] = useState(task?.priority || 2);
  const [queueLevel, setQueueLevel] = useState(task?.queue_level ?? defaultQueueLevel);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!task;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = '请输入任务标题';
    }
    if (title.length > 100) {
      newErrors.title = '标题不能超过100个字符';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      estimated_duration: estimatedDuration,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      tags: tags.length > 0 ? tags : undefined,
      knowledge_point_id: knowledgePointId || undefined,
      priority,
      queue_level: queueLevel,
    });
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setCustomTag('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      addTag(customTag.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-lg font-bold text-white">
            {isEditing ? '编辑任务' : '创建新任务'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              任务标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题..."
              className={`
                w-full px-4 py-2.5 rounded-xl
                bg-slate-800 border transition-all
                text-white placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                ${errors.title ? 'border-red-500' : 'border-slate-600 hover:border-slate-500'}
              `}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加任务描述..."
              rows={3}
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-slate-800 border border-slate-600 hover:border-slate-500
                text-white placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                resize-none
              "
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <Clock size={14} className="inline mr-1" />
                预计时长
              </label>
              <select
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-800 border border-slate-600 hover:border-slate-500
                  text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <Calendar size={14} className="inline mr-1" />
                截止日期
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-800 border border-slate-600 hover:border-slate-500
                  text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <Star size={14} className="inline mr-1" />
                优先级
              </label>
              <div className="flex gap-1">
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`
                      flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${priority === opt.value 
                        ? `bg-slate-700 ${opt.color} ring-1 ring-current` 
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                队列级别
              </label>
              <div className="flex gap-1">
                {[0, 1, 2].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setQueueLevel(level)}
                    className={`
                      flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${queueLevel === level 
                        ? level === 0 
                          ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50'
                          : level === 1
                            ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                            : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'}
                    `}
                  >
                    Q{level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <Tag size={14} className="inline mr-1" />
              标签
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_TAGS.filter(t => !tags.includes(t)).slice(0, 6).map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-400 text-sm hover:bg-slate-600 hover:text-white transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入自定义标签，按 Enter 添加..."
              className="
                w-full px-4 py-2 rounded-xl
                bg-slate-800 border border-slate-600 hover:border-slate-500
                text-white placeholder-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
              "
            />
          </div>

          {knowledgePoints.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <Link size={14} className="inline mr-1" />
                关联知识点
              </label>
              <select
                value={knowledgePointId}
                onChange={(e) => setKnowledgePointId(e.target.value)}
                className="
                  w-full px-4 py-2.5 rounded-xl
                  bg-slate-800 border border-slate-600 hover:border-slate-500
                  text-white
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                "
              >
                <option value="">不关联知识点</option>
                {knowledgePoints.map(kp => (
                  <option key={kp.id} value={kp.id}>{kp.title}</option>
                ))}
              </select>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 bg-slate-800/30">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20"
          >
            {isEditing ? '保存修改' : '创建任务'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

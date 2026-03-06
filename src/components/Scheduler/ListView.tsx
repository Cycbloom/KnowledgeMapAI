import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Calendar, ArrowUpDown, ArrowUp, ArrowDown, 
  Filter, Search, ChevronDown, ChevronUp, Eye, EyeOff,
  Play, Pause, Check, Edit2, Trash2
} from 'lucide-react';
import { ScheduledTask } from '../../services/api/scheduler';

interface ListViewProps {
  tasks: ScheduledTask[];
  onTaskClick?: (task: ScheduledTask) => void;
  onEditTask?: (task: ScheduledTask) => void;
  onDeleteTask?: (task: ScheduledTask) => void;
  onStartTask?: (task: ScheduledTask) => void;
  onPauseTask?: (task: ScheduledTask) => void;
  onCompleteTask?: (task: ScheduledTask) => void;
}

type SortField = 'title' | 'status' | 'queue_level' | 'priority' | 'deadline' | 'created_at' | 'estimated_duration';
type SortDirection = 'asc' | 'desc';

const QUEUE_COLORS = {
  0: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-500/30' },
  1: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-500/30' },
  2: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-500/30' },
};

const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  paused: { label: '已暂停', color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
};

const COLUMNS = [
  { id: 'title', label: '任务名称', width: 'w-64' },
  { id: 'status', label: '状态', width: 'w-24' },
  { id: 'queue_level', label: '队列', width: 'w-16' },
  { id: 'priority', label: '优先级', width: 'w-20' },
  { id: 'estimated_duration', label: '预计时长', width: 'w-24' },
  { id: 'deadline', label: '截止日期', width: 'w-28' },
  { id: 'tags', label: '标签', width: 'w-32' },
  { id: 'created_at', label: '创建时间', width: 'w-28' },
  { id: 'actions', label: '操作', width: 'w-32' },
];

export const ListView: React.FC<ListViewProps> = ({
  tasks,
  onTaskClick: _onTaskClick,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
}) => {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterQueue, setFilterQueue] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (filterStatus) {
      result = result.filter((task) => task.status === filterStatus);
    }

    if (filterQueue !== null) {
      result = result.filter((task) => task.queue_level === filterQueue);
    }

    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'queue_level':
          comparison = a.queue_level - b.queue_level;
          break;
        case 'priority':
          comparison = (b.priority || 0) - (a.priority || 0);
          break;
        case 'deadline':
          if (!a.deadline && !b.deadline) comparison = 0;
          else if (!a.deadline) comparison = 1;
          else if (!b.deadline) comparison = -1;
          else comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'estimated_duration':
          comparison = (a.estimated_duration || 0) - (b.estimated_duration || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tasks, sortField, sortDirection, filterStatus, filterQueue, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '--';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDate = (date?: string) => {
    if (!date) return '--';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const formatDeadline = (date?: string) => {
    if (!date) return { text: '--', color: 'text-slate-400 dark:text-slate-500' };
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { text: '已过期', color: 'text-red-500 dark:text-red-400' };
    if (days === 0) return { text: '今天', color: 'text-amber-500 dark:text-amber-400' };
    if (days === 1) return { text: '明天', color: 'text-yellow-500 dark:text-yellow-400' };
    if (days <= 7) return { text: `${days}天后`, color: 'text-blue-500 dark:text-blue-400' };
    return { text: d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), color: 'text-slate-500 dark:text-slate-400' };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-slate-400 dark:text-slate-500" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="text-cyan-500 dark:text-cyan-400" />
      : <ArrowDown size={14} className="text-cyan-500 dark:text-cyan-400" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-800 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-400 dark:focus:border-cyan-500/50 w-64"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
              ${showFilters 
                ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30' 
                : 'bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 hover:text-slate-800 dark:hover:text-white'
              }
            `}
          >
            <Filter size={16} />
            筛选
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-400">
          共 <span className="text-slate-800 dark:text-white font-medium">{filteredAndSortedTasks.length}</span> 个任务
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-500">状态:</span>
                <div className="flex gap-1">
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(filterStatus === status ? null : status)}
                      className={`
                        px-2 py-1 rounded text-xs font-medium transition-all
                        ${filterStatus === status 
                          ? config.color
                          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-500">队列:</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((level) => (
                    <button
                      key={level}
                      onClick={() => setFilterQueue(filterQueue === level ? null : level)}
                      className={`
                        px-2 py-1 rounded text-xs font-medium transition-all
                        ${filterQueue === level 
                          ? QUEUE_COLORS[level as keyof typeof QUEUE_COLORS].bg + ' ' + QUEUE_COLORS[level as keyof typeof QUEUE_COLORS].text
                          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      Q{level}
                    </button>
                  ))}
                </div>
              </div>

              {(filterStatus || filterQueue !== null) && (
                <button
                  onClick={() => {
                    setFilterStatus(null);
                    setFilterQueue(null);
                  }}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  清除筛选
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="overflow-x-auto custom-scrollbar h-full">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-800/80">
                {COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    className={`
                      px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider
                      ${column.id !== 'actions' && column.id !== 'tags' ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''}
                      border-b border-slate-200 dark:border-slate-700/50
                    `}
                    onClick={() => {
                      if (column.id !== 'actions' && column.id !== 'tags') {
                        handleSort(column.id as SortField);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.id !== 'actions' && column.id !== 'tags' && (
                        <SortIcon field={column.id as SortField} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
              <AnimatePresence>
                {filteredAndSortedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      没有找到匹配的任务
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedTasks.map((task, index) => {
                    const queueStyle = QUEUE_COLORS[task.queue_level as keyof typeof QUEUE_COLORS] || QUEUE_COLORS[2];
                    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                    const deadlineInfo = formatDeadline(task.deadline);
                    const isExpanded = expandedTask === task.id;

                    return (
                      <motion.tr
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <EyeOff size={14} className="text-slate-400 dark:text-slate-500" />
                            ) : (
                              <Eye size={14} className="text-slate-400 dark:text-slate-500" />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800 dark:text-white truncate">{task.title}</div>
                              {isExpanded && task.description && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  {task.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${queueStyle.bg} ${queueStyle.text}`}>
                            Q{task.queue_level}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {task.priority >= 3 && <span className="text-red-500 dark:text-red-400">★</span>}
                            <span className="text-slate-700 dark:text-slate-300">{task.priority || 0}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm">
                            <Clock size={12} />
                            <span>{formatDuration(task.estimated_duration)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1 text-sm ${deadlineInfo.color}`}>
                            <Calendar size={12} />
                            <span>{deadlineInfo.text}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {task.tags?.slice(0, 2).map((tag, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                                {tag}
                              </span>
                            ))}
                            {task.tags && task.tags.length > 2 && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">+{task.tags.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(task.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {task.status === 'pending' && onStartTask && (
                              <button
                                onClick={() => onStartTask(task)}
                                className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-all"
                                title="开始"
                              >
                                <Play size={14} />
                              </button>
                            )}
                            {task.status === 'in_progress' && onPauseTask && (
                              <button
                                onClick={() => onPauseTask(task)}
                                className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-all"
                                title="暂停"
                              >
                                <Pause size={14} />
                              </button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'paused') && onCompleteTask && (
                              <button
                                onClick={() => onCompleteTask(task)}
                                className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                                title="完成"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {onEditTask && (
                              <button
                                onClick={() => onEditTask(task)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all"
                                title="编辑"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {onDeleteTask && (
                              <button
                                onClick={() => onDeleteTask(task)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                                title="删除"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

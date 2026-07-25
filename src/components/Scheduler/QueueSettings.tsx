import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  X, Plus, Trash2, Clock, Palette, AlertTriangle,
  GripVertical, Check, Loader2
} from 'lucide-react';
import { QUEUE_NAME_COLORS, type QueueColorName } from '@/constants/scheduler';

export interface Queue {
  id: string;
  name: string;
  color: QueueColor;
  timeSlice: number;
  order: number;
}

export type QueueColor = QueueColorName;

export interface CreateQueueData {
  name: string;
  color: QueueColor;
  timeSlice: number;
}

export interface UpdateQueueData {
  name?: string;
  color?: QueueColor;
  timeSlice?: number;
}

interface QueueSettingsProps {
  queues: Queue[];
  onUpdate: (id: string, data: UpdateQueueData) => Promise<void>;
  onCreate: (data: CreateQueueData) => Promise<void>;
  onDelete: (id: string, targetQueueId?: string) => Promise<void>;
  onReorder: (queueIds: string[]) => Promise<void>;
  onClose: () => void;
}

const TIME_SLICE_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 25, label: '25 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' },
  { value: 60, label: '1 小时' },
  { value: 90, label: '1.5 小时' },
  { value: 120, label: '2 小时' },
];

const MIN_QUEUES = 2;
const MAX_QUEUES = 5;

type DeleteConfirmState = {
  isOpen: boolean;
  queueId: string;
  queueName: string;
  targetQueueId?: string;
};

export const QueueSettings: React.FC<QueueSettingsProps> = ({
  queues,
  onUpdate,
  onCreate,
  onDelete,
  onReorder,
  onClose,
}) => {
  const [localQueues, setLocalQueues] = useState<Queue[]>([...queues].sort((a, b) => a.order - b.order));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<UpdateQueueData>({});
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    queueId: '',
    queueName: '',
  });

  const canAddQueue = localQueues.length < MAX_QUEUES;
  const canDeleteQueue = localQueues.length > MIN_QUEUES;

  const targetQueueOptions = useMemo(
    () => localQueues.filter(q => q.id !== deleteConfirm.queueId),
    [localQueues, deleteConfirm.queueId]
  );

  const handleReorder = async (newOrder: Queue[]) => {
    setLocalQueues(newOrder);
    const queueIds = newOrder.map(q => q.id);
    try {
      await onReorder(queueIds);
    } catch (error) {
      console.error('Failed to reorder queues:', error);
      setLocalQueues([...queues].sort((a, b) => a.order - b.order));
    }
  };

  const handleStartEdit = (queue: Queue) => {
    setEditingId(queue.id);
    setEditData({
      name: queue.name,
      color: queue.color,
      timeSlice: queue.timeSlice,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setLoading(true);
    try {
      await onUpdate(editingId, editData);
      setLocalQueues(prev =>
        prev.map(q => (q.id === editingId ? { ...q, ...editData } : q))
      );
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error('Failed to update queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQueue = async () => {
    if (!canAddQueue) return;
    setLoading(true);
    try {
      const usedColors = localQueues.map(q => q.color);
      const availableColor = (Object.keys(QUEUE_NAME_COLORS) as QueueColor[]).find(
        c => !usedColors.includes(c)
      ) || 'cyan';
      
      const newQueueData: CreateQueueData = {
        name: `队列 ${localQueues.length}`,
        color: availableColor,
        timeSlice: 25,
      };
      await onCreate(newQueueData);
    } catch (error) {
      console.error('Failed to create queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (queue: Queue) => {
    const otherQueues = localQueues.filter(q => q.id !== queue.id);
    setDeleteConfirm({
      isOpen: true,
      queueId: queue.id,
      queueName: queue.name,
      targetQueueId: otherQueues[0]?.id,
    });
  };

  const handleConfirmDelete = async () => {
    if (!canDeleteQueue) return;
    setLoading(true);
    try {
      await onDelete(deleteConfirm.queueId, deleteConfirm.targetQueueId);
      setLocalQueues(prev => prev.filter(q => q.id !== deleteConfirm.queueId));
      setDeleteConfirm({ isOpen: false, queueId: '', queueName: '' });
    } catch (error) {
      console.error('Failed to delete queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const ColorPicker: React.FC<{
    value: QueueColor;
    onChange: (color: QueueColor) => void;
  }> = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(QUEUE_NAME_COLORS) as QueueColor[]).map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`
            w-8 h-8 rounded-lg transition-all relative
            ${QUEUE_NAME_COLORS[color].bg} ${QUEUE_NAME_COLORS[color].border} border-2
            ${value === color ? `ring-2 ${QUEUE_NAME_COLORS[color].ring} ring-offset-2 dark:ring-offset-slate-800` : 'hover:scale-110'}
          `}
        >
          {value === color && (
            <Check size={14} className={`absolute inset-0 m-auto ${QUEUE_NAME_COLORS[color].text}`} />
          )}
        </button>
      ))}
    </div>
  );

  const QueueItem: React.FC<{ queue: Queue; index: number }> = ({ queue, index }) => {
    const isEditing = editingId === queue.id;
    const colorStyle = QUEUE_NAME_COLORS[isEditing ? (editData.color || queue.color) : queue.color];

    if (isEditing) {
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`
            p-4 rounded-xl border-2 ${colorStyle.border} ${colorStyle.bg}
            space-y-3
          `}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              编辑队列 #{index + 1}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <X size={14} />
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loading}
                className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              队列名称
            </label>
            <input
              type="text"
              value={editData.name || ''}
              onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
              className={`
                w-full px-3 py-2 rounded-lg
                bg-white dark:bg-slate-800 border ${colorStyle.border}
                text-slate-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-${queue.color}-500/50
              `}
              placeholder="输入队列名称"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              <Palette size={12} />
              队列颜色
            </label>
            <ColorPicker
              value={editData.color || queue.color}
              onChange={color => setEditData(prev => ({ ...prev, color }))}
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              <Clock size={12} />
              时间片
            </label>
            <select
              value={editData.timeSlice || queue.timeSlice}
              onChange={e => setEditData(prev => ({ ...prev, timeSlice: Number(e.target.value) }))}
              className={`
                w-full px-3 py-2 rounded-lg
                bg-white dark:bg-slate-800 border ${colorStyle.border}
                text-slate-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-${queue.color}-500/50
              `}
            >
              {TIME_SLICE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </motion.div>
      );
    }

    return (
      <div
        className={`
          group flex items-center gap-3 p-3 rounded-xl
          bg-white dark:bg-slate-800/50 border ${colorStyle.border}
          hover:shadow-md transition-all
        `}
      >
        <div className="cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400">
          <GripVertical size={18} />
        </div>

        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colorStyle.gradient}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${colorStyle.text} truncate`}>
              {queue.name}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Q{index}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock size={12} />
            <span>{queue.timeSlice} 分钟</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleStartEdit(queue)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            title="编辑"
          >
            <Palette size={14} />
          </button>
          <button
            onClick={() => handleDeleteClick(queue)}
            disabled={!canDeleteQueue}
            className={`
              p-1.5 rounded-lg transition-colors
              ${canDeleteQueue
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 dark:hover:text-red-400'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'}
            `}
            title={canDeleteQueue ? '删除' : `至少需要 ${MIN_QUEUES} 个队列`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-500 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              队列配置
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              管理队列优先级和设置（{localQueues.length}/{MAX_QUEUES}）
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
            <GripVertical size={14} />
            <span>拖拽调整队列优先级（上方优先级更高）</span>
          </div>

          <Reorder.Group
            axis="y"
            values={localQueues}
            onReorder={handleReorder}
            className="space-y-2"
          >
            <AnimatePresence>
              {localQueues.map((queue, index) => (
                <Reorder.Item
                  key={queue.id}
                  value={queue}
                  className="list-none"
                >
                  <QueueItem queue={queue} index={index} />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>

          {!canAddQueue && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
              <AlertTriangle size={16} />
              <span>已达到最大队列数量限制（{MAX_QUEUES} 个）</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-500 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={handleAddQueue}
            disabled={!canAddQueue || loading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl transition-all
              ${canAddQueue && !loading
                ? 'bg-gradient-to-r from-primary-500 to-primary-500 text-white hover:from-primary-400 hover:to-primary-400 shadow-lg shadow-primary-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'}
            `}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            <span className="font-medium">添加队列</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            完成
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal-overlay flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-500 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-red-100 dark:bg-red-500/20">
                    <AlertTriangle size={24} className="text-red-500 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      删除队列
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      此操作不可撤销
                    </p>
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  确定要删除队列 <span className="font-semibold text-slate-900 dark:text-white">「{deleteConfirm.queueName}」</span> 吗？
                </p>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 mb-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    该队列中的任务将迁移到其他队列
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    选择目标队列
                  </label>
                  <select
                    value={deleteConfirm.targetQueueId || ''}
                    onChange={e => setDeleteConfirm(prev => ({
                      ...prev,
                      targetQueueId: e.target.value,
                    }))}
                    className="
                      w-full px-4 py-2.5 rounded-xl
                      bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-500
                      text-slate-900 dark:text-white
                      focus:outline-none focus:ring-2 focus:ring-primary-500/50
                    "
                  >
                    {targetQueueOptions.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

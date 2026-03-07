import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Calendar, Info } from 'lucide-react';
import { schedulerApi, UserTimeSlot } from '../../services/api/scheduler';

const DAYS_OF_WEEK = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
];

interface TimeSlotSettingsProps {
  onClose?: () => void;
}

export const TimeSlotSettings: React.FC<TimeSlotSettingsProps> = (_props) => {
  const [timeSlots, setTimeSlots] = useState<UserTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSlot, setNewSlot] = useState<{
    day_of_week?: number | null;
    start_time: string;
    end_time: string;
    is_available: boolean;
    label: string;
  }>({
    day_of_week: null,
    start_time: '09:00',
    end_time: '12:00',
    is_available: true,
    label: '',
  });

  useEffect(() => {
    fetchTimeSlots();
  }, []);

  const fetchTimeSlots = async () => {
    try {
      const response = await schedulerApi.getTimeSlots();
      if (response.success) {
        setTimeSlots(response.data.slots || []);
      }
    } catch (error) {
      console.error('Failed to fetch time slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async () => {
    try {
      const response = await schedulerApi.createTimeSlot({
        ...newSlot,
        day_of_week: newSlot.day_of_week ?? undefined,
      });
      if (response.success) {
        setTimeSlots([...timeSlots, response.data]);
        setShowAddForm(false);
        setNewSlot({
          day_of_week: null,
          start_time: '09:00',
          end_time: '12:00',
          is_available: true,
          label: '',
        });
      }
    } catch (error) {
      console.error('Failed to add time slot:', error);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      const response = await schedulerApi.deleteTimeSlot(id);
      if (response.success) {
        setTimeSlots(timeSlots.filter((slot) => slot.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete time slot:', error);
    }
  };

  const getSlotsByDay = (day: number | null) => {
    return timeSlots.filter((slot) => slot.day_of_week === day);
  };

  const formatTime = (time: string) => {
    return time;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse flex items-center justify-between">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32" />
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-32" />
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">可用时间段</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/30"
        >
          <Plus className="w-4 h-4" />
          添加时间段
        </button>
      </div>

      {showAddForm && (
        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">添加新时间段</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                适用日期
              </label>
              <select
                value={newSlot.day_of_week ?? ''}
                onChange={(e) =>
                  setNewSlot({
                    ...newSlot,
                    day_of_week: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              >
                <option value="">每天</option>
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                标签（可选）
              </label>
              <input
                type="text"
                value={newSlot.label}
                onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })}
                placeholder="如：上午专注时间"
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                开始时间
              </label>
              <input
                type="time"
                value={newSlot.start_time}
                onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                结束时间
              </label>
              <input
                type="time"
                value={newSlot.end_time}
                onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddSlot}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/30"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {getSlotsByDay(null).length > 0 && (
          <div className="p-4 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl border border-cyan-200 dark:border-cyan-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-cyan-500" />
              <span className="font-medium text-slate-900 dark:text-white">每天</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getSlotsByDay(null).map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
                >
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-900 dark:text-white">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                  {slot.label && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">({slot.label})</span>
                  )}
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {DAYS_OF_WEEK.map((day) => {
          const daySlots = getSlotsByDay(day.value);
          if (daySlots.length === 0) return null;

          return (
            <div key={day.value} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-900 dark:text-white">{day.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      slot.is_available
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </span>
                    {slot.label && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">({slot.label})</span>
                    )}
                    {!slot.is_available && (
                      <span className="text-xs text-red-500">(不可用)</span>
                    )}
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {timeSlots.length === 0 && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <Info className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              还没有设置可用时间段
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              点击上方按钮添加你的可用时间
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

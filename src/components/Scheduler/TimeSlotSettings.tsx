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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">可用时间设置</h3>
          <p className="text-sm text-gray-500 mt-1">
            设置你每天的可用时间段，帮助系统更好地安排任务
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          添加时间段
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">添加新时间段</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
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
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                标签（可选）
              </label>
              <input
                type="text"
                value={newSlot.label}
                onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })}
                placeholder="如：上午专注时间"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                开始时间
              </label>
              <input
                type="time"
                value={newSlot.start_time}
                onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                结束时间
              </label>
              <input
                type="time"
                value={newSlot.end_time}
                onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleAddSlot}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* Week View */}
      <div className="space-y-4">
        {/* Global Slots */}
        {getSlotsByDay(null).length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-gray-900 dark:text-white">每天</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getSlotsByDay(null).map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg"
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                  {slot.label && (
                    <span className="text-xs text-gray-500">({slot.label})</span>
                  )}
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Slots */}
        {DAYS_OF_WEEK.map((day) => {
          const daySlots = getSlotsByDay(day.value);
          if (daySlots.length === 0) return null;

          return (
            <div key={day.value} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-900 dark:text-white">{day.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      slot.is_available
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </span>
                    {slot.label && (
                      <span className="text-xs text-gray-500">({slot.label})</span>
                    )}
                    {!slot.is_available && (
                      <span className="text-xs text-red-500">(不可用)</span>
                    )}
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {timeSlots.length === 0 && (
          <div className="text-center py-8">
            <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              还没有设置可用时间段
            </p>
            <p className="text-sm text-gray-400 mt-1">
              点击上方按钮添加你的可用时间
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

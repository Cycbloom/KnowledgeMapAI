import React, { useState, useEffect } from "react";
import { Plus, Trash2, Clock, Calendar, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from '../../services/api';
import type {UserTimeSlot} from '@shared/types';

const DAYS_OF_WEEK = [
  { value: 0, label: "周日" },
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
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
    start_time: "09:00",
    end_time: "12:00",
    is_available: true,
    label: "",
  });
  const { t } = useTranslation();

  useEffect(() => {
    fetchTimeSlots();
  }, []);

  const fetchTimeSlots = async () => {
    try {
      const slots = await api.scheduler.getTimeSlots();
      setTimeSlots(slots);
    } catch (error) {
      console.error("Failed to fetch time slots:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async () => {
    try {
      const newSlotResult = await api.scheduler.createTimeSlot({
        ...newSlot,
        day_of_week: newSlot.day_of_week ?? undefined,
      });
      setTimeSlots([...timeSlots, newSlotResult]);
      setShowAddForm(false);
      setNewSlot({
        day_of_week: null,
        start_time: "09:00",
        end_time: "12:00",
        is_available: true,
        label: "",
      });
    } catch (error) {
      console.error("Failed to add time slot:", error);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      await api.scheduler.deleteTimeSlot(id);
      setTimeSlots(timeSlots.filter((slot) => slot.id !== id));
    } catch (error) {
      console.error("Failed to delete time slot:", error);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          可用时间段
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all shadow-lg shadow-primary-500/30 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          添加时间段
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-500">
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">
            添加新时间段
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                适用日期
              </label>
              <select
                value={newSlot.day_of_week ?? ""}
                onChange={(e) =>
                  setNewSlot({
                    ...newSlot,
                    day_of_week: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  })
                }
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-h-[44px]"
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
                onChange={(e) =>
                  setNewSlot({ ...newSlot, label: e.target.value })
                }
                placeholder={t('scheduler.timeSlot.namePlaceholder')}
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                开始时间
              </label>
              <input
                type="time"
                value={newSlot.start_time}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, start_time: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1.5">
                结束时间
              </label>
              <input
                type="time"
                value={newSlot.end_time}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, end_time: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-h-[44px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors min-h-[44px]"
            >
              取消
            </button>
            <button
              onClick={handleAddSlot}
              className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all shadow-lg shadow-primary-500/30 min-h-[44px]"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {getSlotsByDay(null).length > 0 && (
          <div className="p-4 bg-primary-50 dark:bg-primary-500/10 rounded-xl border border-primary-200 dark:border-primary-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-500" />
              <span className="font-medium text-slate-900 dark:text-white">
                每天
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getSlotsByDay(null).map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-500"
                >
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-900 dark:text-white">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                  {slot.label && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ({slot.label})
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            <div
              key={day.value}
              className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-500"
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-900 dark:text-white">
                  {day.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      slot.is_available
                        ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-500"
                        : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
                    }`}
                  >
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {formatTime(slot.start_time)} -{" "}
                      {formatTime(slot.end_time)}
                    </span>
                    {slot.label && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({slot.label})
                      </span>
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
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-500">
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

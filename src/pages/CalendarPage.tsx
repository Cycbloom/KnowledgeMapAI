import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Link2,
  X,
  Calendar,
  Clock,
  Tag,
} from "lucide-react";
import { useTheme } from "../hooks";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { api } from "../services/api";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "../config/electronConfig";
import { CalendarMonthView } from "../components/Calendar/CalendarMonthView";
import { CalendarWeekView } from "../components/Calendar/CalendarWeekView";
import { CalendarDayView } from "../components/Calendar/CalendarDayView";
import { CalendarScheduleView } from "../components/Calendar/CalendarScheduleView";
import {
  CalendarEvent,
  ExecutionEvent,
  EventDropInfo,
  CalendarMode,
  ActivityEvent,
  DailyActivityStats,
} from "../types/calendar";

type ViewType = "month" | "week" | "day" | "schedule";

const VIEW_LABELS: Record<ViewType, string> = {
  month: "月",
  week: "周",
  day: "日",
  schedule: "日程",
};

interface QuickTaskFormData {
  title: string;
  description: string;
  deadline: Date;
  estimated_duration: number;
  priority: number;
  tags: string[];
}

export const CalendarPage: React.FC = () => {
  const { isDark } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [executions, setExecutions] = useState<ExecutionEvent[]>([]);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("plan");
  const [activityStats, setActivityStats] = useState<DailyActivityStats[]>([]);
  const [dailyActivities, setDailyActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskForm, setTaskForm] = useState<QuickTaskFormData>({
    title: "",
    description: "",
    deadline: new Date(),
    estimated_duration: 30,
    priority: 2,
    tags: [],
  });
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    loadData();
  }, [currentDate, viewType, calendarMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (calendarMode === "history") {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const endDate = new Date(year, month + 1, 0)
          .toISOString()
          .split("T")[0];

        const [statsRes, dailyRes] = await Promise.all([
          api.scheduler.getActivityStats(startDate, endDate),
          api.scheduler.getDailyActivities(
            currentDate.toISOString().split("T")[0],
          ),
        ]);

        if (statsRes?.data) setActivityStats(statsRes.data);
        if (dailyRes?.data) setDailyActivities(dailyRes.data);
      } else {
        const [tasksRes, executionsRes] = await Promise.all([
          api.scheduler.getTasks({}),
          api.scheduler.getExecutions({}),
        ]);

        if (tasksRes.success) {
          const calendarEvents: CalendarEvent[] = (tasksRes.data || []).map(
            (task: any) => ({
              id: task.id,
              title: task.title,
              description: task.description,
              start: task.scheduled_start || task.deadline || task.created_at,
              end: task.scheduled_end,
              type: task.tags?.includes("学习")
                ? "study"
                : task.tags?.includes("复习")
                  ? "review"
                  : "task",
              color:
                task.priority === 4
                  ? "red"
                  : task.priority === 3
                    ? "orange"
                    : "blue",
              allDay: !task.scheduled_start,
              estimated_duration: task.estimated_duration,
            }),
          );
          setEvents(calendarEvents);
        }

        if (executionsRes.success) {
          const executionEvents: ExecutionEvent[] = (
            executionsRes.data || []
          ).map((exec: any) => ({
            id: exec.id,
            task_id: exec.task_id,
            task_title: exec.task_title || "未知任务",
            started_at: exec.started_at,
            ended_at: exec.ended_at,
            duration: exec.duration,
            status: exec.status,
          }));
          setExecutions(executionEvents);
        }
      }
    } catch (error) {
      console.error("Failed to load calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = useCallback((date: Date) => {
    setCurrentDate(date);
    setViewType("day");
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.id) {
      window.location.href = `/scheduler/task/${event.id}`;
    }
  }, []);

  const handleAddEvent = useCallback((date: Date, hour?: number) => {
    const deadline = new Date(date);
    if (hour !== undefined) {
      deadline.setHours(hour, 0, 0, 0);
    }

    setTaskForm({
      title: "",
      description: "",
      deadline,
      estimated_duration: 30,
      priority: 2,
      tags: [],
    });
    setShowTaskModal(true);
  }, []);

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: "请输入任务标题",
      });
      return;
    }

    setSaving(true);
    try {
      await api.scheduler.createTask({
        title: taskForm.title,
        description: taskForm.description,
        deadline: taskForm.deadline.toISOString(),
        estimated_duration: taskForm.estimated_duration,
        priority: taskForm.priority,
        tags: taskForm.tags,
        queue_level:
          taskForm.priority >= 3 ? 0 : taskForm.priority >= 2 ? 1 : 2,
      });

      frontendEventBus.publish("message_show", {
        type: "success",
        content: "任务创建成功!",
      });
      setShowTaskModal(false);
      loadData();
    } catch (error: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: error.message || "创建任务失败",
      });
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !taskForm.tags.includes(newTag.trim())) {
      setTaskForm({ ...taskForm, tags: [...taskForm.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTaskForm({ ...taskForm, tags: taskForm.tags.filter((t) => t !== tag) });
  };

  const handleEventDrop = useCallback(async (dropInfo: EventDropInfo) => {
    try {
      const updateData: any = {
        scheduled_start: dropInfo.newStart.toISOString(),
      };

      if (dropInfo.newEnd) {
        updateData.scheduled_end = dropInfo.newEnd.toISOString();
      }

      await api.scheduler.updateTask(dropInfo.eventId, updateData);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: "任务时间已更新!",
      });
      loadData();
    } catch (error: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: error.message || "更新任务时间失败",
      });
    }
  }, []);

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const handleNavigate = (direction: number) => {
    switch (viewType) {
      case "month":
        navigateMonth(direction);
        break;
      case "week":
        navigateWeek(direction);
        break;
      case "day":
      case "schedule":
        navigateDay(direction);
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getTitle = () => {
    if (viewType === "month") {
      return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
    }
    return currentDate.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: viewType === "week" ? undefined : "numeric",
    });
  };

  const handleExportICS = async () => {
    try {
      let exportUrl: string;
      if (isElectronProduction()) {
        const electronApiUrl = await getElectronApiUrl();
        exportUrl = `${electronApiUrl}/calendar/export/ics`;
      } else {
        exportUrl = "/api/calendar/export/ics";
      }

      const response = await fetch(exportUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendar-${new Date().toISOString().split("T")[0]}.ics`;
      a.click();
      window.URL.revokeObjectURL(url);
      frontendEventBus.publish("message_show", {
        type: "success",
        content: "日历已导出!",
      });
    } catch (error) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: "导出失败",
      });
    }
  };

  const handleCopyWebCalLink = () => {
    const webcalUrl = `webcal://${window.location.host}/api/calendar/subscribe/${localStorage.getItem("userId")}`;
    navigator.clipboard.writeText(webcalUrl);
    frontendEventBus.publish("message_show", {
      type: "success",
      content: "WebCal 链接已复制!",
    });
  };

  const priorityLabels = ["低", "中", "高", "紧急"];

  return (
    <div
      className={`h-full flex flex-col ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      {/* Header */}
      <div
        className={`px-4 md:px-6 py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
      >
        <div className="flex flex-col gap-4">
          {/* Top row: Title + main controls */}
          <div className="flex items-center justify-between">
            <h1
              className={`text-xl md:text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              日历
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddEvent(currentDate)}
                className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors min-h-[44px]"
              >
                <Plus size={18} />
                <span className="hidden md:inline">添加任务</span>
              </button>
            </div>
          </div>

          {/* Navigation controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Date navigation */}
            <div className="flex items-center justify-center md:justify-start gap-2">
              <button
                onClick={() => handleNavigate(-1)}
                className={`p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <ChevronLeft size={20} />
              </button>
              <span
                className={`text-base md:text-lg font-medium min-w-[120px] md:min-w-[150px] text-center ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                {getTitle()}
              </span>
              <button
                onClick={() => handleNavigate(1)}
                className={`p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={goToToday}
                className={`px-4 py-2 text-sm rounded-lg font-medium min-h-[44px] ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                今天
              </button>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2 md:gap-3 justify-center md:justify-end overflow-x-auto">
              {/* View type selector */}
              <div
                className={`flex rounded-lg p-1 ${isDark ? "bg-slate-800" : "bg-gray-100"}`}
              >
                {(Object.keys(VIEW_LABELS) as ViewType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setViewType(type)}
                    className={`px-3 md:px-4 py-2 md:py-1.5 text-sm font-medium rounded-md transition-colors min-h-[44px] flex-shrink-0 ${
                      viewType === type
                        ? "bg-primary-600 text-white"
                        : isDark
                          ? "text-slate-400 hover:text-white"
                          : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {VIEW_LABELS[type]}
                  </button>
                ))}
              </div>

              <div
                className={`flex rounded-lg p-1 ${isDark ? "bg-slate-800" : "bg-gray-100"}`}
              >
                <button
                  onClick={() => setCalendarMode("plan")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    calendarMode === "plan"
                      ? "bg-primary-600 text-white"
                      : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  规划
                </button>
                <button
                  onClick={() => setCalendarMode("history")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    calendarMode === "history"
                      ? "bg-primary-600 text-white"
                      : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  历史
                </button>
              </div>

              {/* Export button */}
              <button
                onClick={() => setShowExportModal(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors min-h-[44px] ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Download size={18} />
                <span className="hidden md:inline">导出</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={viewType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`h-full rounded-xl border ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-200"
              }`}
            >
              {viewType === "month" && (
                <CalendarMonthView
                  currentDate={currentDate}
                  events={events}
                  executions={executions}
                  onDateSelect={handleDateSelect}
                  onEventClick={handleEventClick}
                  onAddEvent={handleAddEvent}
                  calendarMode={calendarMode}
                  activityStats={activityStats}
                />
              )}
              {viewType === "week" && (
                <CalendarWeekView
                  currentDate={currentDate}
                  events={events}
                  executions={executions}
                  onDateSelect={handleDateSelect}
                  onEventClick={handleEventClick}
                  onAddEvent={handleAddEvent}
                  onEventDrop={handleEventDrop}
                />
              )}
              {viewType === "day" && (
                <CalendarDayView
                  currentDate={currentDate}
                  events={events}
                  executions={executions}
                  onEventClick={handleEventClick}
                  onAddEvent={handleAddEvent}
                  onEventDrop={handleEventDrop}
                  calendarMode={calendarMode}
                  dailyActivities={dailyActivities}
                />
              )}
              {viewType === "schedule" && (
                <CalendarScheduleView
                  currentDate={currentDate}
                  events={events}
                  executions={executions}
                  onEventClick={handleEventClick}
                  onAddEvent={handleAddEvent}
                  onDateChange={setCurrentDate}
                  onEventDrop={handleEventDrop}
                  calendarMode={calendarMode}
                  dailyActivities={dailyActivities}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Quick Task Creation Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTaskModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 ${
                isDark ? "bg-slate-800" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  创建任务
                </h3>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className={`p-3 rounded-lg min-h-[44px] min-w-[44px] ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
                >
                  <X
                    size={20}
                    className={isDark ? "text-slate-400" : "text-gray-500"}
                  />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    任务标题 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, title: e.target.value })
                    }
                    placeholder="输入任务标题..."
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    描述
                  </label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, description: e.target.value })
                    }
                    placeholder="任务描述（可选）"
                    rows={2}
                    className={`w-full px-3 py-2 rounded-lg border resize-none ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                </div>

                {/* Deadline */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    <Calendar size={14} className="inline mr-1" />
                    截止日期
                  </label>
                  <input
                    type="datetime-local"
                    value={taskForm.deadline.toISOString().slice(0, 16)}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
                        deadline: new Date(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-gray-50 border-gray-200 text-gray-900"
                    }`}
                  />
                </div>

                {/* Duration & Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      <Clock size={14} className="inline mr-1" />
                      预计时长（分钟）
                    </label>
                    <input
                      type="number"
                      value={taskForm.estimated_duration}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          estimated_duration: parseInt(e.target.value) || 30,
                        })
                      }
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark
                          ? "bg-slate-700 border-slate-600 text-white"
                          : "bg-gray-50 border-gray-200 text-gray-900"
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      优先级
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          priority: parseInt(e.target.value),
                        })
                      }
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark
                          ? "bg-slate-700 border-slate-600 text-white"
                          : "bg-gray-50 border-gray-200 text-gray-900"
                      }`}
                    >
                      {priorityLabels.map((label, index) => (
                        <option key={index} value={index + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    <Tag size={14} className="inline mr-1" />
                    标签
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addTag())
                      }
                      placeholder="添加标签"
                      className={`flex-1 px-3 py-3 rounded-lg border min-h-[44px] ${
                        isDark
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className={`px-4 py-3 rounded-lg min-h-[44px] ${
                        isDark
                          ? "bg-slate-600 text-white hover:bg-slate-500"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      添加
                    </button>
                  </div>
                  {taskForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {taskForm.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 ${
                            isDark
                              ? "bg-slate-700 text-slate-300"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="hover:text-red-500 p-1 min-h-[32px] min-w-[32px]"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick tags */}
                <div className="flex flex-wrap gap-2">
                  {["学习", "工作", "生活", "健康", "复习"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (!taskForm.tags.includes(tag)) {
                          setTaskForm({
                            ...taskForm,
                            tags: [...taskForm.tags, tag],
                          });
                        }
                      }}
                      className={`px-3 py-2 rounded text-sm min-h-[40px] ${
                        taskForm.tags.includes(tag)
                          ? "bg-primary-600 text-white"
                          : isDark
                            ? "bg-slate-700 text-slate-400 hover:bg-slate-600"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className={`px-4 py-3 rounded-lg font-medium min-h-[44px] ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={saving}
                  className="px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
                >
                  {saving && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  )}
                  创建任务
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 ${
                isDark ? "bg-slate-800" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  导出日历
                </h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className={`p-1 rounded-lg ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
                >
                  <X
                    size={20}
                    className={isDark ? "text-slate-400" : "text-gray-500"}
                  />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleExportICS}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                    isDark
                      ? "border-slate-700 hover:bg-slate-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Download size={20} className="text-primary-500" />
                  <div className="text-left">
                    <p
                      className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      下载 .ics 文件
                    </p>
                    <p
                      className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                    >
                      导出为 iCalendar 格式，可导入到任何日历应用
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleCopyWebCalLink}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                    isDark
                      ? "border-slate-700 hover:bg-slate-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Link2 size={20} className="text-green-500" />
                  <div className="text-left">
                    <p
                      className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      复制 WebCal 订阅链接
                    </p>
                    <p
                      className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                    >
                      在日历应用中添加订阅链接，自动同步更新
                    </p>
                  </div>
                </button>

                <div
                  className={`p-4 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
                >
                  <p
                    className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    💡 华为手机用户：打开"日历"应用 → 点击右上角菜单 →
                    选择"订阅日历" → 粘贴 WebCal 链接
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
